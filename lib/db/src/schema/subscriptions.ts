import { pgTable, serial, integer, numeric, date, timestamp, pgEnum, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionTypeEnum = pgEnum("subscription_type", ["daily_wash", "monthly_wash", "solar_amc", "detailing_plan"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "expired", "cancelled", "pending"]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  vehicleId: integer("vehicle_id"),
  solarSiteId: integer("solar_site_id"),
  serviceId: integer("service_id"),
  type: subscriptionTypeEnum("type").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  nextServiceDate: date("next_service_date"),
  frequencyDays: integer("frequency_days"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  dueAmount: numeric("due_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  notes: text("notes"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationRemark: text("cancellation_remark"),
  messageSentAt: timestamp("message_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
