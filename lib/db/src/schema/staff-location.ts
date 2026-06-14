import { pgTable, serial, integer, text, timestamp, pgEnum, doublePrecision, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffLocationActionEnum = pgEnum("staff_location_action", [
  "attendance",
  "en_route",
  "job_start",
  "job_complete",
]);

export const staffLocationLogsTable = pgTable("staff_location_logs", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  bookingId: integer("booking_id"),
  subscriptionId: integer("subscription_id"),
  action: staffLocationActionEnum("action").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracyMeters: doublePrecision("accuracy_meters"),
  geoFenceVerified: boolean("geo_fence_verified"),
  geoFenceRadiusMeters: integer("geo_fence_radius_meters"),
  distanceMeters: doublePrecision("distance_meters"),
  targetLatitude: doublePrecision("target_latitude"),
  targetLongitude: doublePrecision("target_longitude"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
});

export const insertStaffLocationLogSchema = createInsertSchema(staffLocationLogsTable).omit({
  id: true,
  recordedAt: true,
});
export type InsertStaffLocationLog = z.infer<typeof insertStaffLocationLogSchema>;
export type StaffLocationLog = typeof staffLocationLogsTable.$inferSelect;
