import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  paymentsTable,
  paymentAttemptsTable,
  paymentRefundsTable,
  customersTable,
  invoicesTable,
  branchesTable,
  bookingsTable,
  adminAuditLogsTable,
} from "@workspace/db";
import { eq, and, sql, desc, gte, lte, or, inArray, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getRefundableBalance, initiateRefund } from "../lib/payments/refundService";
import { runReconciliationAnalysis, manualReconcileOrder } from "../lib/payments/reconciliationService";
import { getRevenueIntelligence } from "../lib/payments/revenueIntelligenceService";

const router = Router();

export interface AdminLedgerRow {
  id: string;
  sourceType: "payment" | "payment_attempt";
  paymentId: number | null;
  attemptId: string | null;
  paymentDate: string;
  paymentDateIst: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  city: string;
  branchId: number | null;
  branchName: string | null;
  bookingId: number | null;
  bookingRef: string | null;
  bookingDate?: string | null;
  serviceType: string;
  serviceDescription: string;
  paymentAmount: number; // Stated or Invoice Amount
  discount: number;
  amountPaid: number; // Final Paid Amount
  remainingDue: number | null;
  paymentMethod: string;
  cfOrderId: string | null;
  cfPaymentId: string | null;
  internalReference: string;
  status:
    | "initiated"
    | "pending"
    | "paid"
    | "failed"
    | "cancelled"
    | "partially_refunded"
    | "refunded"
    | "requires_reconciliation";
  refundStatus: "none" | "partial" | "refunded";
  refundedAmount: number;
  lastUpdated: string;
  lastUpdatedIst: string;
  notes: string | null;
  subscriptionId?: number | null;
  rawWebhookPayload?: Record<string, unknown> | null;
  rawVerificationPayload?: Record<string, unknown> | null;
}

export interface AdminLedgerSummary {
  todayCollected: number;
  todayTransactionsCount: number;
  thisMonthCollected: number;
  pendingTransactionsCount: number;
  failedTransactionsCount: number;
  totalCollectedAllTime: number;
  totalOutstandingCustomerDues: number;
  calculatedAtIst: string;
}

/**
 * Security: Guard strictly to central admin/superadmin roles.
 */
function requireAdminRole(req: Request, res: Response, next: () => void) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }

  const isCentral =
    user.role === "superadmin" ||
    user.role === "central_admin" ||
    (user.role === "admin" && (user.branchId == null || user.branchId === 0));

  if (!isCentral) {
    return res.status(403).json({
      error: "Access denied. Central administrator privileges required to access the central payment ledger.",
      code: "FORBIDDEN",
    });
  }
  next();
}

/**
 * Format timestamp into exact IST (Asia/Kolkata) readable string
 * Example: "14 Nov 2026, 02:45 PM"
 */
function formatIstDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(dateObj);
}

function maskCustomerPhone(phone: string | null | undefined, isSuperAdmin: boolean): string {
  if (!phone) return "—";
  if (isSuperAdmin) return phone;
  const clean = phone.trim();
  if (clean.length < 6) return clean;
  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
}

/**
 * Compute IST date boundaries for Today and This Month (Asia/Kolkata timezone)
 */
function getIstSummaryBounds() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayYmd = formatter.format(now);
  const [year, month] = todayYmd.split("-");

  const startOfTodayUtc = new Date(`${todayYmd}T00:00:00+05:30`);
  const endOfTodayUtc = new Date(`${todayYmd}T23:59:59.999+05:30`);
  const startOfMonthUtc = new Date(`${year}-${month}-01T00:00:00+05:30`);

  return { startOfTodayUtc, endOfTodayUtc, startOfMonthUtc };
}

function parseIstDateFilterBounds(startDateStr?: string, endDateStr?: string) {
  let startUtc: Date | undefined = undefined;
  let endUtc: Date | undefined = undefined;

  if (startDateStr && startDateStr.trim()) {
    const s = new Date(`${startDateStr.trim()}T00:00:00+05:30`);
    if (!isNaN(s.getTime())) startUtc = s;
  }
  if (endDateStr && endDateStr.trim()) {
    const e = new Date(`${endDateStr.trim()}T23:59:59.999+05:30`);
    if (!isNaN(e.getTime())) endUtc = e;
  }

  return { startUtc, endUtc };
}

function deriveServiceDescription(invoice: any, paymentNotes?: string | null): string {
  if (invoice?.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
    const descriptions = invoice.items
      .map((item: any) => item.description || item.name || item.title)
      .filter(Boolean);
    if (descriptions.length > 0) {
      return (
        descriptions.slice(0, 2).join(", ") +
        (descriptions.length > 2 ? ` (+${descriptions.length - 2} more)` : "")
      );
    }
  }
  if (paymentNotes && !paymentNotes.startsWith("Cashfree payment for order")) {
    return paymentNotes;
  }
  return "Doorstep Detailing & Vehicle Care Services";
}

function deriveServiceType(invoice: any, booking: any, notes?: string | null): string {
  if (booking?.serviceType) {
    return booking.serviceType;
  }
  if (invoice?.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
    const desc = (invoice.items[0].description || "").toLowerCase();
    if (desc.includes("daily") || desc.includes("cleaning")) return "daily_cleaning";
    if (desc.includes("wash")) return "car_wash";
    if (desc.includes("ceramic") || desc.includes("ppf") || desc.includes("coating")) return "detailing";
    if (desc.includes("solar")) return "solar_cleaning";
  }
  const n = (notes || "").toLowerCase();
  if (n.includes("subscription") || n.includes("dcms")) return "daily_cleaning";
  return "car_wash";
}

/**
 * Fetch unified ledger entries combining completed payments with active/pending/failed gateway attempts
 */
async function fetchUnifiedLedger(options: {
  search?: string;
  status?: string;
  refundStatus?: string;
  method?: string;
  city?: string;
  branchId?: number;
  serviceType?: string;
  startDate?: string;
  endDate?: string;
  invoiceId?: number;
  customerId?: number;
  isSuperAdmin?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminLedgerRow[]; total: number }> {
  const {
    search,
    status = "all",
    refundStatus = "all",
    method = "all",
    city,
    branchId,
    serviceType = "all",
    startDate,
    endDate,
    invoiceId,
    customerId,
    isSuperAdmin = false,
    limit = 50,
    offset = 0,
  } = options;

  const { startUtc, endUtc } = parseIstDateFilterBounds(startDate, endDate);

  // 1. Fetch completed & reversed payments from paymentsTable
  const paymentConditions = [];
  if (customerId) paymentConditions.push(eq(paymentsTable.customerId, customerId));
  if (invoiceId) paymentConditions.push(eq(paymentsTable.invoiceId, invoiceId));
  if (startUtc) paymentConditions.push(gte(paymentsTable.createdAt, startUtc));
  if (endUtc) paymentConditions.push(lte(paymentsTable.createdAt, endUtc));

  if (method !== "all") {
    paymentConditions.push(eq(paymentsTable.method, method as any));
  }

  const paymentsQuery = db
    .select({
      payment: paymentsTable,
      customer: customersTable,
      invoice: invoicesTable,
      attempt: paymentAttemptsTable,
      branch: branchesTable,
      booking: bookingsTable,
    })
    .from(paymentsTable)
    .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
    .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
    .leftJoin(paymentAttemptsTable, eq(paymentsTable.transactionId, paymentAttemptsTable.cfOrderId))
    .leftJoin(branchesTable, eq(invoicesTable.branchId, branchesTable.id))
    .leftJoin(bookingsTable, eq(invoicesTable.bookingId, bookingsTable.id))
    .where(paymentConditions.length > 0 ? and(...paymentConditions) : undefined)
    .orderBy(desc(paymentsTable.createdAt));

  const paymentRecords = await paymentsQuery;

  // 2. Fetch pending, active, and failed attempts from paymentAttemptsTable
  // Only where status != 'paid' (to avoid duplicate with settled payments)
  const attemptConditions = [sql`${paymentAttemptsTable.status} != 'paid'`];
  if (customerId) attemptConditions.push(eq(paymentAttemptsTable.customerId, customerId));
  if (invoiceId) attemptConditions.push(eq(paymentAttemptsTable.invoiceId, invoiceId));
  if (startUtc) attemptConditions.push(gte(paymentAttemptsTable.createdAt, startUtc));
  if (endUtc) attemptConditions.push(lte(paymentAttemptsTable.createdAt, endUtc));

  let attemptRecords: Array<{
    attempt: typeof paymentAttemptsTable.$inferSelect;
    customer: typeof customersTable.$inferSelect | null;
    invoice: typeof invoicesTable.$inferSelect | null;
    branch: typeof branchesTable.$inferSelect | null;
    booking: typeof bookingsTable.$inferSelect | null;
  }> = [];

  const lowerMethod = method.toLowerCase();
  if (lowerMethod === "all" || lowerMethod === "cashfree" || lowerMethod === "razorpay") {
    if (lowerMethod === "cashfree") {
      attemptConditions.push(eq(paymentAttemptsTable.gatewayProvider, "cashfree"));
    } else if (lowerMethod === "razorpay") {
      attemptConditions.push(eq(paymentAttemptsTable.gatewayProvider, "razorpay"));
    }

    const attemptsQuery = db
      .select({
        attempt: paymentAttemptsTable,
        customer: customersTable,
        invoice: invoicesTable,
        branch: branchesTable,
        booking: bookingsTable,
      })
      .from(paymentAttemptsTable)
      .leftJoin(customersTable, eq(paymentAttemptsTable.customerId, customersTable.id))
      .leftJoin(invoicesTable, eq(paymentAttemptsTable.invoiceId, invoicesTable.id))
      .leftJoin(
        branchesTable,
        or(
          eq(paymentAttemptsTable.branchId, branchesTable.id),
          eq(invoicesTable.branchId, branchesTable.id),
        ),
      )
      .leftJoin(bookingsTable, eq(invoicesTable.bookingId, bookingsTable.id))
      .where(and(...attemptConditions))
      .orderBy(desc(paymentAttemptsTable.createdAt));

    attemptRecords = await attemptsQuery;
  }

  // 3. Transform paymentRecords to AdminLedgerRow
  const rows: AdminLedgerRow[] = [];

  for (const { payment, customer, invoice, attempt, branch, booking } of paymentRecords) {
    const paymentDateObj = payment.receivedAt || payment.createdAt;
    const effectiveCity = customer?.city?.trim() || "Varanasi";
    const invoiceBal = invoice ? parseFloat(invoice.balanceDue ?? invoice.dueAmount ?? "0") : 0;
    const invTotal = invoice ? parseFloat(invoice.totalAmount ?? "0") : parseFloat(payment.amount);
    const invDiscount = invoice ? parseFloat(invoice.discount ?? "0") : 0;
    const effectiveBranchId = invoice?.branchId ?? attempt?.branchId ?? null;
    const bookingId = payment.bookingId ?? invoice?.bookingId ?? booking?.id ?? null;

    let rowStatus: AdminLedgerRow["status"] = "paid";
    if (payment.status === "reversed") {
      rowStatus = "cancelled";
    } else if (payment.refundStatus === "refunded" || payment.status === "refunded") {
      rowStatus = "refunded";
    } else if (payment.refundStatus === "partial") {
      rowStatus = "partially_refunded";
    } else if (payment.reconciliationStatus === "mismatch") {
      rowStatus = "requires_reconciliation";
    }

    const refStatus = (payment.refundStatus || "none") as AdminLedgerRow["refundStatus"];
    const refAmount = parseFloat(payment.refundedAmount || "0");

    rows.push({
      id: `pay_${payment.id}`,
      sourceType: "payment",
      paymentId: payment.id,
      attemptId: attempt?.attemptId ?? null,
      paymentDate: (paymentDateObj instanceof Date ? paymentDateObj : new Date(paymentDateObj)).toISOString(),
      paymentDateIst: formatIstDateTime(paymentDateObj),
      customerId: payment.customerId,
      customerName: customer?.name?.trim() || "Customer",
      customerPhone: maskCustomerPhone(customer?.phone, isSuperAdmin),
      city: effectiveCity,
      branchId: effectiveBranchId,
      branchName: branch?.name ?? null,
      bookingId,
      bookingRef: bookingId ? `BK-${bookingId}` : null,
      bookingDate: booking?.scheduledDate ? String(booking.scheduledDate) : null,
      serviceType: deriveServiceType(invoice, booking, payment.notes),
      serviceDescription: deriveServiceDescription(invoice, payment.notes),
      paymentAmount: invTotal,
      discount: invDiscount,
      amountPaid: parseFloat(payment.amount),
      remainingDue: invoiceBal >= 0 ? invoiceBal : 0,
      paymentMethod: payment.method || attempt?.gatewayProvider || "cashfree",
      cfOrderId:
        attempt?.gatewayOrderId ||
        attempt?.rzpOrderId ||
        attempt?.cfOrderId ||
        (payment.method === "cashfree" || payment.method === "razorpay" ? payment.transactionId : null),
      cfPaymentId: attempt?.rzpPaymentId || attempt?.cfPaymentId || null,
      internalReference: attempt?.attemptId || payment.transactionId || `PAY-${payment.id}`,
      status: rowStatus,
      refundStatus: refStatus,
      refundedAmount: refAmount,
      lastUpdated: (payment.createdAt instanceof Date ? payment.createdAt : new Date(payment.createdAt)).toISOString(),
      lastUpdatedIst: formatIstDateTime(payment.createdAt),
      notes: payment.notes ?? null,
      subscriptionId: attempt?.subscriptionId ?? null,
      rawWebhookPayload: attempt?.rawWebhookPayload ?? null,
      rawVerificationPayload: attempt?.rawVerificationPayload ?? null,
    });
  }

  // 4. Transform attemptRecords to AdminLedgerRow
  for (const { attempt, customer, invoice, branch, booking } of attemptRecords) {
    const attemptDateObj = attempt.updatedAt || attempt.createdAt;
    const effectiveCity = customer?.city?.trim() || "Varanasi";
    const invoiceBal = invoice ? parseFloat(invoice.balanceDue ?? invoice.dueAmount ?? "0") : null;
    const invTotal = invoice ? parseFloat(invoice.totalAmount ?? "0") : parseFloat(attempt.amount);
    const invDiscount = invoice ? parseFloat(invoice.discount ?? "0") : 0;
    const effectiveBranchId = attempt.branchId ?? invoice?.branchId ?? null;
    const bookingId = attempt.bookingId ?? invoice?.bookingId ?? booking?.id ?? null;

    let mappedStatus: AdminLedgerRow["status"] = "pending";
    if (attempt.status === "initiated") {
      mappedStatus = "initiated";
    } else if (attempt.status === "active") {
      mappedStatus = "pending";
    } else if (attempt.status === "failed") {
      mappedStatus = "failed";
    } else if (attempt.status === "user_dropped" || attempt.status === "expired") {
      mappedStatus = "cancelled";
    }

    rows.push({
      id: `att_${attempt.id}`,
      sourceType: "payment_attempt",
      paymentId: null,
      attemptId: attempt.attemptId,
      paymentDate: (attemptDateObj instanceof Date ? attemptDateObj : new Date(attemptDateObj)).toISOString(),
      paymentDateIst: formatIstDateTime(attemptDateObj),
      customerId: attempt.customerId,
      customerName: customer?.name?.trim() || "Customer",
      customerPhone: maskCustomerPhone(customer?.phone, isSuperAdmin),
      city: effectiveCity,
      branchId: effectiveBranchId,
      branchName: branch?.name ?? null,
      bookingId,
      bookingRef: bookingId ? `BK-${bookingId}` : null,
      bookingDate: booking?.scheduledDate ? String(booking.scheduledDate) : null,
      serviceType: deriveServiceType(invoice, booking, null),
      serviceDescription: deriveServiceDescription(invoice, null),
      paymentAmount: invTotal,
      discount: invDiscount,
      amountPaid: parseFloat(attempt.amount),
      remainingDue: invoiceBal != null && !isNaN(invoiceBal) ? invoiceBal : null,
      paymentMethod: attempt.gatewayProvider || attempt.paymentMethod || "cashfree",
      cfOrderId: attempt.gatewayOrderId || attempt.rzpOrderId || attempt.cfOrderId,
      cfPaymentId: attempt.rzpPaymentId || attempt.cfPaymentId || null,
      internalReference: attempt.attemptId,
      status: mappedStatus,
      refundStatus: "none",
      refundedAmount: 0,
      lastUpdated: (attempt.updatedAt instanceof Date ? attempt.updatedAt : new Date(attempt.updatedAt)).toISOString(),
      lastUpdatedIst: formatIstDateTime(attempt.updatedAt),
      notes: `${attempt.gatewayProvider === "razorpay" ? "Razorpay" : "Cashfree"} gateway attempt (${attempt.status})`,
      subscriptionId: attempt.subscriptionId ?? null,
      rawWebhookPayload: attempt.rawWebhookPayload ?? null,
      rawVerificationPayload: attempt.rawVerificationPayload ?? null,
    });
  }

  // 5. In-memory unified filtering and sorting
  let filtered = rows;

  if (status !== "all") {
    const targetStatus = status.toLowerCase();
    filtered = filtered.filter((r) => {
      if (targetStatus === "paid" && (r.status === "paid" || (r as any).status === "success")) return true;
      return r.status.toLowerCase() === targetStatus;
    });
  }

  if (refundStatus !== "all") {
    filtered = filtered.filter((r) => r.refundStatus.toLowerCase() === refundStatus.toLowerCase());
  }

  if (serviceType !== "all") {
    filtered = filtered.filter((r) => r.serviceType.toLowerCase() === serviceType.toLowerCase());
  }

  if (city && city.trim() && city.toLowerCase() !== "all") {
    const cTarget = city.trim().toLowerCase();
    filtered = filtered.filter((r) => r.city.toLowerCase() === cTarget);
  }

  if (branchId) {
    filtered = filtered.filter((r) => r.branchId === branchId);
  }

  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.customerName.toLowerCase().includes(s) ||
        r.customerPhone.toLowerCase().includes(s) ||
        String(r.customerId).includes(s) ||
        (r.bookingRef && r.bookingRef.toLowerCase().includes(s)) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(s)) ||
        (r.cfOrderId && r.cfOrderId.toLowerCase().includes(s)) ||
        (r.cfPaymentId && r.cfPaymentId.toLowerCase().includes(s)) ||
        r.internalReference.toLowerCase().includes(s) ||
        r.serviceDescription.toLowerCase().includes(s),
    );
  }

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return { rows: paginated, total };
}

/**
 * GET /api/admin/payments/ledger/summary
 */
router.get("/admin/payments/ledger/summary", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { startOfTodayUtc, endOfTodayUtc, startOfMonthUtc } = getIstSummaryBounds();

    const [todayResult] = await db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.status, "completed"),
          gte(paymentsTable.createdAt, startOfTodayUtc),
          lte(paymentsTable.createdAt, endOfTodayUtc),
        ),
      );

    const [monthResult] = await db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.status, "completed"),
          gte(paymentsTable.createdAt, startOfMonthUtc),
        ),
      );

    const [allTimeResult] = await db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "completed"));

    const [pendingResult] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(paymentAttemptsTable)
      .where(inArray(paymentAttemptsTable.status, ["initiated", "active"]));

    const [failedResult] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(paymentAttemptsTable)
      .where(inArray(paymentAttemptsTable.status, ["failed", "user_dropped"]));

    const [duesResult] = await db
      .select({
        totalDues: sql<string>`COALESCE(SUM(CAST(balance_due AS numeric)), 0)`,
      })
      .from(invoicesTable)
      .where(
        and(
          sql`CAST(balance_due AS numeric) > 0`,
          sql`status != 'cancelled'`,
          eq(invoicesTable.documentType, "tax_invoice"),
        ),
      );

    const summary: AdminLedgerSummary = {
      todayCollected: parseFloat(todayResult?.totalAmount ?? "0"),
      todayTransactionsCount: Number(todayResult?.count ?? 0),
      thisMonthCollected: parseFloat(monthResult?.totalAmount ?? "0"),
      pendingTransactionsCount: Number(pendingResult?.count ?? 0),
      failedTransactionsCount: Number(failedResult?.count ?? 0),
      totalCollectedAllTime: parseFloat(allTimeResult?.totalAmount ?? "0"),
      totalOutstandingCustomerDues: parseFloat(duesResult?.totalDues ?? "0"),
      calculatedAtIst: formatIstDateTime(new Date()),
    };

    return res.json(summary);
  } catch (err: any) {
    logger.error({ err: err.message }, "[ADMIN_LEDGER] Error computing summary");
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to compute ledger summary metrics",
      detail: err?.message,
    });
  }
});

/**
 * GET /api/admin/payments/ledger
 */
router.get("/admin/payments/ledger", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "25",
      search,
      status,
      refundStatus,
      method,
      city,
      branchId: branchIdParam,
      serviceType,
      startDate,
      endDate,
      invoiceId,
      customerId,
    } = req.query as Record<string, string | undefined>;

    const isSuperAdmin = req.user?.role === "superadmin";
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const result = await fetchUnifiedLedger({
      search,
      status,
      refundStatus,
      method,
      city,
      branchId: branchIdParam ? parseInt(branchIdParam, 10) : undefined,
      serviceType,
      startDate,
      endDate,
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      isSuperAdmin,
      limit: limitNum,
      offset,
    });

    return res.json({
      data: result.rows,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum) || 1,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "[ADMIN_LEDGER] Error fetching ledger list");
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to fetch payment ledger entries",
      detail: err?.message,
    });
  }
});

/**
 * GET /api/admin/payments/ledger/export
 */
router.get("/api/admin/payments/ledger/export", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      refundStatus,
      method,
      city,
      serviceType,
      startDate,
      endDate,
      invoiceId,
      customerId,
    } = req.query as Record<string, string | undefined>;

    const isSuperAdmin = req.user?.role === "superadmin";

    const result = await fetchUnifiedLedger({
      search,
      status,
      refundStatus,
      method,
      city,
      serviceType,
      startDate,
      endDate,
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      isSuperAdmin,
      limit: 5000,
      offset: 0,
    });

    // Audit log financial export
    await db.insert(adminAuditLogsTable).values({
      userId: req.user!.id,
      action: "payment.ledger_exported",
      resourceType: "payment_ledger",
      resourceId: "export_csv",
      previousValues: null,
      newValues: { recordCount: result.rows.length, filters: req.query },
      reason: "Financial export for accounting audit",
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
      createdAt: new Date(),
    });

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "Payment Date & Time (IST)",
      "Customer Name",
      "Customer Phone",
      "Customer ID",
      "Booking Reference",
      "City",
      "Branch",
      "Service Type",
      "Service Description",
      "Payment Amount (INR)",
      "Discount (INR)",
      "Final Paid Amount (INR)",
      "Payment Method",
      "Cashfree Order ID",
      "Cashfree Payment ID",
      "Internal Reference",
      "Transaction Status",
      "Refund Status",
      "Refunded Amount (INR)",
      "Last Updated (IST)",
    ];

    const csvLines = [headers.join(",")];

    for (const r of result.rows) {
      csvLines.push(
        [
          escapeCsv(r.paymentDateIst),
          escapeCsv(r.customerName),
          escapeCsv(r.customerPhone),
          escapeCsv(r.customerId),
          escapeCsv(r.bookingRef || "—"),
          escapeCsv(r.city),
          escapeCsv(r.branchName || "—"),
          escapeCsv(r.serviceType.toUpperCase()),
          escapeCsv(r.serviceDescription),
          escapeCsv(r.paymentAmount.toFixed(2)),
          escapeCsv(r.discount.toFixed(2)),
          escapeCsv(r.amountPaid.toFixed(2)),
          escapeCsv(r.paymentMethod.toUpperCase()),
          escapeCsv(r.cfOrderId || "—"),
          escapeCsv(r.cfPaymentId || "—"),
          escapeCsv(r.internalReference),
          escapeCsv(r.status.toUpperCase()),
          escapeCsv(r.refundStatus.toUpperCase()),
          escapeCsv(r.refundedAmount.toFixed(2)),
          escapeCsv(r.lastUpdatedIst),
        ].join(","),
      );
    }

    const csvOutput = csvLines.join("\r\n");
    const filename = `cwp-payment-ledger-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvOutput);
  } catch (err: any) {
    logger.error({ err: err.message }, "[ADMIN_LEDGER] Error exporting ledger CSV");
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to export ledger CSV",
    });
  }
});

// Also support legacy export route without /api prefix
router.get("/admin/payments/ledger/export", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  req.url = "/api/admin/payments/ledger/export";
  return router.handle(req, res, () => {});
});

/**
 * GET /api/admin/payments/ledger/:id
 * Fetches transaction details and chronological payment timeline.
 */
router.get("/admin/payments/ledger/:id", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const isSuperAdmin = req.user?.role === "superadmin";

    let paymentRecord: any = null;
    let attemptRecord: any = null;
    let customerRecord: any = null;
    let invoiceRecord: any = null;
    let bookingRecord: any = null;
    let refundsList: any[] = [];

    if (rawId.startsWith("pay_")) {
      const pId = parseInt(rawId.replace("pay_", ""), 10);
      const [p] = await db
        .select({
          payment: paymentsTable,
          customer: customersTable,
          invoice: invoicesTable,
          attempt: paymentAttemptsTable,
          booking: bookingsTable,
        })
        .from(paymentsTable)
        .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
        .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
        .leftJoin(paymentAttemptsTable, eq(paymentsTable.transactionId, paymentAttemptsTable.cfOrderId))
        .leftJoin(bookingsTable, eq(invoicesTable.bookingId, bookingsTable.id))
        .where(eq(paymentsTable.id, pId))
        .limit(1);

      if (!p) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      paymentRecord = p.payment;
      customerRecord = p.customer;
      invoiceRecord = p.invoice;
      attemptRecord = p.attempt;
      bookingRecord = p.booking;

      refundsList = await db
        .select()
        .from(paymentRefundsTable)
        .where(eq(paymentRefundsTable.paymentId, pId))
        .orderBy(desc(paymentRefundsTable.createdAt));
    } else if (rawId.startsWith("att_")) {
      const aId = parseInt(rawId.replace("att_", ""), 10);
      const [a] = await db
        .select({
          attempt: paymentAttemptsTable,
          customer: customersTable,
          invoice: invoicesTable,
          booking: bookingsTable,
        })
        .from(paymentAttemptsTable)
        .leftJoin(customersTable, eq(paymentAttemptsTable.customerId, customersTable.id))
        .leftJoin(invoicesTable, eq(paymentAttemptsTable.invoiceId, invoicesTable.id))
        .leftJoin(bookingsTable, eq(invoicesTable.bookingId, bookingsTable.id))
        .where(eq(paymentAttemptsTable.id, aId))
        .limit(1);

      if (!a) {
        return res.status(404).json({ error: "Attempt not found" });
      }

      attemptRecord = a.attempt;
      customerRecord = a.customer;
      invoiceRecord = a.invoice;
      bookingRecord = a.booking;

      refundsList = await db
        .select()
        .from(paymentRefundsTable)
        .where(eq(paymentRefundsTable.attemptId, aId))
        .orderBy(desc(paymentRefundsTable.createdAt));
    } else {
      return res.status(400).json({ error: "Invalid transaction ID format" });
    }

    const paymentDateObj = paymentRecord?.receivedAt || paymentRecord?.createdAt || attemptRecord?.createdAt;
    const invTotal = invoiceRecord ? parseFloat(invoiceRecord.totalAmount) : (paymentRecord ? parseFloat(paymentRecord.amount) : parseFloat(attemptRecord?.amount ?? "0"));
    const invDiscount = invoiceRecord ? parseFloat(invoiceRecord.discount ?? "0") : 0;
    const paidAmount = paymentRecord ? parseFloat(paymentRecord.amount) : parseFloat(attemptRecord?.amount ?? "0");

    let statusLabel: AdminLedgerRow["status"] = "paid";
    if (paymentRecord) {
      if (paymentRecord.status === "reversed") statusLabel = "cancelled";
      else if (paymentRecord.refundStatus === "refunded") statusLabel = "refunded";
      else if (paymentRecord.refundStatus === "partial") statusLabel = "partially_refunded";
      else if (paymentRecord.reconciliationStatus === "mismatch") statusLabel = "requires_reconciliation";
      else statusLabel = "paid";
    } else if (attemptRecord) {
      if (attemptRecord.status === "initiated") statusLabel = "initiated";
      else if (attemptRecord.status === "active") statusLabel = "pending";
      else if (attemptRecord.status === "failed") statusLabel = "failed";
      else statusLabel = "cancelled";
    }

    // Chronological payment timeline
    const timeline: Array<{
      event: string;
      title: string;
      description: string;
      timestamp: string;
      timestampIst: string;
      source: "internal" | "gateway";
      status: "success" | "pending" | "failed" | "info";
    }> = [];

    if (attemptRecord?.createdAt) {
      timeline.push({
        event: "order_created",
        title: "Payment Order Created",
        description: `Order session ${attemptRecord.cfOrderId || attemptRecord.attemptId} generated for ₹${paidAmount.toFixed(2)}`,
        timestamp: new Date(attemptRecord.createdAt).toISOString(),
        timestampIst: formatIstDateTime(attemptRecord.createdAt),
        source: "internal",
        status: "success",
      });
    }

    if (attemptRecord?.createdAt) {
      timeline.push({
        event: "payment_initiated",
        title: "Checkout Initiated",
        description: `Customer entered ${attemptRecord.gatewayProvider === "razorpay" ? "Razorpay" : "Cashfree"} payment session`,
        timestamp: new Date(attemptRecord.createdAt).toISOString(),
        timestampIst: formatIstDateTime(attemptRecord.createdAt),
        source: "gateway",
        status: "info",
      });
    }

    if (attemptRecord?.rawWebhookPayload) {
      const whTime = (attemptRecord.rawWebhookPayload as any)?.data?.payment?.payment_time || attemptRecord.updatedAt;
      timeline.push({
        event: "webhook_received",
        title: "Gateway Webhook Verified",
        description: `HMAC-SHA256 signature verified. Status: ${attemptRecord.status.toUpperCase()}`,
        timestamp: new Date(whTime).toISOString(),
        timestampIst: formatIstDateTime(whTime),
        source: "gateway",
        status: attemptRecord.status === "failed" ? "failed" : "success",
      });
    }

    if (paymentRecord?.createdAt) {
      timeline.push({
        event: "payment_confirmed",
        title: "Payment Credited & Settled",
        description: `Payment record PAY-${paymentRecord.id} atomically credited to billing ledger`,
        timestamp: new Date(paymentRecord.createdAt).toISOString(),
        timestampIst: formatIstDateTime(paymentRecord.createdAt),
        source: "internal",
        status: "success",
      });
    }

    if (invoiceRecord && invoiceRecord.status === "paid") {
      timeline.push({
        event: "booking_updated",
        title: "Invoice & Booking Reconciled",
        description: `Invoice ${invoiceRecord.invoiceNumber || `#${invoiceRecord.id}`} marked paid. Booking updated.`,
        timestamp: new Date(invoiceRecord.updatedAt || paymentRecord?.createdAt || new Date()).toISOString(),
        timestampIst: formatIstDateTime(invoiceRecord.updatedAt || paymentRecord?.createdAt || new Date()),
        source: "internal",
        status: "success",
      });
    }

    for (const ref of refundsList) {
      timeline.push({
        event: "refund_processed",
        title: `Refund ${ref.status.toUpperCase()}`,
        description: `Refund ${ref.refundId} of ₹${parseFloat(ref.amount).toFixed(2)} (${ref.reason})`,
        timestamp: new Date(ref.processedAt || ref.createdAt).toISOString(),
        timestampIst: formatIstDateTime(ref.processedAt || ref.createdAt),
        source: ref.gatewayProvider === "other" ? "internal" : "gateway",
        status: ref.status === "succeeded" ? "success" : ref.status === "failed" ? "failed" : "pending",
      });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const bookingId = paymentRecord?.bookingId ?? invoiceRecord?.bookingId ?? bookingRecord?.id ?? null;

    return res.json({
      id: rawId,
      sourceType: paymentRecord ? "payment" : "payment_attempt",
      paymentId: paymentRecord?.id ?? null,
      attemptId: attemptRecord?.attemptId ?? null,
      paymentDate: paymentDateObj,
      paymentDateIst: formatIstDateTime(paymentDateObj),
      customerId: customerRecord?.id ?? 0,
      customerName: customerRecord?.name || "Customer",
      customerPhone: maskCustomerPhone(customerRecord?.phone, isSuperAdmin),
      city: customerRecord?.city || "Varanasi",
      bookingId,
      bookingRef: bookingId ? `BK-${bookingId}` : null,
      bookingDate: bookingRecord?.scheduledDate ? String(bookingRecord.scheduledDate) : null,
      serviceType: deriveServiceType(invoiceRecord, bookingRecord, paymentRecord?.notes),
      serviceDescription: deriveServiceDescription(invoiceRecord, paymentRecord?.notes),
      invoiceId: invoiceRecord?.id ?? null,
      invoiceNumber: invoiceRecord?.invoiceNumber ?? null,
      paymentAmount: invTotal,
      discount: invDiscount,
      amountPaid: paidAmount,
      remainingDue: invoiceRecord ? parseFloat(invoiceRecord.balanceDue ?? "0") : 0,
      paymentMethod: paymentRecord?.method || attemptRecord?.gatewayProvider || "cashfree",
      cfOrderId: attemptRecord?.gatewayOrderId || attemptRecord?.rzpOrderId || attemptRecord?.cfOrderId || paymentRecord?.transactionId || null,
      cfPaymentId: attemptRecord?.rzpPaymentId || attemptRecord?.cfPaymentId || null,
      internalReference: attemptRecord?.attemptId || paymentRecord?.transactionId || `PAY-${paymentRecord?.id}`,
      status: statusLabel,
      refundStatus: paymentRecord?.refundStatus || "none",
      refundedAmount: parseFloat(paymentRecord?.refundedAmount || "0"),
      notes: paymentRecord?.notes || attemptRecord?.metadata?.order_note || null,
      rawWebhookPayload: attemptRecord?.rawWebhookPayload ?? null,
      rawVerificationPayload: attemptRecord?.rawVerificationPayload ?? null,
      timeline,
      refunds: refundsList,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "[ADMIN_LEDGER] Error fetching transaction detail");
    return res.status(500).json({ error: "INTERNAL_ERROR", detail: err?.message });
  }
});

/**
 * GET /api/admin/payments/refundable-balance/:id
 */
router.get("/admin/payments/refundable-balance/:id", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const balance = await getRefundableBalance(rawId);
    return res.json(balance);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to calculate refundable balance" });
  }
});

/**
 * POST /api/admin/payments/refund
 */
router.post("/admin/payments/refund", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { transactionId, amount, reason } = req.body || {};

    if (!transactionId || !reason) {
      return res.status(400).json({ error: "transactionId and reason are required" });
    }

    const result = await initiateRefund({
      transactionId,
      amount: amount != null ? Number(amount) : undefined,
      reason,
      initiatedByUserId: req.user?.id,
      initiatedByEmail: req.user?.email,
      ipAddress: req.ip,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    logger.warn({ err: err.message }, "[ADMIN_REFUND] Refund request failed");
    return res.status(400).json({ error: err.message || "Refund initiation failed" });
  }
});

/**
 * GET /api/admin/payments/refunds
 */
router.get("/admin/payments/refunds", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const refunds = await db
      .select({
        refund: paymentRefundsTable,
        customer: customersTable,
      })
      .from(paymentRefundsTable)
      .leftJoin(customersTable, eq(paymentRefundsTable.customerId, customersTable.id))
      .orderBy(desc(paymentRefundsTable.createdAt))
      .limit(100);

    return res.json({
      data: refunds.map((r) => ({
        ...r.refund,
        customerName: r.customer?.name || "Customer",
        customerPhone: maskCustomerPhone(r.customer?.phone, req.user?.role === "superadmin"),
        createdAtIst: formatIstDateTime(r.refund.createdAt),
      })),
      total: refunds.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to list refunds", detail: err?.message });
  }
});

/**
 * GET /api/admin/payments/reconciliation/dashboard
 */
router.get("/admin/payments/reconciliation/dashboard", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, city, branchId, category } = req.query as Record<string, string | undefined>;
    const result = await runReconciliationAnalysis({
      startDate,
      endDate,
      city,
      branchId: branchId ? parseInt(branchId, 10) : undefined,
      category,
    });
    return res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, "[RECONCILIATION] Failed to run reconciliation");
    return res.status(500).json({ error: "Failed to run reconciliation analysis", detail: err?.message });
  }
});

/**
 * POST /api/admin/payments/reconciliation/reconcile-order/:id
 */
router.post("/admin/payments/reconciliation/reconcile-order/:id", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const { reason } = req.body || {};

    if (!reason) {
      return res.status(400).json({ error: "Reconciliation reason is mandatory" });
    }

    const result = await manualReconcileOrder({
      orderId,
      reconciledByUserId: req.user!.id,
      reason,
      ipAddress: req.ip,
    });

    return res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, "[RECONCILIATION] Manual reconciliation failed");
    return res.status(400).json({ error: err.message || "Manual reconciliation failed" });
  }
});

/**
 * GET /api/admin/payments/revenue-intelligence
 */
router.get("/admin/payments/revenue-intelligence", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, city, branchId } = req.query as Record<string, string | undefined>;
    const metrics = await getRevenueIntelligence({
      startDate,
      endDate,
      city,
      branchId: branchId ? parseInt(branchId, 10) : undefined,
    });
    return res.json(metrics);
  } catch (err: any) {
    logger.error({ err: err.message }, "[REVENUE_INTELLIGENCE] Failed to compute revenue metrics");
    return res.status(500).json({ error: "Failed to load revenue intelligence metrics", detail: err?.message });
  }
});

export default router;
