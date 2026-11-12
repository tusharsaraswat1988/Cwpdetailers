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
  proRataPolicy?: ProRataPolicy;
};

export type ProRataPolicy = "calendar_days" | "fixed_30_days" | "working_days";

export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Computes mid-month pro-rata salary for salaried/hybrid staff.
 * PRD v4.2 (PAY-005): Accurately pro-rates base pay based on staff joiningDate.
 */
export function computeProRataSalary(
  baseSalary: number,
  periodMonth: string, // "YYYY-MM"
  joiningDateStr?: string | Date | null,
  policy: ProRataPolicy = "calendar_days",
): {
  effectiveBaseSalary: number;
  proRataFactor: number;
  daysActive: number;
  totalDaysInPeriod: number;
  isProRated: boolean;
} {
  const [yearStr, monthStr] = periodMonth.split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const totalDaysInPeriod = policy === "fixed_30_days" ? 30 : getDaysInMonth(year, month - 1);

  if (!joiningDateStr || baseSalary <= 0) {
    return {
      effectiveBaseSalary: baseSalary,
      proRataFactor: 1.0,
      daysActive: totalDaysInPeriod,
      totalDaysInPeriod,
      isProRated: false,
    };
  }

  const joinDateIso = typeof joiningDateStr === "string"
    ? joiningDateStr.slice(0, 10)
    : joiningDateStr.toISOString().slice(0, 10);

  const startOfMonth = `${yearStr}-${String(month).padStart(2, "0")}-01`;
  const endOfMonthDay = getDaysInMonth(year, month - 1);
  const endOfMonth = `${yearStr}-${String(month).padStart(2, "0")}-${String(endOfMonthDay).padStart(2, "0")}`;

  // If joined before or on the 1st of this month: full month
  if (joinDateIso <= startOfMonth) {
    return {
      effectiveBaseSalary: baseSalary,
      proRataFactor: 1.0,
      daysActive: totalDaysInPeriod,
      totalDaysInPeriod,
      isProRated: false,
    };
  }

  // If joined after this month: 0 days active
  if (joinDateIso > endOfMonth) {
    return {
      effectiveBaseSalary: 0,
      proRataFactor: 0,
      daysActive: 0,
      totalDaysInPeriod,
      isProRated: true,
    };
  }

  // Mid-month joiner: calculate days active from joining date to end of month inclusive
  const joinDay = parseInt(joinDateIso.split("-")[2]!, 10);
  const daysActive = endOfMonthDay - joinDay + 1;
  const proRataFactor = Math.max(0, Math.min(1, daysActive / totalDaysInPeriod));
  const effectiveBaseSalary = Math.round(baseSalary * proRataFactor * 100) / 100;

  return {
    effectiveBaseSalary,
    proRataFactor,
    daysActive,
    totalDaysInPeriod,
    isProRated: daysActive < totalDaysInPeriod,
  };
}

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

  // Pro-rata base salary calculation for salaried/hybrid models (PAY-005)
  const proRata = computeProRataSalary(
    baseSalary,
    periodMonth,
    staff.joiningDate,
    opts.proRataPolicy ?? "calendar_days",
  );
  const effectiveBaseSalary = proRata.effectiveBaseSalary;

  let grossPayout = 0;
  const employmentType = staff.employmentType || "salaried";

  if (employmentType === "salaried") {
    grossPayout = effectiveBaseSalary;
  } else if (employmentType === "per_job") {
    grossPayout = washEarnings + dailyCleaningEarnings + solarEarnings + distanceAllowance;
  } else {
    // Hybrid: pro-rated base salary plus performance piece rates
    grossPayout = effectiveBaseSalary + washEarnings + dailyCleaningEarnings + solarEarnings + distanceAllowance;
  }

  const netPayoutDue = Math.max(0, grossPayout + incentives - deductions);

  let payoutNotes = opts.notes ?? existing?.notes ?? undefined;
  if (proRata.isProRated) {
    const proRataNote = `Pro-rated for ${proRata.daysActive}/${proRata.totalDaysInPeriod} days active (joined ${staff.joiningDate})`;
    payoutNotes = payoutNotes ? `${payoutNotes} | ${proRataNote}` : proRataNote;
  }

  const values = {
    staffId,
    cityId: staff.cityId ?? undefined,
    branchId: staff.branchId,
    periodMonth,
    employmentType,
    baseSalary: effectiveBaseSalary.toFixed(2),
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
    notes: payoutNotes,
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
