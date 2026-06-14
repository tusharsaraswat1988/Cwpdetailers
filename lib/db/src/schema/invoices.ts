import { pgTable, serial, integer, text, numeric, date, timestamp, pgEnum, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "cancelled"]);
export const invoiceDocumentTypeEnum = pgEnum("invoice_document_type", ["tax_invoice", "credit_note", "debit_note"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "upi", "card", "bank_transfer", "wallet", "razorpay"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded", "reversed"]);

/** Line item with GST / SAC audit fields stored in JSON on the invoice row. */
export type InvoiceItem = {
  description: string;
  subtitle?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
  /** SAC for services (e.g. 998533 car wash). HSN for goods if applicable. */
  sac?: string;
  hsn?: string;
  gstRate?: number;
  /** Show service on invoice at MRP but charge zero (complimentary / free add-on). */
  isComplimentary?: boolean;
  lineDiscount?: number;
  taxableValue?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  serviceCategory?: string;
};

export type InvoiceCustomerSnapshot = {
  name: string;
  billingName?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  gstin?: string | null;
  placeOfSupply: string;
  supplyStateCode: string;
};

export type InvoiceHsnSummaryRow = {
  sacOrHsn: string;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
};

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  documentType: invoiceDocumentTypeEnum("document_type").notNull().default("tax_invoice"),
  referenceInvoiceId: integer("reference_invoice_id"),
  referenceInvoiceNumber: text("reference_invoice_number"),
  referenceInvoiceDate: date("reference_invoice_date"),
  customerId: integer("customer_id").notNull(),
  customerSnapshot: json("customer_snapshot").$type<InvoiceCustomerSnapshot | null>(),
  subscriptionId: integer("subscription_id"),
  bookingId: integer("booking_id"),
  quotationId: integer("quotation_id"),
  items: json("items").$type<InvoiceItem[]>().notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  roundOff: numeric("round_off", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  dueAmount: numeric("due_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  balanceDue: numeric("balance_due", { precision: 10, scale: 2 }).notNull().default("0"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  gstin: text("gstin"),
  placeOfSupply: text("place_of_supply"),
  supplyStateCode: text("supply_state_code").default("09"),
  isInterState: boolean("is_inter_state").notNull().default(false),
  hsnSummary: json("hsn_summary").$type<InvoiceHsnSummaryRow[] | null>(),
  notes: text("notes"),
  terms: json("terms").$type<string[] | null>(),
  creditReason: text("credit_reason"),
  currency: text("currency").notNull().default("INR"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  dueDate: date("due_date"),
  issuedAt: timestamp("issued_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  invoiceId: integer("invoice_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  transactionId: text("transaction_id"),
  status: paymentStatusEnum("status").notNull().default("completed"),
  notes: text("notes"),
  receivedByStaffId: integer("received_by_staff_id"),
  receivedAt: timestamp("received_at"),
  reversalOfId: integer("reversal_of_id"),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type InvoiceDocumentType = Invoice["documentType"];
