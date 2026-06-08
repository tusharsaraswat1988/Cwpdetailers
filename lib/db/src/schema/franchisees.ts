import { pgTable, serial, text, integer, numeric, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const franchiseeStatusEnum = pgEnum("franchisee_status", ["active", "inactive", "terminated", "pending"]);

export const franchiseesTable = pgTable("franchisees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  branchId: integer("branch_id"),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  secondaryPhone: text("secondary_phone"),
  currentAddress: text("current_address"),
  permanentAddress: text("permanent_address"),
  aadhaar: text("aadhaar"),
  pan: text("pan"),
  rentAgreementUrl: text("rent_agreement_url"),
  franchiseeAgreementUrl: text("franchisee_agreement_url"),
  tenureStartDate: date("tenure_start_date"),
  tenureEndDate: date("tenure_end_date"),
  finalAmountAgreed: numeric("final_amount_agreed", { precision: 12, scale: 2 }),
  amountDeposited: numeric("amount_deposited", { precision: 12, scale: 2 }).default("0"),
  dueAmount: numeric("due_amount", { precision: 12, scale: 2 }).default("0"),
  bankAccountName: text("bank_account_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfsc: text("bank_ifsc"),
  bankName: text("bank_name"),
  status: franchiseeStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFranchiseeSchema = createInsertSchema(franchiseesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFranchisee = z.infer<typeof insertFranchiseeSchema>;
export type Franchisee = typeof franchiseesTable.$inferSelect;
