import {
  pgTable, serial, integer, text, date, timestamp, pgEnum, doublePrecision, boolean, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Phase 5.2 — schedule-only lifecycle. Ends at waiting_assignment. */
export const bookingStatusEnum = pgEnum("booking_status", [
  "draft",
  "scheduled",
  "confirmed",
  "waiting_assignment",
  "assigned",
  "in_progress",
  "completed",
  "missed",
  "rescheduled",
  "cancelled",
]);

/**
 * Why the booking exists — not catalog SKU, not pricing.
 * Keeps ERP extensible without embedding product-line logic in the engine.
 */
export const bookingTypeEnum = pgEnum("booking_type", [
  "one_time",
  "subscription_visit",
  "contract_visit",
  "inspection",
  "follow_up",
  "other",
]);

export const bookingServiceTypeEnum = pgEnum("booking_service_type", [
  "car_wash", "detailing", "solar_cleaning", "one_time_wash", "daily_cleaning", "subscription_wash", "pickup_drop", "emergency",
]);

/**
 * Booking Engine — when and where will this service be performed?
 * Does NOT own pricing, staff, photos, or execution.
 *
 * Time model: scheduledStartAt / scheduledEndAt / durationMinutes are canonical.
 * scheduledDate / scheduledTime remain denormalized for list filters and UX.
 */
export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  /** Forward link to commercial intent (Phase 5.1 contract registry). */
  contractRegistryId: integer("contract_registry_id"),
  serviceLocationId: integer("service_location_id"),
  assetId: integer("asset_id"),
  /** Bridge until all writers resolve vehicle/solar via assetId only. */
  vehicleId: integer("vehicle_id"),
  solarSiteId: integer("solar_site_id"),
  serviceId: integer("service_id"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  cityId: integer("city_id"),
  /** Why this booking exists (schedule intent), independent of catalog SKU. */
  bookingType: bookingTypeEnum("booking_type").notNull().default("one_time"),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  /** Canonical window — supports variable duration (not fixed 1-hour slots). */
  scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
  scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  status: bookingStatusEnum("status").notNull().default("scheduled"),
  serviceType: bookingServiceTypeEnum("service_type").notNull(),
  /** Temporary address bridge until addressSnapshotId is always written. */
  address: text("address"),
  area: text("area"),
  locationLat: doublePrecision("location_lat"),
  locationLng: doublePrecision("location_lng"),
  placeId: text("place_id"),
  savedLocationId: integer("saved_location_id"),
  addressSnapshotId: integer("address_snapshot_id"),
  addressIdentityId: integer("address_identity_id"),
  addressId: integer("address_id"),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  customerConfirmedAt: timestamp("customer_confirmed_at"),
  assignedStaffId: integer("assigned_staff_id"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  rescheduledFromBookingId: integer("rescheduled_from_booking_id"),
  rescheduledToBookingId: integer("rescheduled_to_booking_id"),
  isMakeupBooking: boolean("is_makeup_booking").notNull().default(false),
  makeupEligibilityStatus: text("makeup_eligibility_status"),
  technicianEnRouteAt: timestamp("technician_en_route_at", { withTimezone: true }),
  estimatedArrivalAt: timestamp("estimated_arrival_at", { withTimezone: true }),
  etaMinutes: integer("eta_minutes"),
  lastLocationUpdateAt: timestamp("last_location_update_at", { withTimezone: true }),
  lastKnownLatitude: doublePrecision("last_known_latitude"),
  lastKnownLongitude: doublePrecision("last_known_longitude"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("bookings_scheduled_date_idx").on(table.scheduledDate),
  index("bookings_branch_date_idx").on(table.branchId, table.scheduledDate),
  index("bookings_customer_date_idx").on(table.customerId, table.scheduledDate),
  index("bookings_asset_date_idx").on(table.assetId, table.scheduledDate),
  index("bookings_status_idx").on(table.status),
  index("bookings_assigned_staff_idx").on(table.assignedStaffId),
  index("bookings_contract_registry_idx").on(table.contractRegistryId),
  index("bookings_start_at_idx").on(table.scheduledStartAt),
  index("bookings_type_idx").on(table.bookingType),
  index("bookings_rescheduled_from_idx").on(table.rescheduledFromBookingId),
  index("bookings_rescheduled_to_idx").on(table.rescheduledToBookingId),
]);

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type BookingStatus = typeof bookingStatusEnum.enumValues[number];
export type BookingType = typeof bookingTypeEnum.enumValues[number];

export const makeupApprovalStatusEnum = pgEnum("makeup_approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const makeupApprovalRequestsTable = pgTable("makeup_approval_requests", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  customerId: integer("customer_id").notNull(),
  cityId: integer("city_id"),
  branchId: integer("branch_id"),
  contractRegistryId: integer("contract_registry_id"),
  requestedDate: date("requested_date").notNull(),
  requestedTime: text("requested_time").notNull(),
  requestedNotes: text("requested_notes"),
  reason: text("reason").notNull(),
  status: makeupApprovalStatusEnum("status").notNull().default("pending"),
  decidedBy: integer("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionReason: text("decision_reason"),
  createdBookingId: integer("created_booking_id"),
  previousMakeupsCount: integer("previous_makeups_count").notNull().default(0),
  applicableQuota: integer("applicable_quota").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("makeup_approvals_status_idx").on(table.status),
  index("makeup_approvals_city_branch_idx").on(table.cityId, table.branchId),
  index("makeup_approvals_booking_idx").on(table.bookingId),
  index("makeup_approvals_customer_idx").on(table.customerId),
]);

export const insertMakeupApprovalRequestSchema = createInsertSchema(makeupApprovalRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type MakeupApprovalRequest = typeof makeupApprovalRequestsTable.$inferSelect;
export type InsertMakeupApprovalRequest = z.infer<typeof insertMakeupApprovalRequestSchema>;
