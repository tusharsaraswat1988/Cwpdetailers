import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { servicesTable } from "./services";
import { customersTable } from "./customers";

// ─────────────────────────────────────────────────────────────────────────────
// 1. UX Experiments Table (A/B Testing Configuration Engine)
// ─────────────────────────────────────────────────────────────────────────────
export const uxExperimentsTable = pgTable(
  "ux_experiments",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 64 }).notNull().unique(), // e.g. 'homepage_primary_cta', 'service_card_layout', 'booking_flow_steps'
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    targetScreen: varchar("target_screen", { length: 64 }).notNull().default("homepage"), // 'homepage', 'services', 'booking_flow', 'cart'
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "cascade" }), // null = all cities
    branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "cascade" }), // null = all branches
    serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "cascade" }), // null = all services
    status: varchar("status", { length: 32 }).notNull().default("draft"), // 'draft', 'active', 'paused', 'completed'
    variants: jsonb("variants")
      .$type<
        Array<{
          id: string; // 'control', 'variant_b', etc.
          name: string;
          weight: number; // e.g. 50 (percentage)
          config: Record<string, unknown>;
        }>
      >()
      .notNull()
      .default([]),
    trafficAllocation: integer("traffic_allocation").notNull().default(100), // percentage 0 - 100
    primaryMetric: varchar("primary_metric", { length: 64 }).notNull().default("booking_confirmed"),
    winnerVariantId: varchar("winner_variant_id", { length: 64 }),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ux_experiments_key").on(table.key),
    index("idx_ux_experiments_status").on(table.status),
    index("idx_ux_experiments_target").on(table.targetScreen),
    index("idx_ux_experiments_city").on(table.cityId),
  ],
);

export type UxExperiment = typeof uxExperimentsTable.$inferSelect;
export type InsertUxExperiment = typeof uxExperimentsTable.$inferInsert;
export const insertUxExperimentSchema = createInsertSchema(uxExperimentsTable);
export const selectUxExperimentSchema = createSelectSchema(uxExperimentsTable);

// ─────────────────────────────────────────────────────────────────────────────
// 2. UX Experiment Exposures & Conversions Table
// ─────────────────────────────────────────────────────────────────────────────
export const uxExperimentExposuresTable = pgTable(
  "ux_experiment_exposures",
  {
    id: serial("id").primaryKey(),
    experimentId: integer("experiment_id")
      .notNull()
      .references(() => uxExperimentsTable.id, { onDelete: "cascade" }),
    variantId: varchar("variant_id", { length: 64 }).notNull(),
    sessionId: text("session_id").notNull(),
    customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "set null" }),
    deviceType: varchar("device_type", { length: 32 }).default("mobile"),
    firstExposedAt: timestamp("first_exposed_at", { withTimezone: true }).defaultNow().notNull(),
    converted: boolean("converted").notNull().default(false),
    conversionEvent: varchar("conversion_event", { length: 64 }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    conversionValue: numeric("conversion_value", { precision: 10, scale: 2 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    unique("uq_exp_session").on(table.experimentId, table.sessionId),
    index("idx_exp_exposures_exp_var").on(table.experimentId, table.variantId),
    index("idx_exp_exposures_converted").on(table.experimentId, table.converted),
    index("idx_exp_exposures_session").on(table.sessionId),
  ],
);

export type UxExperimentExposure = typeof uxExperimentExposuresTable.$inferSelect;
export type InsertUxExperimentExposure = typeof uxExperimentExposuresTable.$inferInsert;
export const insertUxExperimentExposureSchema = createInsertSchema(uxExperimentExposuresTable);
export const selectUxExperimentExposureSchema = createSelectSchema(uxExperimentExposuresTable);
