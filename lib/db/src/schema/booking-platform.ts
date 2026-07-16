import { pgTable, serial, integer, text, timestamp, pgEnum, json, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bookingsTable } from "./bookings";

export const bookingPlatformStatusEnum = pgEnum("booking_platform_status", [
  "DRAFT", "VALIDATED", "CONFIRMED", "PAYMENT_PENDING", "ASSIGNED", "ACCEPTED",
  "TRAVELLING", "ARRIVED", "STARTED", "PAUSED", "RESUMED", "COMPLETED",
  "CANCELLED", "FAILED", "REVIEW_PENDING", "REVIEWED", "ARCHIVED",
]);

export const bookingSnapshotTypeEnum = pgEnum("booking_snapshot_type", [
  "ADDRESS", "LOCATION", "COVERAGE", "PRICE", "STAFF", "VEHICLE", "COUPON",
]);

export const bookingTimelineEventTypeEnum = pgEnum("booking_timeline_event_type", [
  "BOOKING_CREATED", "COVERAGE_VALIDATED", "ADDRESS_SNAPSHOT_CREATED",
  "PRICE_CALCULATED", "BOOKING_VALIDATED", "BOOKING_CONFIRMED",
  "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ASSIGNED", "ACCEPTED",
  "TRAVELLING", "ARRIVED", "STARTED", "PAUSED", "RESUMED",
  "COMPLETED", "CANCELLED", "FAILED", "REVIEW_PENDING", "REVIEWED",
  "ARCHIVED", "ADDRESS_CHANGED", "RESCHEDULED", "PROOF_UPLOADED",
  "BUSINESS_RULE_EVALUATED", "SERVICE_DISCOVERED",
]);

export const bookingTimelineTable = pgTable("booking_timeline", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  eventType: bookingTimelineEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  fromPlatformStatus: bookingPlatformStatusEnum("from_platform_status"),
  toPlatformStatus: bookingPlatformStatusEnum("to_platform_status"),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  traceId: text("trace_id"),
  requestId: text("request_id"),
  bookingOperationId: text("booking_operation_id"),
  addressIdentityId: integer("address_identity_id"),
  addressSnapshotId: integer("address_snapshot_id"),
  coverageValidationId: text("coverage_validation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingSnapshotsTable = pgTable("booking_snapshots", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookingsTable.id, { onDelete: "cascade" }),
  snapshotType: bookingSnapshotTypeEnum("snapshot_type").notNull(),
  snapshotData: json("snapshot_data").$type<Record<string, unknown>>().notNull().default({}),
  version: integer("version").notNull().default(1),
  traceId: text("trace_id"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingTimelineSchema = createInsertSchema(bookingTimelineTable).omit({ id: true, createdAt: true });
export const insertBookingSnapshotSchema = createInsertSchema(bookingSnapshotsTable).omit({ id: true, createdAt: true });

export type BookingPlatformStatus = typeof bookingPlatformStatusEnum.enumValues[number];
export type BookingSnapshotType = typeof bookingSnapshotTypeEnum.enumValues[number];
export type BookingTimelineEventType = typeof bookingTimelineEventTypeEnum.enumValues[number];
export type BookingTimeline = typeof bookingTimelineTable.$inferSelect;
export type BookingSnapshot = typeof bookingSnapshotsTable.$inferSelect;
export type InsertBookingTimeline = z.infer<typeof insertBookingTimelineSchema>;
export type InsertBookingSnapshot = z.infer<typeof insertBookingSnapshotSchema>;
