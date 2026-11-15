import { pgTable, serial, text, integer, boolean, timestamp, date, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { usersTable } from "./users";

export const closureCategoryEnum = [
  "govt_holiday",
  "casual_holiday",
  "natural_calamity",
  "staff_absenteeism",
  "operational_issue",
  "overbooking_freeze",
  "other",
] as const;

export type ClosureCategory = (typeof closureCategoryEnum)[number];

export const operatingHoursTable = pgTable(
  "operating_hours",
  {
    id: serial("id").primaryKey(),
    scopeType: text("scope_type").notNull().default("global"), // 'global', 'city', 'branch'
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
    isWorkingDay: boolean("is_working_day").notNull().default(true),
    openTime: text("open_time").notNull().default("08:00"),
    closeTime: text("close_time").notNull().default("18:00"),
    slotStepMinutes: integer("slot_step_minutes").notNull().default(15),
    maxConcurrentSlots: integer("max_concurrent_slots").notNull().default(8),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    lookupIdx: index("idx_operating_hours_lookup").on(t.scopeType, t.cityId, t.branchId, t.dayOfWeek),
  }),
);

export const insertOperatingHoursSchema = createInsertSchema(operatingHoursTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOperatingHours = z.infer<typeof insertOperatingHoursSchema>;
export type OperatingHours = typeof operatingHoursTable.$inferSelect;

export const operationalClosuresTable = pgTable(
  "operational_closures",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category").notNull(), // govt_holiday, casual_holiday, natural_calamity, etc.
    customerReason: text("customer_reason").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isFullDay: boolean("is_full_day").notNull().default(true),
    startTime: text("start_time"),
    endTime: text("end_time"),
    scopeType: text("scope_type").notNull().default("global"), // 'global', 'city', 'branch'
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "cascade" }),
    exemptSegments: jsonb("exempt_segments").$type<string[]>().notNull().default(["daily_cleaning"]),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    datesIdx: index("idx_operational_closures_dates").on(t.startDate, t.endDate, t.isActive),
    scopeIdx: index("idx_operational_closures_scope").on(t.scopeType, t.cityId, t.branchId),
  }),
);

export const insertOperationalClosureSchema = createInsertSchema(operationalClosuresTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOperationalClosure = z.infer<typeof insertOperationalClosureSchema>;
export type OperationalClosure = typeof operationalClosuresTable.$inferSelect;
