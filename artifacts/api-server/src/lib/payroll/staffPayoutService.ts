import {
  db,
  staffTable,
  staffPayoutLedgersTable,
  dcmsVisitsTable,
  serviceExecutionsTable,
  type StaffPayoutLedger,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../logger";

export type CalculatePayoutOptions = {
  deductions?: number;
  incentives?: number;
  notes?: string;
  forceRecalculate?: boolean;
};

/**
 * Universal Multi-City Staff Compensation & Payout Engine
 * PRD v4.0 (STAFF-018): Computes traceable monthly payouts based on actual verified work.
 * Supports Salaried, Per-Job, and Hybrid models without guessed rates.
 */
export async function calculateStaffPayout(
  staffId: number,
  periodMonth: string, // "YYYY-MM"
  opts: CalculatePayoutOptions = {},
): Promise<StaffPayoutLedger> {
  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1);

  if (!staff) {
    throw new Error(`Staff member with ID ${staffId} not found`);
  }

  // Check if payout already exists
  const [existing] = await db
    .select()
    .from(staffPayoutLedgersTable)
    .where(
      and(
        eq(staffPayoutLedgersTable.staffId, staffId),
        eq(staffPayoutLedgersTable.periodMonth, periodMonth),
      ),
    )
    .limit(1);

  if (existing && existing.status !== "draft" && !opts.forceRecalculate) {
    return existing;
  }

  // 1. Count verified completed DCMS visits in period
  const [cleaningVisits] = await db
    .select({ count: sql<number>`count(*)` })
    .from(dcmsVisitsTable)
    .where(
      and(
        eq(dcmsVisitsTable.staffId, staffId),
        eq(dcmsVisitsTable.status, "completed"),
        eq(dcmsVisitsTable.visitType, "cleaning"),
        sql`TO_CHAR(${dcmsVisitsTable.visitDate}::date, 'YYYY-MM') = ${periodMonth}`,
      ),
    );

  const [dcmsWashVisits] = await db
    .select({ count: sql<number>`count(*)` })
    .from(dcmsVisitsTable)
    .where(
      and(
        eq(dcmsVisitsTable.staffId, staffId),
        eq(dcmsVisitsTable.status, "completed"),
        eq(dcmsVisitsTable.visitType, "wash"),
        sql`TO_CHAR(${dcmsVisitsTable.visitDate}::date, 'YYYY-MM') = ${periodMonth}`,
      ),
    );

  // 2. Count verified completed one-time service executions in period
  const [executionWashes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(serviceExecutionsTable)
    .where(
      and(
        eq(serviceExecutionsTable.assignedStaffId, staffId),
        eq(serviceExecutionsTable.status, "completed"),
        sql`${serviceExecutionsTable.taskType} IN ('car_wash', 'one_time_wash', 'subscription_wash')`,
        sql`TO_CHAR(${serviceExecutionsTable.scheduledDate}::date, 'YYYY-MM') = ${periodMonth}`,
      ),
    );

  const [executionSolar] = await db
    .select({ count: sql<number>`count(*)` })
    .from(serviceExecutionsTable)
    .where(
      and(
        eq(serviceExecutionsTable.assignedStaffId, staffId),
        eq(serviceExecutionsTable.status, "completed"),
        eq(serviceExecutionsTable.taskType, "solar_cleaning"),
        sql`TO_CHAR(${serviceExecutionsTable.scheduledDate}::date, 'YYYY-MM') = ${periodMonth}`,
      ),
    );

  const completedDailyCleans = Number(cleaningVisits?.count ?? 0);
  const completedWashes = Number(dcmsWashVisits?.count ?? 0) + Number(executionWashes?.count ?? 0);
  const completedSolarVisits = Number(executionSolar?.count ?? 0);

  // Rates are strictly from configuration — never guessed
  const baseSalary = Number(staff.monthlySalary ?? 0);
  const perWashRate = Number(staff.perWashRate ?? 0);
  const perDailyCleaningRate = Number(staff.perDailyCleaningRate ?? 0);
  const perSolarRate = Number(staff.perSolarPanelRate ?? 0);
  const ratePerKm = Number(staff.ratePerKm ?? 0);

  const washEarnings = completedWashes * perWashRate;
  const dailyCleaningEarnings = completedDailyCleans * perDailyCleaningRate;
  const solarEarnings = completedSolarVisits * perSolarRate;
  const distanceAllowance = 0; // Telemetry distance calculation hook

  const deductions = opts.deductions ?? (existing ? Number(existing.deductions) : 0);
  const incentives = opts.incentives ?? (existing ? Number(existing.incentives) : 0);

  let grossPayout = 0;
  const employmentType = staff.employmentType || "salaried";

  if (employmentType === "salaried") {
    grossPayout = baseSalary;
  } else if (employmentType === "per_job") {
    grossPayout = washEarnings + dailyCleaningEarnings + solarEarnings + distanceAllowance;
  } else {
    // Hybrid: base salary plus performance piece rates
    grossPayout = baseSalary + washEarnings + dailyCleaningEarnings + solarEarnings + distanceAllowance;
  }

  const netPayoutDue = Math.max(0, grossPayout + incentives - deductions);

  const values = {
    staffId,
    cityId: staff.cityId ?? undefined,
    branchId: staff.branchId,
    periodMonth,
    employmentType,
    baseSalary: baseSalary.toFixed(2),
    perWashRate: perWashRate.toFixed(2),
    perDailyCleaningRate: perDailyCleaningRate.toFixed(2),
    perSolarRate: perSolarRate.toFixed(2),
    ratePerKm: ratePerKm.toFixed(2),
    completedWashes,
    completedDailyCleans,
    completedSolarVisits,
    distanceKm: "0.00",
    washEarnings: washEarnings.toFixed(2),
    dailyCleaningEarnings: dailyCleaningEarnings.toFixed(2),
    solarEarnings: solarEarnings.toFixed(2),
    distanceAllowance: distanceAllowance.toFixed(2),
    grossPayout: grossPayout.toFixed(2),
    deductions: deductions.toFixed(2),
    incentives: incentives.toFixed(2),
    netPayoutDue: netPayoutDue.toFixed(2),
    notes: opts.notes ?? existing?.notes ?? undefined,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(staffPayoutLedgersTable)
      .set(values)
      .where(eq(staffPayoutLedgersTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(staffPayoutLedgersTable)
    .values({
      ...values,
      status: "draft",
    })
    .returning();

  return created;
}

export async function getStaffPayouts(staffId: number): Promise<StaffPayoutLedger[]> {
  return db
    .select()
    .from(staffPayoutLedgersTable)
    .where(eq(staffPayoutLedgersTable.staffId, staffId))
    .orderBy(desc(staffPayoutLedgersTable.periodMonth));
}

export async function approveStaffPayout(payoutId: number, adminId: number): Promise<StaffPayoutLedger> {
  const [payout] = await db
    .select()
    .from(staffPayoutLedgersTable)
    .where(eq(staffPayoutLedgersTable.id, payoutId))
    .limit(1);

  if (!payout) throw new Error("Payout record not found");
  if (payout.status !== "draft") throw new Error(`Cannot approve payout in status: ${payout.status}`);

  const [updated] = await db
    .update(staffPayoutLedgersTable)
    .set({
      status: "approved",
      approvedBy: adminId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(staffPayoutLedgersTable.id, payoutId))
    .returning();

  return updated;
}

export async function disburseStaffPayout(
  payoutId: number,
  adminId: number,
  details: { paymentMethod?: string; transactionReference?: string; notes?: string } = {},
): Promise<StaffPayoutLedger> {
  const [payout] = await db
    .select()
    .from(staffPayoutLedgersTable)
    .where(eq(staffPayoutLedgersTable.id, payoutId))
    .limit(1);

  if (!payout) throw new Error("Payout record not found");
  if (payout.status !== "approved") throw new Error(`Cannot disburse payout in status: ${payout.status}. Payout must be approved first.`);

  const [updated] = await db
    .update(staffPayoutLedgersTable)
    .set({
      status: "disbursed",
      disbursedBy: adminId,
      disbursedAt: new Date(),
      paymentMethod: details.paymentMethod || "bank_transfer",
      transactionReference: details.transactionReference,
      notes: details.notes ?? payout.notes,
      updatedAt: new Date(),
    })
    .where(eq(staffPayoutLedgersTable.id, payoutId))
    .returning();

  return updated;
}
