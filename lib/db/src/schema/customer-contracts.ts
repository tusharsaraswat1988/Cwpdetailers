import {
  pgTable, serial, integer, date, timestamp, pgEnum, jsonb, text, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractAssetTypeEnum = pgEnum("contract_asset_type", ["vehicle", "solar_site", "customer"]);

export const contractProductLineEnum = pgEnum("contract_product_line", [
  "daily_cleaning", "wash_package", "monthly_wash", "solar_amc", "detailing_plan", "one_time_service",
]);

export const contractSourceSystemEnum = pgEnum("contract_source_system", [
  "dcms", "entitlement", "subscription", "booking",
]);

export const contractFulfillmentTypeEnum = pgEnum("contract_fulfillment_type", [
  "one_time", "contract_recurring", "contract_credits",
]);

export const contractRegistryStatusEnum = pgEnum("contract_registry_status", [
  "active", "paused", "completed", "expired", "cancelled", "expiring",
]);

export const customerContractsTable = pgTable("customer_contracts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  assetType: contractAssetTypeEnum("asset_type"),
  assetId: integer("asset_id"),
  serviceLocationId: integer("service_location_id"),
  registryAssetId: integer("registry_asset_id"),
  serviceId: integer("service_id"),
  contractType: contractFulfillmentTypeEnum("contract_type"),
  catalogRefKind: text("catalog_ref_kind"),
  catalogRefId: integer("catalog_ref_id"),
  productLine: contractProductLineEnum("product_line").notNull(),
  sourceSystem: contractSourceSystemEnum("source_system").notNull(),
  sourceId: integer("source_id").notNull(),
  status: contractRegistryStatusEnum("status").notNull().default("active"),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  summaryJson: jsonb("summary_json").$type<Record<string, unknown>>().notNull().default({}),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("customer_contracts_source_unique").on(t.sourceSystem, t.sourceId),
  index("idx_customer_contracts_customer").on(t.customerId),
  index("idx_customer_contracts_status").on(t.status),
  index("idx_customer_contracts_product").on(t.productLine),
]);

export const insertCustomerContractSchema = createInsertSchema(customerContractsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type CustomerContract = typeof customerContractsTable.$inferSelect;
export type InsertCustomerContract = z.infer<typeof insertCustomerContractSchema>;
