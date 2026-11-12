import { pgTable, serial, integer, text, numeric, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable, staffEmploymentTypeEnum } from "./staff";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { usersTable } from "./users";

export const staffPayoutStatusEnum = pgEnum("staff_payout_status", [
  "draft",
  "approved",
  "disbursed",
  "cancelled",
]);

/**
 * Universal Multi-City Staff Compensation & Payout Ledger
 * PRD v4.0 (STAFF-018): Traceable compensation ledger supporting:
 * - Salaried model (fixed base monthly pay)
 * - Per-job model (per-wash, per-daily-clean, per-solar)
 * - Hybrid model (base salary + verified per-job incentive)
 * Scoped by city, branch, and period month.
 */
export const staffPayoutLedgersTable = pgTable("staff_payout_ledgers", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "set null" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  periodMonth: text("period_month").notNull(), // "YYYY-MM"
  employmentType: staffEmploymentTypeEnum("employment_type").notNull().default("salaried"),

  // Snapshot of rates configured on staff member (no guessed rates)
  baseSalary: numeric("base_salary", { precision: 10, scale: 2 }).notNull().default("0"),
  perWashRate: numeric("per_wash_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  perDailyCleaningRate: numeric("per_daily_cleaning_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  perSolarRate: numeric("per_solar_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  ratePerKm: numeric("rate_per_km", { precision: 10, scale: 2 }).notNull().default("0"),

  // Verified work units from completed executions and DCMS visits
  completedWashes: integer("completed_washes").notNull().default(0),
  completedDailyCleans: integer("completed_daily_cleans").notNull().default(0),
  completedSolarVisits: integer("completed_solar_visits").notNull().default(0),
  distanceKm: numeric("distance_km", { precision: 10, scale: 2 }).notNull().default("0"),

  // Calculated components
  washEarnings: numeric("wash_earnings", { precision: 10, scale: 2 }).notNull().default("0"),
  dailyCleaningEarnings: numeric("daily_cleaning_earnings", { precision: 10, scale: 2 }).notNull().default("0"),
  solarEarnings: numeric("solar_earnings", { precision: 10, scale: 2 }).notNull().default("0"),
  distanceAllowance: numeric("distance_allowance", { precision: 10, scale: 2 }).notNull().default("0"),

  // Financial summary
  grossPayout: numeric("gross_payout", { precision: 10, scale: 2 }).notNull().default("0"),
  deductions: numeric("deductions", { precision: 10, scale: 2 }).notNull().default("0"),
  incentives: numeric("incentives", { precision: 10, scale: 2 }).notNull().default("0"),
  netPayoutDue: numeric("net_payout_due", { precision: 10, scale: 2 }).notNull().default("0"),

  // Audit & disbursement
  status: staffPayoutStatusEnum("status").notNull().default("draft"),
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  disbursedBy: integer("disbursed_by").references(() => usersTable.id, { onDelete: "set null" }),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  paymentMethod: text("payment_method"),
  transactionReference: text("transaction_reference"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  staffMonthUnique: uniqueIndex("staff_payout_ledgers_staff_month_unique").on(t.staffId, t.periodMonth),
  periodMonthIdx: index("idx_staff_payout_ledgers_period_month").on(t.periodMonth),
  branchIdx: index("idx_staff_payout_ledgers_branch").on(t.branchId),
  cityIdx: index("idx_staff_payout_ledgers_city").on(t.cityId),
  statusIdx: index("idx_staff_payout_ledgers_status").on(t.status),
}));

export const insertStaffPayoutLedgerSchema = createInsertSchema(staffPayoutLedgersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffPayoutLedger = z.infer<typeof insertStaffPayoutLedgerSchema>;
export type StaffPayoutLedger = typeof staffPayoutLedgersTable.$inferSelect;
