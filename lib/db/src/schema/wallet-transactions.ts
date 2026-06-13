import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", ["credit", "debit"]);
export const walletPaymentModeEnum = pgEnum("wallet_payment_mode", ["cash", "upi", "bank_transfer", "adjustment"]);

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  companyId: integer("company_id"),
  type: walletTransactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
  reference: text("reference"),
  referenceId: integer("reference_id"),
  paymentMode: walletPaymentModeEnum("payment_mode"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
