import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  paymentsTable,
  paymentAttemptsTable,
  customersTable,
  invoicesTable,
  branchesTable,
} from "@workspace/db";
import { eq, and, sql, desc, gte, lte, or, inArray, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

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
  invoiceId: number | null;
  invoiceNumber: string | null;
  serviceDescription: string;
  invoiceAmount: number | null;
  amountPaid: number;
  remainingDue: number | null;
  paymentMethod: string;
  cfOrderId: string | null;
  cfPaymentId: string | null;
  internalReference: string;
  status: "success" | "pending" | "failed" | "abandoned" | "reversed";
  notes: string | null;
  subscriptionId?: number | null;
  branchId?: number | null;
  branchName?: string | null;
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
 * Security: Guard strictly to admin/superadmin/manager roles.
 */
function requireAdminRole(req: Request, res: Response, next: () => void) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  }
  const allowedRoles = ["admin", "superadmin", "manager"];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({
      error: "Access denied. Administrator privileges required.",
      code: "FORBIDDEN",
    });
  }
  next();
}

/**
 * Format timestamp into exact IST (Asia/Kolkata) readable string
 * Example: "12 Nov 2026, 02:45 PM"
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

/**
 * Parses start and end date query strings into UTC Date objects corresponding to IST midnight boundaries
 */
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

function mapAttemptStatus(status: string): "pending" | "failed" | "abandoned" {
  if (status === "initiated" || status === "active") return "pending";
  if (status === "failed") return "failed";
  return "abandoned";
}

/**
 * Fetch unified ledger entries combining completed payments with active/pending/failed gateway attempts
 */
async function fetchUnifiedLedger(options: {
  search?: string;
  status?: string;
  method?: string;
  city?: string;
  branchId?: number;
  startDate?: string;
  endDate?: string;
  invoiceId?: number;
  customerId?: number;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminLedgerRow[]; total: number }> {
  const {
    search,
    status = "all",
    method = "all",
    city,
    branchId,
    startDate,
    endDate,
    invoiceId,
    customerId,
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
    })
    .from(paymentsTable)
    .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
    .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
    .leftJoin(paymentAttemptsTable, eq(paymentsTable.transactionId, paymentAttemptsTable.cfOrderId))
    .leftJoin(branchesTable, eq(invoicesTable.branchId, branchesTable.id))
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

  // If method filter is not "all" and not "cashfree", we skip attempts because attempts are all cashfree
  let attemptRecords: Array<{
    attempt: typeof paymentAttemptsTable.$inferSelect;
    customer: typeof customersTable.$inferSelect | null;
    invoice: typeof invoicesTable.$inferSelect | null;
    branch: typeof branchesTable.$inferSelect | null;
  }> = [];

  if (method === "all" || method.toLowerCase() === "cashfree") {
    const attemptsQuery = db
      .select({
        attempt: paymentAttemptsTable,
        customer: customersTable,
        invoice: invoicesTable,
        branch: branchesTable,
      })
      .from(paymentAttemptsTable)
      .leftJoin(customersTable, eq(paymentAttemptsTable.customerId, customersTable.id))
      .leftJoin(invoicesTable, eq(paymentAttemptsTable.invoiceId, invoicesTable.id))
      .leftJoin(branchesTable, or(
        eq(paymentAttemptsTable.branchId, branchesTable.id),
        eq(invoicesTable.branchId, branchesTable.id),
      ))
      .where(and(...attemptConditions))
      .orderBy(desc(paymentAttemptsTable.createdAt));

    attemptRecords = await attemptsQuery;
  }

  // 3. Transform paymentRecords to AdminLedgerRow
  const rows: AdminLedgerRow[] = [];

  for (const { payment, customer, invoice, attempt, branch } of paymentRecords) {
    const rowStatus = payment.status === "reversed" ? "reversed" : "success";
    const paymentDateObj = payment.receivedAt || payment.createdAt;
    const effectiveCity = customer?.city?.trim() || "Varanasi";
    const invoiceBal = invoice ? parseFloat(invoice.balanceDue ?? invoice.dueAmount ?? "0") : 0;
    const invTotal = invoice ? parseFloat(invoice.totalAmount ?? "0") : null;
    const effectiveBranchId = invoice?.branchId ?? attempt?.branchId ?? null;

    rows.push({
      id: `pay_${payment.id}`,
      sourceType: "payment",
      paymentId: payment.id,
      attemptId: attempt?.attemptId ?? null,
      paymentDate: (paymentDateObj instanceof Date ? paymentDateObj : new Date(paymentDateObj)).toISOString(),
      paymentDateIst: formatIstDateTime(paymentDateObj),
      customerId: payment.customerId,
      customerName: customer?.name?.trim() || "Customer",
      customerPhone: customer?.phone || "—",
      city: effectiveCity,
      invoiceId: invoice?.id ?? payment.invoiceId ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? (payment.invoiceId ? `#${payment.invoiceId}` : "—"),
      serviceDescription: deriveServiceDescription(invoice, payment.notes),
      invoiceAmount: invTotal != null && !isNaN(invTotal) ? invTotal : null,
      amountPaid: parseFloat(payment.amount),
      remainingDue: invoiceBal >= 0 ? invoiceBal : 0,
      paymentMethod: payment.method || "cashfree",
      cfOrderId: attempt?.cfOrderId || (payment.method === "cashfree" ? payment.transactionId : null),
      cfPaymentId: attempt?.cfPaymentId || null,
      internalReference: attempt?.attemptId || payment.transactionId || `PAY-${payment.id}`,
      status: rowStatus,
      notes: payment.notes ?? null,
      subscriptionId: attempt?.subscriptionId ?? null,
      branchId: effectiveBranchId,
      branchName: branch?.name ?? null,
      rawWebhookPayload: attempt?.rawWebhookPayload ?? null,
      rawVerificationPayload: attempt?.rawVerificationPayload ?? null,
    });
  }

  // 4. Transform attemptRecords to AdminLedgerRow
  for (const { attempt, customer, invoice, branch } of attemptRecords) {
    const mappedStatus = mapAttemptStatus(attempt.status);
    const attemptDateObj = attempt.updatedAt || attempt.createdAt;
    const effectiveCity = customer?.city?.trim() || "Varanasi";
    const invoiceBal = invoice ? parseFloat(invoice.balanceDue ?? invoice.dueAmount ?? "0") : null;
    const invTotal = invoice ? parseFloat(invoice.totalAmount ?? "0") : null;
    const effectiveBranchId = attempt.branchId ?? invoice?.branchId ?? null;

    rows.push({
      id: `att_${attempt.id}`,
      sourceType: "payment_attempt",
      paymentId: null,
      attemptId: attempt.attemptId,
      paymentDate: (attemptDateObj instanceof Date ? attemptDateObj : new Date(attemptDateObj)).toISOString(),
      paymentDateIst: formatIstDateTime(attemptDateObj),
      customerId: attempt.customerId,
      customerName: customer?.name?.trim() || "Customer",
      customerPhone: customer?.phone || "—",
      city: effectiveCity,
      invoiceId: invoice?.id ?? attempt.invoiceId ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? (attempt.invoiceId ? `#${attempt.invoiceId}` : "—"),
      serviceDescription: deriveServiceDescription(invoice, null),
      invoiceAmount: invTotal != null && !isNaN(invTotal) ? invTotal : null,
      amountPaid: parseFloat(attempt.amount),
      remainingDue: invoiceBal != null && !isNaN(invoiceBal) ? invoiceBal : null,
      paymentMethod: "cashfree",
      cfOrderId: attempt.cfOrderId,
      cfPaymentId: attempt.cfPaymentId || null,
      internalReference: attempt.attemptId,
      status: mappedStatus,
      notes: `Cashfree gateway attempt (${attempt.status})`,
      subscriptionId: attempt.subscriptionId ?? null,
      branchId: effectiveBranchId,
      branchName: branch?.name ?? null,
      rawWebhookPayload: attempt.rawWebhookPayload ?? null,
      rawVerificationPayload: attempt.rawVerificationPayload ?? null,
    });
  }

  // 5. In-memory unified filtering (status, city, search) and sorting
  let filtered = rows;

  if (status !== "all") {
    filtered = filtered.filter((r) => r.status.toLowerCase() === status.toLowerCase());
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
 * Returns top-level financial metrics derived from trusted database records in IST.
 */
router.get("/admin/payments/ledger/summary", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { startOfTodayUtc, endOfTodayUtc, startOfMonthUtc } = getIstSummaryBounds();

    // 1. Today's collections & count
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

    // 2. Current Month's collections
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

    // 3. Total all-time collections
    const [allTimeResult] = await db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "completed"));

    // 4. Pending gateway transactions
    const [pendingResult] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(paymentAttemptsTable)
      .where(inArray(paymentAttemptsTable.status, ["initiated", "active"]));

    // 5. Failed gateway transactions
    const [failedResult] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(paymentAttemptsTable)
      .where(inArray(paymentAttemptsTable.status, ["failed", "user_dropped"]));

    // 6. Total outstanding customer dues from active tax invoices
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
 * Returns paginated ledger list with full financial metadata.
 */
router.get("/admin/payments/ledger", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "25",
      search,
      status,
      method,
      city,
      branchId: branchIdParam,
      startDate,
      endDate,
      invoiceId,
      customerId,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const result = await fetchUnifiedLedger({
      search,
      status,
      method,
      city,
      branchId: branchIdParam ? parseInt(branchIdParam, 10) : undefined,
      startDate,
      endDate,
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
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
 * Exports filtered payment ledger entries as a formatted CSV file.
 */
router.get("/admin/payments/ledger/export", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      method,
      city,
      startDate,
      endDate,
      invoiceId,
      customerId,
    } = req.query as Record<string, string | undefined>;

    const result = await fetchUnifiedLedger({
      search,
      status,
      method,
      city,
      startDate,
      endDate,
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      limit: 5000,
      offset: 0,
    });

    // Helper to safely escape CSV values
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
      "City",
      "Invoice Number",
      "Service Description",
      "Invoice Amount (INR)",
      "Amount Paid (INR)",
      "Remaining Due (INR)",
      "Payment Method",
      "Cashfree Order ID",
      "Cashfree Payment ID",
      "Internal Reference",
      "Status",
    ];

    const csvLines = [headers.join(",")];

    for (const r of result.rows) {
      csvLines.push(
        [
          escapeCsv(r.paymentDateIst),
          escapeCsv(r.customerName),
          escapeCsv(r.customerPhone),
          escapeCsv(r.customerId),
          escapeCsv(r.city),
          escapeCsv(r.invoiceNumber),
          escapeCsv(r.serviceDescription),
          escapeCsv(r.invoiceAmount != null ? r.invoiceAmount.toFixed(2) : "0.00"),
          escapeCsv(r.amountPaid.toFixed(2)),
          escapeCsv(r.remainingDue != null ? r.remainingDue.toFixed(2) : "0.00"),
          escapeCsv(r.paymentMethod.toUpperCase()),
          escapeCsv(r.cfOrderId || "—"),
          escapeCsv(r.cfPaymentId || "—"),
          escapeCsv(r.internalReference),
          escapeCsv(r.status.toUpperCase()),
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

/**
 * GET /api/admin/payments/ledger/:id
 * Fetches single transaction details including raw payloads for forensic audit.
 */
router.get("/admin/payments/ledger/:id", requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    let paymentRecord: any = null;
    let attemptRecord: any = null;

    if (rawId.startsWith("pay_")) {
      const pId = parseInt(rawId.replace("pay_", ""), 10);
      const [p] = await db
        .select({
          payment: paymentsTable,
          customer: customersTable,
          invoice: invoicesTable,
          attempt: paymentAttemptsTable,
        })
        .from(paymentsTable)
        .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
        .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
        .leftJoin(paymentAttemptsTable, eq(paymentsTable.transactionId, paymentAttemptsTable.cfOrderId))
        .where(eq(paymentsTable.id, pId))
        .limit(1);

      if (!p) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const rowStatus = p.payment.status === "reversed" ? "reversed" : "success";
      const paymentDateObj = p.payment.receivedAt || p.payment.createdAt;
      return res.json({
        id: `pay_${p.payment.id}`,
        sourceType: "payment",
        paymentId: p.payment.id,
        attemptId: p.attempt?.attemptId ?? null,
        paymentDate: paymentDateObj,
        paymentDateIst: formatIstDateTime(paymentDateObj),
        customerId: p.payment.customerId,
        customerName: p.customer?.name || "Customer",
        customerPhone: p.customer?.phone || "—",
        city: p.customer?.city || "Varanasi",
        invoiceId: p.invoice?.id ?? p.payment.invoiceId ?? null,
        invoiceNumber: p.invoice?.invoiceNumber ?? (p.payment.invoiceId ? `#${p.payment.invoiceId}` : "—"),
        serviceDescription: deriveServiceDescription(p.invoice, p.payment.notes),
        invoiceAmount: p.invoice ? parseFloat(p.invoice.totalAmount) : null,
        amountPaid: parseFloat(p.payment.amount),
        remainingDue: p.invoice ? parseFloat(p.invoice.balanceDue ?? p.invoice.dueAmount ?? "0") : 0,
        paymentMethod: p.payment.method,
        cfOrderId: p.attempt?.cfOrderId || (p.payment.method === "cashfree" ? p.payment.transactionId : null),
        cfPaymentId: p.attempt?.cfPaymentId || null,
        internalReference: p.attempt?.attemptId || p.payment.transactionId || `PAY-${p.payment.id}`,
        status: rowStatus,
        notes: p.payment.notes,
        rawWebhookPayload: p.attempt?.rawWebhookPayload ?? null,
        rawVerificationPayload: p.attempt?.rawVerificationPayload ?? null,
      });
    } else if (rawId.startsWith("att_")) {
      const aId = parseInt(rawId.replace("att_", ""), 10);
      const [a] = await db
        .select({
          attempt: paymentAttemptsTable,
          customer: customersTable,
          invoice: invoicesTable,
        })
        .from(paymentAttemptsTable)
        .leftJoin(customersTable, eq(paymentAttemptsTable.customerId, customersTable.id))
        .leftJoin(invoicesTable, eq(paymentAttemptsTable.invoiceId, invoicesTable.id))
        .where(eq(paymentAttemptsTable.id, aId))
        .limit(1);

      if (!a) {
        return res.status(404).json({ error: "Attempt not found" });
      }

      const mappedStatus = mapAttemptStatus(a.attempt.status);
      const attemptDateObj = a.attempt.updatedAt || a.attempt.createdAt;
      return res.json({
        id: `att_${a.attempt.id}`,
        sourceType: "payment_attempt",
        paymentId: null,
        attemptId: a.attempt.attemptId,
        paymentDate: attemptDateObj,
        paymentDateIst: formatIstDateTime(attemptDateObj),
        customerId: a.attempt.customerId,
        customerName: a.customer?.name || "Customer",
        customerPhone: a.customer?.phone || "—",
        city: a.customer?.city || "Varanasi",
        invoiceId: a.invoice?.id ?? a.attempt.invoiceId ?? null,
        invoiceNumber: a.invoice?.invoiceNumber ?? (a.attempt.invoiceId ? `#${a.attempt.invoiceId}` : "—"),
        serviceDescription: deriveServiceDescription(a.invoice, null),
        invoiceAmount: a.invoice ? parseFloat(a.invoice.totalAmount) : null,
        amountPaid: parseFloat(a.attempt.amount),
        remainingDue: a.invoice ? parseFloat(a.invoice.balanceDue ?? a.invoice.dueAmount ?? "0") : null,
        paymentMethod: "cashfree",
        cfOrderId: a.attempt.cfOrderId,
        cfPaymentId: a.attempt.cfPaymentId || null,
        internalReference: a.attempt.attemptId,
        status: mappedStatus,
        notes: `Cashfree gateway attempt (${a.attempt.status})`,
        rawWebhookPayload: a.attempt.rawWebhookPayload ?? null,
        rawVerificationPayload: a.attempt.rawVerificationPayload ?? null,
      });
    }

    return res.status(400).json({ error: "Invalid transaction ID format" });
  } catch (err: any) {
    logger.error({ err: err.message }, "[ADMIN_LEDGER] Error fetching transaction detail");
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
