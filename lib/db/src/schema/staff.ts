import { pgTable, serial, text, integer, numeric, boolean, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffRoleEnum = pgEnum("staff_role", ["technician", "supervisor", "driver", "solar_technician"]);
export const staffVerificationEnum = pgEnum("staff_verification_status", ["pending", "verified", "rejected"]);

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  franchiseeId: integer("franchisee_id"),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  role: staffRoleEnum("role").notNull(),
  branchId: integer("branch_id").notNull(),
  monthlySalary: numeric("monthly_salary", { precision: 10, scale: 2 }),
  joiningDate: date("joining_date"),
  localAddress: text("local_address"),
  permanentAddress: text("permanent_address"),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  aadhaar: text("aadhaar"),
  pan: text("pan"),
  bankAccountName: text("bank_account_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfsc: text("bank_ifsc"),
  bankPassbookUrl: text("bank_passbook_url"),
  agreementUrl: text("agreement_url"),
  verificationStatus: staffVerificationEnum("verification_status").notNull().default("pending"),
  verificationNotes: text("verification_notes"),
  verifiedAt: timestamp("verified_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
