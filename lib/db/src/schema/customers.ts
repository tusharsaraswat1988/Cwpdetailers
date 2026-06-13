import { pgTable, serial, text, integer, numeric, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "suspended"]);

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  status: customerStatusEnum("status").notNull().default("active"),
  walletBalance: numeric("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  totalDues: numeric("total_dues", { precision: 10, scale: 2 }).notNull().default("0"),
  photoUrl: text("photo_url"),
  lastPaymentDate: date("last_payment_date"),
  customerSince: date("customer_since"),
  historicalWashCount: integer("historical_wash_count"),
  historicalSolarVisitCount: integer("historical_solar_visit_count"),
  operationalNotes: text("operational_notes"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  gstin: text("gstin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
