import { pgTable, serial, text, boolean, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const branchesTable = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  city: text("city").notNull(),
  cityId: integer("city_id"),
  address: text("address"),
  phone: text("phone"),
  managerName: text("manager_name"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  legalEntityId: integer("legal_entity_id"),
  isCompanyOperated: boolean("is_company_operated").notNull().default(true),
  status: text("status").notNull().default("active"),
  serviceAvailability: json("service_availability").$type<string[]>(),
  operationalNotes: text("operational_notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBranchSchema = createInsertSchema(branchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branchesTable.$inferSelect;
