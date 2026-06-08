import { pgTable, serial, integer, text, numeric, date, timestamp, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotationStatusEnum = pgEnum("quotation_status", ["draft", "sent", "accepted", "rejected", "converted"]);

export type QuotationItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: text("quotation_number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  leadId: integer("lead_id"),
  bookingId: integer("booking_id"),
  items: json("items").$type<QuotationItem[]>().notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: quotationStatusEnum("status").notNull().default("draft"),
  validUntil: date("valid_until"),
  notes: text("notes"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;
