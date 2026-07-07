import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const authOtpCodesTable = pgTable("auth_otp_codes", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: text("purpose").notNull(),
  portal: text("portal").notNull().default("customer"),
  pendingName: text("pending_name"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuthOtpPurpose = "login" | "signup";
