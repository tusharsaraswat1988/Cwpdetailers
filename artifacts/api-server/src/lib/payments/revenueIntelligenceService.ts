import { db, paymentsTable, paymentAttemptsTable, paymentRefundsTable, invoicesTable, customersTable, bookingsTable, branchesTable, citiesTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

export interface RevenueIntelligenceMetrics {
  grossPaymentVolume: number; // Total attempted volume
  successfulPaymentAmount: number; // Total successfully collected cash
  failedPaymentAmount: number; // Value of failed/dropped attempts
  refundAmount: number; // Total refunds issued
  netCollectedAmount: number; // Successful - Refunds
  pendingPaymentAmount: number; // Currently pending gateway checkout value
  totalTransactionsCount: number;
  successfulTransactionsCount: number;
  failedTransactionsCount: number;
  pendingTransactionsCount: number;
  transactionSuccessRate: number; // Success %
  averageTransactionValue: number; // ATV in ₹
  totalOutstandingDues: number; // Uncollected active invoice balances
  cityBreakdown: Array<{
    cityId: number | null;
    cityName: string;
    collectedAmount: number;
    refundAmount: number;
    netAmount: number;
    transactionsCount: number;
    collectionSharePercent: number;
  }>;
  branchBreakdown: Array<{
    branchId: number | null;
    branchName: string;
    cityName: string;
    collectedAmount: number;
    netAmount: number;
    transactionsCount: number;
  }>;
  serviceBreakdown: Array<{
    serviceType: string;
    serviceLabel: string;
    collectedAmount: number;
    transactionsCount: number;
    sharePercent: number;
  }>;
  dailyTrends: Array<{
    date: string; // YYYY-MM-DD
    collectedAmount: number;
    refundAmount: number;
    netAmount: number;
    transactionsCount: number;
  }>;
  calculatedAtIst: string;
  financialDefinitions: {
    bookingValue: string;
    paymentCollected: string;
    gatewaySettlement: string;
    refunds: string;
    netCollectedAmount: string;
    revenueRecognized: string;
  };
}

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

export async function getRevenueIntelligence(options?: {
  startDate?: string;
  endDate?: string;
  city?: string;
  branchId?: number;
}): Promise<RevenueIntelligenceMetrics> {
  const { startDate, endDate, city, branchId } = options || {};

  let startUtc: Date | undefined;
  let endUtc: Date | undefined;

  if (startDate) {
    const s = new Date(`${startDate}T00:00:00+05:30`);
    if (!isNaN(s.getTime())) startUtc = s;
  }
  if (endDate) {
    const e = new Date(`${endDate}T23:59:59.999+05:30`);
    if (!isNaN(e.getTime())) endUtc = e;
  }

  // 1. Successful payments query
  const paymentConditions = [eq(paymentsTable.status, "completed")];
  if (startUtc) paymentConditions.push(gte(paymentsTable.createdAt, startUtc));
  if (endUtc) paymentConditions.push(lte(paymentsTable.createdAt, endUtc));

  const paymentsQuery = db
    .select({
      payment: paymentsTable,
      customer: customersTable,
      invoice: invoicesTable,
      branch: branchesTable,
    })
    .from(paymentsTable)
    .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
    .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
    .leftJoin(branchesTable, eq(invoicesTable.branchId, branchesTable.id))
    .where(and(...paymentConditions));

  const paymentRows = await paymentsQuery;

  // Filter in-memory for city/branch if provided
  let filteredPayments = paymentRows;
  if (city && city.toLowerCase() !== "all") {
    filteredPayments = filteredPayments.filter(
      (r) => r.customer?.city?.trim().toLowerCase() === city.trim().toLowerCase(),
    );
  }
  if (branchId) {
    filteredPayments = filteredPayments.filter(
      (r) => (r.invoice?.branchId ?? r.payment.branchId) === branchId,
    );
  }

  // 2. Gateway attempts query (for failed, pending, and gross volume)
  const attemptConditions = [];
  if (startUtc) attemptConditions.push(gte(paymentAttemptsTable.createdAt, startUtc));
  if (endUtc) attemptConditions.push(lte(paymentAttemptsTable.createdAt, endUtc));

  const attemptRows = await db
    .select({
      attempt: paymentAttemptsTable,
      customer: customersTable,
    })
    .from(paymentAttemptsTable)
    .leftJoin(customersTable, eq(paymentAttemptsTable.customerId, customersTable.id))
    .where(attemptConditions.length > 0 ? and(...attemptConditions) : undefined);

  let filteredAttempts = attemptRows;
  if (city && city.toLowerCase() !== "all") {
    filteredAttempts = filteredAttempts.filter(
      (r) => r.customer?.city?.trim().toLowerCase() === city.trim().toLowerCase(),
    );
  }
  if (branchId) {
    filteredAttempts = filteredAttempts.filter((r) => r.attempt.branchId === branchId);
  }

  // 3. Refunds query
  const refundConditions = [eq(paymentRefundsTable.status, "succeeded")];
  if (startUtc) refundConditions.push(gte(paymentRefundsTable.createdAt, startUtc));
  if (endUtc) refundConditions.push(lte(paymentRefundsTable.createdAt, endUtc));

  const refundRows = await db.select().from(paymentRefundsTable).where(and(...refundConditions));

  // Compute Aggregates
  let successfulAmount = 0;
  const successfulCount = filteredPayments.length;
  for (const r of filteredPayments) {
    successfulAmount += parseFloat(r.payment.amount);
  }

  let failedAmount = 0;
  let failedCount = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  let grossVolume = 0;

  for (const { attempt } of filteredAttempts) {
    const amt = parseFloat(attempt.amount);
    grossVolume += amt;
    if (attempt.status === "failed" || attempt.status === "user_dropped") {
      failedAmount += amt;
      failedCount++;
    } else if (attempt.status === "initiated" || attempt.status === "active") {
      pendingAmount += amt;
      pendingCount++;
    }
  }

  let totalRefundAmount = 0;
  for (const ref of refundRows) {
    totalRefundAmount += parseFloat(ref.amount);
  }

  // Outstanding customer dues
  const [duesRes] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(balance_due AS numeric)), 0)`,
    })
    .from(invoicesTable)
    .where(
      and(
        sql`CAST(balance_due AS numeric) > 0`,
        sql`status != 'cancelled'`,
        eq(invoicesTable.documentType, "tax_invoice"),
      ),
    );
  const totalOutstandingDues = parseFloat(duesRes?.total ?? "0");

  const netCollected = Math.max(0, Math.round((successfulAmount - totalRefundAmount) * 100) / 100);
  const totalAttemptedTxns = successfulCount + failedCount + pendingCount;
  const successRate =
    successfulCount + failedCount > 0
      ? Math.round((successfulCount / (successfulCount + failedCount)) * 1000) / 10
      : 100;
  const atv = successfulCount > 0 ? Math.round((successfulAmount / successfulCount) * 100) / 100 : 0;

  // City Breakdown
  const cityMap = new Map<string, { collected: number; txns: number; cityId: number | null }>();
  for (const r of filteredPayments) {
    const cName = r.customer?.city?.trim() || "Varanasi";
    const existing = cityMap.get(cName) || { collected: 0, txns: 0, cityId: r.customer?.cityId ?? null };
    existing.collected += parseFloat(r.payment.amount);
    existing.txns++;
    cityMap.set(cName, existing);
  }

  const cityBreakdown = Array.from(cityMap.entries()).map(([cityName, data]) => ({
    cityId: data.cityId,
    cityName,
    collectedAmount: Math.round(data.collected * 100) / 100,
    refundAmount: 0,
    netAmount: Math.round(data.collected * 100) / 100,
    transactionsCount: data.txns,
    collectionSharePercent:
      successfulAmount > 0 ? Math.round((data.collected / successfulAmount) * 1000) / 10 : 0,
  }));

  // Branch Breakdown
  const branchMap = new Map<number, { branchName: string; cityName: string; collected: number; txns: number }>();
  for (const r of filteredPayments) {
    const bId = r.invoice?.branchId ?? r.payment.branchId ?? 0;
    const bName = r.branch?.name || (bId === 0 ? "Default Hub" : `Branch #${bId}`);
    const cName = r.customer?.city?.trim() || "Varanasi";
    const existing = branchMap.get(bId) || { branchName: bName, cityName: cName, collected: 0, txns: 0 };
    existing.collected += parseFloat(r.payment.amount);
    existing.txns++;
    branchMap.set(bId, existing);
  }

  const branchBreakdown = Array.from(branchMap.entries()).map(([branchIdKey, data]) => ({
    branchId: branchIdKey || null,
    branchName: data.branchName,
    cityName: data.cityName,
    collectedAmount: Math.round(data.collected * 100) / 100,
    netAmount: Math.round(data.collected * 100) / 100,
    transactionsCount: data.txns,
  }));

  // Service Breakdown
  const serviceMap = new Map<string, { count: number; amount: number; label: string }>();
  for (const r of filteredPayments) {
    let sKey = "daily_cleaning";
    let sLabel = "Daily Car Cleaning (DCMS)";

    const notes = (r.payment.notes || "").toLowerCase();
    const invItems = r.invoice?.items as any[];
    if (invItems && Array.isArray(invItems) && invItems.length > 0) {
      const desc = (invItems[0].description || "").toLowerCase();
      if (desc.includes("wash") || desc.includes("waterless")) {
        sKey = "car_wash";
        sLabel = "Car Washing & Detailing";
      } else if (desc.includes("coating") || desc.includes("ppf") || desc.includes("ceramic")) {
        sKey = "detailing";
        sLabel = "Ceramic & Detailing Packages";
      } else if (desc.includes("solar")) {
        sKey = "solar";
        sLabel = "Solar Panel Cleaning";
      }
    } else if (notes.includes("wash")) {
      sKey = "car_wash";
      sLabel = "Car Washing & Detailing";
    }

    const existing = serviceMap.get(sKey) || { count: 0, amount: 0, label: sLabel };
    existing.count++;
    existing.amount += parseFloat(r.payment.amount);
    serviceMap.set(sKey, existing);
  }

  const serviceBreakdown = Array.from(serviceMap.entries()).map(([serviceType, data]) => ({
    serviceType,
    serviceLabel: data.label,
    collectedAmount: Math.round(data.amount * 100) / 100,
    transactionsCount: data.count,
    sharePercent: successfulAmount > 0 ? Math.round((data.amount / successfulAmount) * 1000) / 10 : 0,
  }));

  // Daily Trends (last 14 days or filtered period)
  const dailyMap = new Map<string, { collected: number; refund: number; txns: number }>();
  for (const r of filteredPayments) {
    const d = r.payment.receivedAt || r.payment.createdAt;
    const dateKey = new Date(d).toISOString().slice(0, 10);
    const existing = dailyMap.get(dateKey) || { collected: 0, refund: 0, txns: 0 };
    existing.collected += parseFloat(r.payment.amount);
    existing.txns++;
    dailyMap.set(dateKey, existing);
  }

  const dailyTrends = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      collectedAmount: Math.round(data.collected * 100) / 100,
      refundAmount: Math.round(data.refund * 100) / 100,
      netAmount: Math.round((data.collected - data.refund) * 100) / 100,
      transactionsCount: data.txns,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    grossPaymentVolume: Math.round(grossVolume * 100) / 100,
    successfulPaymentAmount: Math.round(successfulAmount * 100) / 100,
    failedPaymentAmount: Math.round(failedAmount * 100) / 100,
    refundAmount: Math.round(totalRefundAmount * 100) / 100,
    netCollectedAmount: netCollected,
    pendingPaymentAmount: Math.round(pendingAmount * 100) / 100,
    totalTransactionsCount: totalAttemptedTxns,
    successfulTransactionsCount: successfulCount,
    failedTransactionsCount: failedCount,
    pendingTransactionsCount: pendingCount,
    transactionSuccessRate: successRate,
    averageTransactionValue: atv,
    totalOutstandingDues: Math.round(totalOutstandingDues * 100) / 100,
    cityBreakdown,
    branchBreakdown,
    serviceBreakdown,
    dailyTrends,
    calculatedAtIst: formatIstDateTime(new Date()),
    financialDefinitions: {
      bookingValue: "Total gross amount of scheduled bookings before payment capture or completion.",
      paymentCollected: "Authoritative cash and gateway settlements verified and recorded in paymentsTable.",
      gatewaySettlement: "Net funds credited to CWP merchant bank account after payment gateway processing charges (MDR).",
      refunds: "Total debits issued back to customer payment sources through authorized refund workflows.",
      netCollectedAmount: "Gross Collected Payments minus Authoritative Refunds (Payment Collected - Refunds).",
      revenueRecognized: "Invoiced amounts whose service deliverables have been fulfilled per Indian Accounting Standards (Ind AS 115).",
    },
  };
}
