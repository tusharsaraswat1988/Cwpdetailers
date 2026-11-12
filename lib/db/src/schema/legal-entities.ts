import { pgTable, serial, text, boolean, integer, timestamp, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const legalEntitiesTable = pgTable("legal_entities", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  entityType: text("entity_type").notNull().default("company"), // company, franchise, proprietorship, partnership, llp
  gstin: text("gstin"),
  panNumber: text("pan_number"),
  stateCode: text("state_code").notNull().default("09"), // 2-digit GST state code e.g. "09" for UP
  stateName: text("state_name").notNull().default("Uttar Pradesh"),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  pincode: text("pincode").notNull(),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  bankAccountName: text("bank_account_name"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfsc: text("bank_ifsc"),
  bankBranch: text("bank_branch"),
  upiId: text("upi_id"),
  defaultSac: text("default_sac").default("998533"),
  invoicePrefix: text("invoice_prefix").notNull().default("CWP"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  termsAndConditions: json("terms_and_conditions").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_legal_entities_code").on(t.code),
  index("idx_legal_entities_state").on(t.stateCode),
]);

export const invoiceNumberSequencesTable = pgTable("invoice_number_sequences", {
  id: serial("id").primaryKey(),
  legalEntityId: integer("legal_entity_id").notNull(),
  documentType: text("document_type").notNull().default("tax_invoice"), // tax_invoice, credit_note, debit_note
  financialYear: text("financial_year").notNull(), // e.g. "24-25"
  currentValue: integer("current_value").notNull().default(0),
  prefix: text("prefix").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_invoice_seq_entity_type_fy").on(t.legalEntityId, t.documentType, t.financialYear),
]);

export const insertLegalEntitySchema = createInsertSchema(legalEntitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LegalEntity = typeof legalEntitiesTable.$inferSelect;
export type InsertLegalEntity = z.infer<typeof insertLegalEntitySchema>;

export type InvoiceNumberSequence = typeof invoiceNumberSequencesTable.$inferSelect;

export type InvoiceLegalEntitySnapshot = {
  id: number;
  code: string;
  name: string;
  tradeName?: string | null;
  entityType: string;
  gstin?: string | null;
  panNumber?: string | null;
  stateCode: string;
  stateName: string;
  address: string;
  city: string;
  pincode: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
  defaultSac?: string | null;
  invoicePrefix?: string | null;
};
