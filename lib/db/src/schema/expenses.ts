import { pgTable, serial, integer, text, numeric, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "chemicals", "fuel", "salary", "rent", "maintenance", "misc",
]);

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: expenseCategoryEnum("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  vendor: text("vendor"),
  receiptUrl: text("receipt_url"),
  paidBy: text("paid_by"),
  expenseDate: date("expense_date").notNull(),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  franchiseeId: integer("franchisee_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
