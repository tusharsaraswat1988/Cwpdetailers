import {
  db,
  dcmsOperationalExceptionsTable,
  dcmsSubscriptionsTable,
  customersTable,
  vehiclesTable,
  staffTable,
  residentialSocietiesTable,
  citiesTable,
  type DcmsOperationalException,
  type InsertDcmsOperationalException,
} from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";
import { assignStaff } from "./subscriptionService";
import { dispatchNotification } from "../notifications/dispatcher";

export type CreateExceptionInput = {
  subscriptionId: number;
  visitId?: number | null;
  societyId?: number | null;
  cityId?: number | null;
  staffId?: number | null;
  exceptionType: DcmsOperationalException["exceptionType"];
  reason: string;
  notes?: string | null;
  evidencePhotoUrl?: string | null;
  reportedBy?: number | null;
  companyId?: number | null;
  branchId?: number | null;
};

export async function createOperationalException(input: CreateExceptionInput): Promise<DcmsOperationalException> {
  let societyId = input.societyId ?? null;
  let cityId = input.cityId ?? null;
  let companyId = input.companyId ?? null;
  let branchId = input.branchId ?? null;

  if (!societyId || !cityId) {
    const [sub] = await db.select({
      societyId: dcmsSubscriptionsTable.societyId,
      cityId: dcmsSubscriptionsTable.cityId,
      companyId: dcmsSubscriptionsTable.companyId,
      branchId: dcmsSubscriptionsTable.branchId,
    })
      .from(dcmsSubscriptionsTable)
      .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId))
      .limit(1);

    if (sub) {
      societyId = societyId ?? sub.societyId ?? null;
      cityId = cityId ?? sub.cityId ?? null;
      companyId = companyId ?? sub.companyId ?? null;
      branchId = branchId ?? sub.branchId ?? null;
    }
  }

  const [created] = await db.insert(dcmsOperationalExceptionsTable).values({
    subscriptionId: input.subscriptionId,
    visitId: input.visitId ?? null,
    societyId,
    cityId,
    staffId: input.staffId ?? null,
    exceptionType: input.exceptionType,
    status: "open",
    reason: input.reason,
    notes: input.notes ?? null,
    evidencePhotoUrl: input.evidencePhotoUrl ?? null,
    reportedBy: input.reportedBy ?? null,
    companyId,
    branchId,
  }).returning();

  await logDcmsActivity({
    subscriptionId: input.subscriptionId,
    action: "exception_reported",
    entityType: "exception",
    entityId: created!.id,
    performedBy: input.reportedBy ?? 0,
    metadata: {
      exceptionType: input.exceptionType,
      reason: input.reason,
      societyId,
    },
  });

  return created!;
}

export type ListExceptionsFilter = {
  societyId?: number;
  cityId?: number;
  staffId?: number;
  subscriptionId?: number;
  status?: DcmsOperationalException["status"];
  exceptionType?: DcmsOperationalException["exceptionType"];
  limit?: number;
  offset?: number;
};

export async function listOperationalExceptions(filters?: ListExceptionsFilter) {
  const lim = Math.min(filters?.limit ?? 50, 100);
  const off = filters?.offset ?? 0;

  const conditions = [];
  if (filters?.societyId) conditions.push(eq(dcmsOperationalExceptionsTable.societyId, filters.societyId));
  if (filters?.cityId) conditions.push(eq(dcmsOperationalExceptionsTable.cityId, filters.cityId));
  if (filters?.staffId) conditions.push(eq(dcmsOperationalExceptionsTable.staffId, filters.staffId));
  if (filters?.subscriptionId) conditions.push(eq(dcmsOperationalExceptionsTable.subscriptionId, filters.subscriptionId));
  if (filters?.status) conditions.push(eq(dcmsOperationalExceptionsTable.status, filters.status));
  if (filters?.exceptionType) conditions.push(eq(dcmsOperationalExceptionsTable.exceptionType, filters.exceptionType));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db.select({
    id: dcmsOperationalExceptionsTable.id,
    subscriptionId: dcmsOperationalExceptionsTable.subscriptionId,
    visitId: dcmsOperationalExceptionsTable.visitId,
    societyId: dcmsOperationalExceptionsTable.societyId,
    societyName: residentialSocietiesTable.name,
    cityId: dcmsOperationalExceptionsTable.cityId,
    cityName: citiesTable.name,
    staffId: dcmsOperationalExceptionsTable.staffId,
    staffName: staffTable.name,
    exceptionType: dcmsOperationalExceptionsTable.exceptionType,
    status: dcmsOperationalExceptionsTable.status,
    reason: dcmsOperationalExceptionsTable.reason,
    notes: dcmsOperationalExceptionsTable.notes,
    evidencePhotoUrl: dcmsOperationalExceptionsTable.evidencePhotoUrl,
    reportedAt: dcmsOperationalExceptionsTable.reportedAt,
    resolutionAction: dcmsOperationalExceptionsTable.resolutionAction,
    resolutionNotes: dcmsOperationalExceptionsTable.resolutionNotes,
    resolvedAt: dcmsOperationalExceptionsTable.resolvedAt,
    customerId: dcmsSubscriptionsTable.customerId,
    customerName: customersTable.name,
    customerPhone: customersTable.phone,
    vehicleNumber: vehiclesTable.registrationNumber,
    parkingBay: dcmsSubscriptionsTable.parkingBay,
  })
    .from(dcmsOperationalExceptionsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsOperationalExceptionsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .leftJoin(staffTable, eq(dcmsOperationalExceptionsTable.staffId, staffTable.id))
    .leftJoin(residentialSocietiesTable, eq(dcmsOperationalExceptionsTable.societyId, residentialSocietiesTable.id))
    .leftJoin(citiesTable, eq(dcmsOperationalExceptionsTable.cityId, citiesTable.id))
    .where(where)
    .orderBy(desc(dcmsOperationalExceptionsTable.reportedAt))
    .limit(lim)
    .offset(off);

  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(dcmsOperationalExceptionsTable)
    .where(where);

  return {
    data: rows,
    total: Number(countResult?.count ?? 0),
    limit: lim,
    offset: off,
  };
}

export type ResolveExceptionInput = {
  exceptionId: number;
  action: "grant_makeup_credit" | "reassign_staff" | "schedule_reclean" | "dismiss";
  resolutionNotes: string;
  resolvedBy: number;
  newStaffId?: number;
};

export async function resolveOperationalException(input: ResolveExceptionInput): Promise<DcmsOperationalException> {
  const [existing] = await db.select()
    .from(dcmsOperationalExceptionsTable)
    .where(eq(dcmsOperationalExceptionsTable.id, input.exceptionId))
    .limit(1);

  if (!existing) {
    throw new Error("Operational exception not found");
  }
  if (existing.status === "resolved" || existing.status === "dismissed") {
    throw new Error(`Exception is already ${existing.status}`);
  }

  const [sub] = await db.select()
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, existing.subscriptionId))
    .limit(1);

  if (!sub) {
    throw new Error("Associated subscription not found");
  }

  const [vehicle] = await db.select({ reg: vehiclesTable.registrationNumber })
    .from(vehiclesTable)
    .where(eq(vehiclesTable.id, sub.vehicleId))
    .limit(1);

  const [customer] = await db.select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, sub.customerId))
    .limit(1);

  const now = new Date();

  // Execute resolution action
  if (input.action === "grant_makeup_credit") {
    // Atomically grant +1 cleaning credit
    await db.update(dcmsSubscriptionsTable)
      .set({
        remainingCleanings: sql`${dcmsSubscriptionsTable.remainingCleanings} + 1`,
        updatedAt: now,
      })
      .where(eq(dcmsSubscriptionsTable.id, sub.id));

    await logDcmsActivity({
      subscriptionId: sub.id,
      action: "makeup_credit_granted",
      entityType: "subscription",
      entityId: sub.id,
      performedBy: input.resolvedBy,
      metadata: {
        exceptionId: existing.id,
        reason: input.resolutionNotes,
      },
    });

    // Notify customer
    await dispatchNotification({
      template: "complaint_update",
      customerId: sub.customerId,
      vars: {
        customerName: customer?.name ?? "Customer",
        status: "Resolved (1 Make-Up Cleaning Credit Added)",
        resolution: input.resolutionNotes || "Make-up cleaning credit added to your active subscription.",
      },
      dedupeKey: `exception:${existing.id}:resolved:credit`,
      companyId: sub.companyId,
      branchId: sub.branchId,
    }).catch(() => {});
  } else if (input.action === "reassign_staff") {
    if (!input.newStaffId) {
      throw new Error("newStaffId is required for staff reassignment");
    }

    await assignStaff(sub.id, input.newStaffId, input.resolvedBy);

    await logDcmsActivity({
      subscriptionId: sub.id,
      action: "staff_reassigned_via_exception",
      entityType: "subscription",
      entityId: sub.id,
      performedBy: input.resolvedBy,
      metadata: {
        exceptionId: existing.id,
        newStaffId: input.newStaffId,
      },
    });
  } else if (input.action === "schedule_reclean") {
    await logDcmsActivity({
      subscriptionId: sub.id,
      action: "reclean_scheduled",
      entityType: "subscription",
      entityId: sub.id,
      performedBy: input.resolvedBy,
      metadata: {
        exceptionId: existing.id,
        notes: input.resolutionNotes,
      },
    });

    await dispatchNotification({
      template: "complaint_update",
      customerId: sub.customerId,
      vars: {
        customerName: customer?.name ?? "Customer",
        status: "Re-clean Scheduled",
        resolution: input.resolutionNotes || "A supervisor has scheduled a priority re-cleaning for your vehicle.",
      },
      dedupeKey: `exception:${existing.id}:reclean_scheduled`,
      companyId: sub.companyId,
      branchId: sub.branchId,
    }).catch(() => {});
  }

  const finalStatus = input.action === "dismiss" ? "dismissed" : "resolved";

  const [updated] = await db.update(dcmsOperationalExceptionsTable)
    .set({
      status: finalStatus,
      resolutionAction: input.action,
      resolutionNotes: input.resolutionNotes,
      resolvedAt: now,
      resolvedBy: input.resolvedBy,
      updatedAt: now,
    })
    .where(eq(dcmsOperationalExceptionsTable.id, input.exceptionId))
    .returning();

  await logDcmsActivity({
    subscriptionId: sub.id,
    action: "exception_resolved",
    entityType: "exception",
    entityId: existing.id,
    performedBy: input.resolvedBy,
    metadata: {
      action: input.action,
      status: finalStatus,
    },
  });

  return updated!;
}
