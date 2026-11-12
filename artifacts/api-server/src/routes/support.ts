import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  createSupportTicket,
  listSupportTickets,
  getSupportTicketDetail,
  addTicketMessage,
  resolveSupportTicket,
} from "../lib/support/supportTicketService";
import { handleSlaClockTransition } from "../lib/quality/slaService";
import { db, complaintsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── List Support Tickets ───────────────────────────────────────────────────

router.get("/support/tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const isCustomer = req.user!.role === "customer" || Boolean(req.user!.customerId);
    const isAdmin = req.scope?.isSuperAdmin || ["admin", "superadmin", "manager"].includes(req.user?.role ?? "");
    const isStaff = req.user?.role === "staff" || Boolean(req.user?.staffId);

    const customerId = isCustomer ? req.user!.customerId : req.query.customerId ? Number(req.query.customerId) : undefined;
    const cityId = req.query.cityId ? Number(req.query.cityId) : (req.scope?.branchIds ? undefined : undefined);
    const branchId = req.query.branchId ? Number(req.query.branchId) : (req.scope?.branchIds?.[0] ?? undefined);

    const result = await listSupportTickets({
      customerId: customerId ?? undefined,
      cityId,
      branchId,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      type: typeof req.query.type === "string" ? req.query.type : undefined,
      priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });

    return res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "List support tickets error");
    return res.status(500).json({ error: err.message || "Failed to list support tickets" });
  }
});

// ─── Create Support Ticket ──────────────────────────────────────────────────

router.post("/support/tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const isCustomer = req.user!.role === "customer" || Boolean(req.user!.customerId);
    const customerId = isCustomer ? req.user!.customerId : Number(req.body.customerId);

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID required to create a ticket" });
    }

    const {
      type,
      priority,
      title,
      description,
      photoUrl,
      subscriptionId,
      visitId,
      invoiceId,
      bookingId,
      cityId,
      branchId,
    } = req.body;

    if (!type || !title || !description) {
      return res.status(400).json({ error: "type, title, and description are required" });
    }

    const ticket = await createSupportTicket(
      {
        customerId,
        type,
        priority,
        title,
        description,
        photoUrl: photoUrl || null,
        subscriptionId: subscriptionId ? Number(subscriptionId) : null,
        visitId: visitId ? Number(visitId) : null,
        invoiceId: invoiceId ? Number(invoiceId) : null,
        bookingId: bookingId ? Number(bookingId) : null,
        cityId: cityId ? Number(cityId) : null,
        branchId: branchId ? Number(branchId) : null,
      },
      req.user!.name,
    );

    return res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    req.log.error({ err }, "Create support ticket error");
    return res.status(500).json({ error: err.message || "Failed to create support ticket" });
  }
});

// ─── Get Ticket Details & Messages ──────────────────────────────────────────

router.get("/support/tickets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const isCustomer = req.user!.role === "customer" || Boolean(req.user!.customerId);
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager", "staff"].includes(req.user?.role ?? "");

    const ticket = await getSupportTicketDetail(ticketId, {
      customerId: isCustomer ? req.user!.customerId : null,
      isStaffOrAdmin,
    });

    return res.json(ticket);
  } catch (err: any) {
    if (err.message?.includes("Access denied")) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message?.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    req.log.error({ err }, "Get support ticket detail error");
    return res.status(500).json({ error: err.message || "Failed to fetch ticket" });
  }
});

// ─── Add Message / Update to Ticket Thread ──────────────────────────────────

router.post("/support/tickets/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const isCustomer = req.user!.role === "customer" || Boolean(req.user!.customerId);
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager", "staff"].includes(req.user?.role ?? "");

    // Verify ownership before allowing a message
    if (isCustomer) {
      const [existing] = await db
        .select({ customerId: complaintsTable.customerId })
        .from(complaintsTable)
        .where(eq(complaintsTable.id, ticketId))
        .limit(1);

      if (!existing || existing.customerId !== req.user!.customerId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const { message, isInternal, attachmentUrl } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const senderType = isCustomer
      ? "customer"
      : req.user!.role === "staff"
      ? "staff"
      : "admin";

    const msg = await addTicketMessage(ticketId, {
      senderType,
      senderId: req.user!.id,
      senderName: req.user!.name || (isCustomer ? "Customer" : "Support Team"),
      message: message.trim(),
      isInternal: isCustomer ? false : Boolean(isInternal),
      attachmentUrl: attachmentUrl || null,
    });

    return res.status(201).json(msg);
  } catch (err: any) {
    req.log.error({ err }, "Add ticket message error");
    return res.status(500).json({ error: err.message || "Failed to add message" });
  }
});

// ─── Update Ticket Status / Priority ────────────────────────────────────────

router.patch("/support/tickets/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager", "staff"].includes(req.user?.role ?? "");

    if (!isStaffOrAdmin) {
      return res.status(403).json({ error: "Staff or Admin authorization required" });
    }

    const ticketId = Number(req.params.id);
    const { status, priority, assignedSupervisorId, internalNotes } = req.body;

    const [existing] = await db
      .select({ id: complaintsTable.id, status: complaintsTable.status })
      .from(complaintsTable)
      .where(eq(complaintsTable.id, ticketId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (status && status !== existing.status) {
      await handleSlaClockTransition(ticketId, existing.status, status);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedSupervisorId !== undefined) updateData.assignedSupervisorId = assignedSupervisorId;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;

    const [updated] = await db
      .update(complaintsTable)
      .set(updateData)
      .where(eq(complaintsTable.id, ticketId))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    req.log.error({ err }, "Update ticket status error");
    return res.status(500).json({ error: err.message || "Failed to update ticket" });
  }
});

// ─── Resolve Ticket with Actions ────────────────────────────────────────────

router.post("/support/tickets/:id/resolve", requireAuth, async (req: Request, res: Response) => {
  try {
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager", "staff"].includes(req.user?.role ?? "");

    if (!isStaffOrAdmin) {
      return res.status(403).json({ error: "Staff or Admin authorization required" });
    }

    const ticketId = Number(req.params.id);
    const { resolution, action, internalNotes } = req.body;

    if (!resolution || !resolution.trim()) {
      return res.status(400).json({ error: "Resolution reason is required" });
    }

    const resolved = await resolveSupportTicket({
      ticketId,
      resolution: resolution.trim(),
      action: action || "none",
      resolvedBy: req.user!.id,
      resolvedByName: req.user!.name,
      internalNotes,
    });

    return res.json({ success: true, ticket: resolved });
  } catch (err: any) {
    req.log.error({ err }, "Resolve ticket error");
    return res.status(500).json({ error: err.message || "Failed to resolve ticket" });
  }
});

export default router;
