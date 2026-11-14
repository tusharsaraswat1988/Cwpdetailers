import { pgTable, serial, text, integer, numeric, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { bookingsTable } from "./bookings";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { servicesTable } from "./services";
import { usersTable } from "./users";
import { notificationsTable } from "./notifications";

// ============================================================================
// 1. Customer Referrals Table
// ============================================================================
export const customerReferralsTable = pgTable("customer_referrals", {
  id: serial("id").primaryKey(),
  referrerCustomerId: integer("referrer_customer_id").notNull().references(() => customersTable.id),
  refereeCustomerId: integer("referee_customer_id").notNull().unique().references(() => customersTable.id),
  referralCode: text("referral_code").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'rejected', 'flagged_fraud'
  attributedBookingId: integer("attributed_booking_id").references(() => bookingsTable.id),
  bookingCompletedAt: timestamp("booking_completed_at"),
  referrerRewardPoints: integer("referrer_reward_points").notNull().default(0),
  refereeRewardPoints: integer("referee_reward_points").notNull().default(0),
  rewardStatus: text("reward_status").notNull().default("pending"), // 'pending', 'rewarded', 'forfeited', 'reversed'
  rewardIssuedAt: timestamp("reward_issued_at"),
  fraudFlagReason: text("fraud_flag_reason"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomerReferralSchema = createInsertSchema(customerReferralsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerReferral = z.infer<typeof insertCustomerReferralSchema>;
export type CustomerReferral = typeof customerReferralsTable.$inferSelect;

// ============================================================================
// 2. Loyalty Programs Configuration Table
// ============================================================================
export const loyaltyProgramsConfigTable = pgTable("loyalty_programs_config", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cityId: integer("city_id").references(() => citiesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  pointsPer100Spent: integer("points_per_100_spent").notNull().default(5),
  firstBookingBonusPoints: integer("first_booking_bonus_points").notNull().default(50),
  referrerRewardPoints: integer("referrer_reward_points").notNull().default(200),
  refereeRewardPoints: integer("referee_reward_points").notNull().default(100),
  redemptionRupeesPerPoint: numeric("redemption_rupees_per_point", { precision: 10, scale: 2 }).notNull().default("1.00"),
  minRedemptionPoints: integer("min_redemption_points").notNull().default(50),
  maxRedemptionPointsPerOrder: integer("max_redemption_points_per_order").notNull().default(500),
  maxRedemptionPercentageOrder: integer("max_redemption_percentage_order").notNull().default(50),
  pointsValidityDays: integer("points_validity_days").notNull().default(180),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLoyaltyProgramsConfigSchema = createInsertSchema(loyaltyProgramsConfigTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLoyaltyProgramsConfig = z.infer<typeof insertLoyaltyProgramsConfigSchema>;
export type LoyaltyProgramConfig = typeof loyaltyProgramsConfigTable.$inferSelect;

// ============================================================================
// 3. Loyalty Points Ledger (Immutable Financial Record)
// ============================================================================
export const loyaltyLedgerTable = pgTable("loyalty_ledger", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  cityId: integer("city_id").references(() => citiesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  transactionType: text("transaction_type").notNull(), // 'credit', 'debit', 'reversal', 'expiry'
  points: integer("points").notNull(),
  rupeeEquivalent: numeric("rupee_equivalent", { precision: 10, scale: 2 }).notNull().default("0.00"),
  balanceAfter: integer("balance_after").notNull(),
  sourceReference: text("source_reference").notNull(), // 'booking_completion', 'first_booking_bonus', 'referral_reward', 'referral_welcome', 'checkout_redemption', 'admin_adjustment', 'retention_campaign', 'expiry', 'refund_reversal'
  bookingId: integer("booking_id").references(() => bookingsTable.id),
  referralId: integer("referral_id").references(() => customerReferralsTable.id),
  reversalOfId: integer("reversal_of_id"),
  status: text("status").notNull().default("active"), // 'active', 'reversed', 'expired'
  consumedPoints: integer("consumed_points").notNull().default(0),
  idempotencyKey: text("idempotency_key").unique(),
  expiresAt: timestamp("expires_at"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLoyaltyLedgerSchema = createInsertSchema(loyaltyLedgerTable).omit({ id: true, createdAt: true });
export type InsertLoyaltyLedger = z.infer<typeof insertLoyaltyLedgerSchema>;
export type LoyaltyLedgerEntry = typeof loyaltyLedgerTable.$inferSelect;

// ============================================================================
// 4. Customer Retention & Re-engagement Automations
// ============================================================================
export const retentionAutomationsTable = pgTable("retention_automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // 'registered_no_booking', 'inactive_customer', 'subscription_expiring', 'booking_followup', 'points_expiring'
  delayDays: integer("delay_days").notNull().default(7),
  cityId: integer("city_id").references(() => citiesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  serviceId: integer("service_id").references(() => servicesTable.id),
  couponCode: text("coupon_code"),
  rewardPoints: integer("reward_points").notNull().default(0),
  titleTemplate: text("title_template").notNull(),
  messageTemplate: text("message_template").notNull(),
  frequencyCapDays: integer("frequency_cap_days").notNull().default(30),
  channel: text("channel").notNull().default("in_app"), // 'in_app', 'sms', 'whatsapp'
  isActive: boolean("is_active").notNull().default(true),
  totalEvaluatedCount: integer("total_evaluated_count").notNull().default(0),
  totalTriggeredCount: integer("total_triggered_count").notNull().default(0),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRetentionAutomationSchema = createInsertSchema(retentionAutomationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRetentionAutomation = z.infer<typeof insertRetentionAutomationSchema>;
export type RetentionAutomation = typeof retentionAutomationsTable.$inferSelect;

// ============================================================================
// 5. Retention Automation Execution Logs
// ============================================================================
export const retentionExecutionLogsTable = pgTable("retention_execution_logs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => retentionAutomationsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  cityId: integer("city_id").references(() => citiesTable.id),
  channel: text("channel").notNull(),
  notificationId: integer("notification_id").references(() => notificationsTable.id),
  status: text("status").notNull(), // 'sent', 'skipped_frequency_cap', 'skipped_consent', 'failed'
  messagePayload: jsonb("message_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRetentionExecutionLogSchema = createInsertSchema(retentionExecutionLogsTable).omit({ id: true, createdAt: true });
export type InsertRetentionExecutionLog = z.infer<typeof insertRetentionExecutionLogSchema>;
export type RetentionExecutionLog = typeof retentionExecutionLogsTable.$inferSelect;
