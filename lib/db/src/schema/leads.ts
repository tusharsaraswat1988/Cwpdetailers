import { pgTable, serial, text, integer, timestamp, pgEnum, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadStatusEnum = pgEnum("lead_status", [
  "new", "contacted", "interested", "quotation", "booked", "completed", "subscription", "lost",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "whatsapp", "instagram", "facebook", "website", "call", "google", "walk_in", "referral",
]);

export const leadServiceInterestEnum = pgEnum("lead_service_interest", [
  "one_time_wash", "detailing", "daily_cleaning", "solar", "accessories",
]);

export const leadLostReasonEnum = pgEnum("lead_lost_reason", [
  "too_expensive", "not_interested", "no_response", "chose_competitor", "location_issue", "other",
]);

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  secondaryPhone: text("secondary_phone"),
  city: text("city"),
  source: leadSourceEnum("source").notNull(),
  serviceInterest: leadServiceInterestEnum("service_interest"),
  assignedToStaffId: integer("assigned_to_staff_id"),
  status: leadStatusEnum("status").notNull().default("new"),
  notes: text("notes"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  valueEstimate: numeric("value_estimate", { precision: 10, scale: 2 }),
  lostReason: leadLostReasonEnum("lost_reason"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  customerId: integer("customer_id"),
  bookingId: integer("booking_id"),
  subscriptionId: integer("subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true, createdAt: true, updatedAt: true, customerId: true, bookingId: true, subscriptionId: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
