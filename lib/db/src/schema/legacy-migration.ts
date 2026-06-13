import { pgTable, serial, text, integer, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const migrationEntityTypeEnum = pgEnum("migration_entity_type", [
  "customer",
  "user",
  "vehicle",
  "solar_site",
  "subscription",
  "entitlement",
]);

export const migrationRowStatusEnum = pgEnum("migration_row_status", [
  "success",
  "error",
  "skipped",
  "warning",
]);

export const migrationBatchStatusEnum = pgEnum("migration_batch_status", [
  "preview",
  "dry_run",
  "committed",
  "failed",
]);

export const migrationBatchesTable = pgTable("migration_batches", {
  id: serial("id").primaryKey(),
  filename: text("filename"),
  citySlug: text("city_slug"),
  importMode: text("import_mode").notNull().default("upsert"),
  status: migrationBatchStatusEnum("status").notNull().default("preview"),
  summary: jsonb("summary").notNull().default({}),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const migrationEntityMapTable = pgTable("migration_entity_map", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => migrationBatchesTable.id, { onDelete: "cascade" }),
  entityType: migrationEntityTypeEnum("entity_type").notNull(),
  legacyId: text("legacy_id").notNull(),
  platformId: integer("platform_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const migrationRowLogTable = pgTable("migration_row_log", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => migrationBatchesTable.id, { onDelete: "cascade" }),
  sheetName: text("sheet_name").notNull(),
  rowNumber: integer("row_number").notNull(),
  status: migrationRowStatusEnum("status").notNull(),
  message: text("message"),
  legacyId: text("legacy_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMigrationBatchSchema = createInsertSchema(migrationBatchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMigrationBatch = z.infer<typeof insertMigrationBatchSchema>;
export type MigrationBatch = typeof migrationBatchesTable.$inferSelect;
