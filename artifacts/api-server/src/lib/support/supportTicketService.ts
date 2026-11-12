import { db } from "@workspace/db";
import {
  complaintsTable,
  supportTicketMessagesTable,
  customersTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  dcmsVisitsTable,
  vehiclesTable,
  citiesTable,
  branchesTable,
  staffTable,
  dcmsOperationalExceptionsTable,
  type Complaint,
  type SupportTicketMessage,
} from "@workspace/db";
import { eq, and, or, sql, desc, inArray, ilike } from "drizzle-orm";
import {
  notifyTicketCreated,
  notifyTicketUpdated,
  notifyTicketResolved,
} from "../notifications/dispatcher";
import { resolveSupervisorForCustomer } from "../supervisor/supervisorContact";
import { logDcmsActivity } from "../dcms/auditLog";
import { resolveSlaPolicy, calculateSlaDeadlines } from "../quality/slaService";

export async function generateTicketNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 7).replace("-", ""); // YYYYMM
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(complaintsTable)
    .where(sql`created_at >= date_trunc('month', CURRENT_DATE)`);

  const nextSeq = Number(countResult?.count ?? 0) + 1;
  const padded = String(nextSeq).padStart(4, "0");
  return `TKT-${dateStr}-${padded}`;
}

export type CreateSupportTicketInput = {
  customerId: number;
  type: Complaint["type"];
  priority?: Complaint["priority"];
  title: string;
  description: string;
  photoUrl?: string | null;
  cityId?: number | null;
  branchId?: number | null;
  subscriptionId?: number | null;
  visitId?: number | null;
  invoiceId?: number | null;
  bookingId?: number | null;
};

export async function createSupportTicket(input: CreateSupportTicketInput, callerName?: string): Promise<Complaint> {
  let cityId = input.cityId ?? null;
  let branchId = input.branchId ?? null;

  // Resolve customer and default city/branch
  const [customer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      cityId: customersTable.cityId,
      branchId: customersTable.branchId,
    })
    .from(customersTable)
    .where(eq(customersTable.id, input.customerId))
    .limit(1);

  if (!customer) {
    throw new Error("Customer not found");
  }

  cityId = cityId ?? customer.cityId ?? null;
  branchId = branchId ?? customer.branchId ?? null;

  // If subscription provided, resolve details
  if (input.subscriptionId) {
    const [sub] = await db
      .select({
        cityId: dcmsSubscriptionsTable.cityId,
        branchId: dcmsSubscriptionsTable.branchId,
      })
      .from(dcmsSubscriptionsTable)
      .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId))
      .limit(1);

    if (sub) {
      cityId = cityId ?? sub.cityId ?? null;
      branchId = branchId ?? sub.branchId ?? null;
    }
  }

  // Resolve field supervisor & SLA policy
  const supervisor = await resolveSupervisorForCustomer(input.customerId);
  const ticketNumber = await generateTicketNumber();
  const slaPolicy = await resolveSlaPolicy({
    cityId,
    category: input.type,
    priority: input.priority || "medium",
  });
  const now = new Date();
  const { responseDueAt, resolutionDueAt } = calculateSlaDeadlines(
    now,
    slaPolicy,
    input.priority || "medium"
  );

  // Create ticket
  const [ticket] = await db
    .insert(complaintsTable)
    .values({
      ticketNumber,
      customerId: input.customerId,
      cityId,
      branchId,
      bookingId: input.bookingId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      visitId: input.visitId ?? null,
      invoiceId: input.invoiceId ?? null,
      operationalExceptionId: input.operationalExceptionId ?? null,
      slaPolicyId: slaPolicy?.id ?? null,
      responseDueAt,
      resolutionDueAt,
      slaStatus: "on_track",
      type: input.type,
      title: input.title,
      description: input.description,
      photoUrl: input.photoUrl ?? null,
      status: supervisor?.id ? "assigned" : "open",
      priority: input.priority || "medium",
      assignedSupervisorId: supervisor?.id ?? null,
    })
    .returning();

  // Add initial message
  await db.insert(supportTicketMessagesTable).values({
    complaintId: ticket.id,
    senderType: "customer",
    senderId: input.customerId,
    senderName: callerName || customer.name || "Customer",
    message: input.description,
    attachmentUrl: input.photoUrl ?? null,
    isInternal: false,
  });

  // Auto-link operational exception if regarding DCMS service
  if (input.subscriptionId && (input.type === "quality" || input.type === "reclean" || input.type === "delay")) {
    const [exception] = await db
      .insert(dcmsOperationalExceptionsTable)
      .values({
        subscriptionId: input.subscriptionId,
        visitId: input.visitId ?? null,
        cityId,
        branchId,
        complaintId: ticket.id,
        exceptionType: "customer_complaint",
        status: "open",
        reason: `${input.type.toUpperCase()}: ${input.title}`,
        notes: input.description,
        evidencePhotoUrl: input.photoUrl ?? null,
      })
      .returning();

    if (exception) {
      await db
        .update(complaintsTable)
        .set({ operationalExceptionId: exception.id })
        .where(eq(complaintsTable.id, ticket.id));
      ticket.operationalExceptionId = exception.id;
    }
  }

  // Dispatch notifications
  await notifyTicketCreated({
    ticketNumber,
    customerId: input.customerId,
    customerName: customer.name,
    title: input.title,
    cityId,
    branchId,
  });

  return ticket;
}

export type ListSupportTicketsFilter = {
  customerId?: number;
  cityId?: number;
  branchId?: number;
  status?: string;
  type?: string;
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listSupportTickets(filter: ListSupportTicketsFilter) {
  const lim = Math.min(filter.limit ?? 50, 100);
  const off = filter.offset ?? 0;
  const conditions = [];

  if (filter.customerId) {
    conditions.push(eq(complaintsTable.customerId, filter.customerId));
  }
  if (filter.cityId) {
    conditions.push(eq(complaintsTable.cityId, filter.cityId));
  }
  if (filter.branchId) {
    conditions.push(eq(complaintsTable.branchId, filter.branchId));
  }
  if (filter.status && filter.status !== "all") {
    conditions.push(eq(complaintsTable.status, filter.status as any));
  }
  if (filter.type && filter.type !== "all") {
    conditions.push(eq(complaintsTable.type, filter.type as any));
  }
  if (filter.priority && filter.priority !== "all") {
    conditions.push(eq(complaintsTable.priority, filter.priority as any));
  }
  if (filter.search && filter.search.trim()) {
    const q = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(complaintsTable.title, q),
        ilike(complaintsTable.description, q),
        ilike(complaintsTable.ticketNumber, q),
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: complaintsTable.id,
        ticketNumber: complaintsTable.ticketNumber,
        customerId: complaintsTable.customerId,
        customerName: customersTable.name,
        customerPhone: customersTable.phone,
        cityId: complaintsTable.cityId,
        cityName: citiesTable.name,
        branchId: complaintsTable.branchId,
        branchName: branchesTable.name,
        subscriptionId: complaintsTable.subscriptionId,
        visitId: complaintsTable.visitId,
        type: complaintsTable.type,
        title: complaintsTable.title,
        description: complaintsTable.description,
        photoUrl: complaintsTable.photoUrl,
        internalNotes: complaintsTable.internalNotes,
        status: complaintsTable.status,
        priority: complaintsTable.priority,
        resolution: complaintsTable.resolution,
        resolvedAt: complaintsTable.resolvedAt,
        assignedSupervisorId: complaintsTable.assignedSupervisorId,
        supervisorName: staffTable.name,
        operationalExceptionId: complaintsTable.operationalExceptionId,
        createdAt: complaintsTable.createdAt,
        updatedAt: complaintsTable.updatedAt,
      })
      .from(complaintsTable)
      .leftJoin(customersTable, eq(complaintsTable.customerId, customersTable.id))
      .leftJoin(citiesTable, eq(complaintsTable.cityId, citiesTable.id))
      .leftJoin(branchesTable, eq(complaintsTable.branchId, branchesTable.id))
      .leftJoin(staffTable, eq(complaintsTable.assignedSupervisorId, staffTable.id))
      .where(where)
      .orderBy(desc(complaintsTable.createdAt))
      .limit(lim)
      .offset(off),
    db
      .select({ count: sql<number>`count(*)` })
      .from(complaintsTable)
      .where(where),
  ]);

  const nowMs = Date.now();
  const enriched = rows.map((r) => {
    const createdMs = new Date(r.createdAt).getTime();
    const isOverdue =
      (r.status === "open" || r.status === "assigned") && nowMs - createdMs > 24 * 3600 * 1000;
    return {
      ...r,
      ticketNumber: r.ticketNumber || `TKT-${String(r.id).padStart(4, "0")}`,
      isOverdue,
    };
  });

  return {
    data: enriched,
    total: Number(countResult[0]?.count ?? 0),
    limit: lim,
    offset: off,
  };
}

export async function getSupportTicketDetail(
  ticketId: number,
  caller: { customerId?: number | null; isStaffOrAdmin?: boolean },
) {
  const [ticket] = await db
    .select({
      id: complaintsTable.id,
      ticketNumber: complaintsTable.ticketNumber,
      customerId: complaintsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      cityId: complaintsTable.cityId,
      cityName: citiesTable.name,
      branchId: complaintsTable.branchId,
      branchName: branchesTable.name,
      subscriptionId: complaintsTable.subscriptionId,
      visitId: complaintsTable.visitId,
      type: complaintsTable.type,
      title: complaintsTable.title,
      description: complaintsTable.description,
      photoUrl: complaintsTable.photoUrl,
      internalNotes: complaintsTable.internalNotes,
      status: complaintsTable.status,
      priority: complaintsTable.priority,
      resolution: complaintsTable.resolution,
      resolvedAt: complaintsTable.resolvedAt,
      assignedSupervisorId: complaintsTable.assignedSupervisorId,
      supervisorName: staffTable.name,
      operationalExceptionId: complaintsTable.operationalExceptionId,
      createdAt: complaintsTable.createdAt,
      updatedAt: complaintsTable.updatedAt,
    })
    .from(complaintsTable)
    .leftJoin(customersTable, eq(complaintsTable.customerId, customersTable.id))
    .leftJoin(citiesTable, eq(complaintsTable.cityId, citiesTable.id))
    .leftJoin(branchesTable, eq(complaintsTable.branchId, branchesTable.id))
    .leftJoin(staffTable, eq(complaintsTable.assignedSupervisorId, staffTable.id))
    .where(eq(complaintsTable.id, ticketId))
    .limit(1);

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  // Customer IDOR Protection: customer can strictly only access their own ticket
  if (caller.customerId && ticket.customerId !== caller.customerId) {
    throw new Error("Access denied: You can only view your own support tickets");
  }

  // Fetch messages thread
  const msgConditions = [eq(supportTicketMessagesTable.complaintId, ticketId)];
  // If customer is requesting, STRICTLY EXCLUDE internal notes
  if (!caller.isStaffOrAdmin) {
    msgConditions.push(eq(supportTicketMessagesTable.isInternal, false));
  }

  const messages = await db
    .select()
    .from(supportTicketMessagesTable)
    .where(and(...msgConditions))
    .orderBy(supportTicketMessagesTable.createdAt);

  // If customer is requesting, also sanitize ticket-level internalNotes
  const sanitizedTicket = {
    ...ticket,
    ticketNumber: ticket.ticketNumber || `TKT-${String(ticket.id).padStart(4, "0")}`,
    internalNotes: caller.isStaffOrAdmin ? ticket.internalNotes : undefined,
    messages,
  };

  return sanitizedTicket;
}

export async function addTicketMessage(
  ticketId: number,
  input: {
    senderType: "customer" | "staff" | "admin" | "system";
    senderId?: number | null;
    senderName: string;
    message: string;
    isInternal?: boolean;
    attachmentUrl?: string | null;
  },
): Promise<SupportTicketMessage> {
  const [ticket] = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.id, ticketId))
    .limit(1);

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  // Security guard: Customers can NEVER create internal notes
  const isInternal = input.senderType === "customer" ? false : Boolean(input.isInternal);

  const [msg] = await db
    .insert(supportTicketMessagesTable)
    .values({
      complaintId: ticketId,
      senderType: input.senderType,
      senderId: input.senderId ?? null,
      senderName: input.senderName,
      message: input.message,
      isInternal,
      attachmentUrl: input.attachmentUrl ?? null,
    })
    .returning();

  // If staff/admin sends an external message, alert the customer
  if (input.senderType !== "customer" && !isInternal) {
    await notifyTicketUpdated({
      ticketNumber: ticket.ticketNumber || `TKT-${ticket.id}`,
      customerId: ticket.customerId,
      messageSummary: input.message.length > 80 ? `${input.message.slice(0, 80)}...` : input.message,
      cityId: ticket.cityId,
      branchId: ticket.branchId,
    });
  }

  // If customer replied and ticket was awaiting customer, advance to in_progress
  if (input.senderType === "customer" && ticket.status === "awaiting_customer") {
    await db
      .update(complaintsTable)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(complaintsTable.id, ticketId));
  }

  return msg;
}

export type ResolveTicketInput = {
  ticketId: number;
  resolution: string;
  action?: "grant_makeup_credit" | "schedule_reclean" | "reassign_staff" | "none";
  resolvedBy: number;
  resolvedByName: string;
  internalNotes?: string;
};

export async function resolveSupportTicket(input: ResolveTicketInput) {
  const [ticket] = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.id, input.ticketId))
    .limit(1);

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const now = new Date();

  // Execute resolution action if requested
  if (input.action === "grant_makeup_credit" && ticket.subscriptionId) {
    // Atomically grant +1 clean credit to customer's subscription
    await db
      .update(dcmsSubscriptionsTable)
      .set({
        remainingCleanings: sql`${dcmsSubscriptionsTable.remainingCleanings} + 1`,
        updatedAt: now,
      })
      .where(eq(dcmsSubscriptionsTable.id, ticket.subscriptionId));

    await logDcmsActivity({
      subscriptionId: ticket.subscriptionId,
      action: "makeup_credit_granted",
      entityType: "subscription",
      entityId: ticket.subscriptionId,
      performedBy: input.resolvedBy,
      metadata: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        reason: input.resolution,
      },
    });
  }

  // If linked operational exception exists, resolve it as well
  if (ticket.operationalExceptionId) {
    await db
      .update(dcmsOperationalExceptionsTable)
      .set({
        status: "resolved",
        resolutionAction: input.action || "resolved_via_ticket",
        resolutionNotes: input.resolution,
        resolvedAt: now,
        resolvedBy: input.resolvedBy,
        updatedAt: now,
      })
      .where(eq(dcmsOperationalExceptionsTable.id, ticket.operationalExceptionId));
  }

  // Update ticket
  const [updatedTicket] = await db
    .update(complaintsTable)
    .set({
      status: "resolved",
      resolution: input.resolution,
      resolvedAt: now,
      internalNotes: input.internalNotes ? `${ticket.internalNotes || ""}\n${input.internalNotes}`.trim() : ticket.internalNotes,
      updatedAt: now,
    })
    .where(eq(complaintsTable.id, input.ticketId))
    .returning();

  // Add system message to ticket thread
  await db.insert(supportTicketMessagesTable).values({
    complaintId: input.ticketId,
    senderType: "system",
    senderId: input.resolvedBy,
    senderName: "Resolution Notice",
    message: `Issue resolved: ${input.resolution}${input.action === "grant_makeup_credit" ? " (+1 complimentary cleaning credit added to your plan)." : ""}`,
    isInternal: false,
  });

  // Dispatch customer notification
  await notifyTicketResolved({
    ticketNumber: ticket.ticketNumber || `TKT-${ticket.id}`,
    customerId: ticket.customerId,
    resolution: input.resolution,
    cityId: ticket.cityId,
    branchId: ticket.branchId,
  });

  return updatedTicket;
}
