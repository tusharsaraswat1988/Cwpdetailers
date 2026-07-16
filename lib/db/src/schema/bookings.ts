import { pgTable, serial, integer, text, numeric, date, timestamp, pgEnum, json, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { bookingPlatformStatusEnum } from "./booking-platform";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending", "confirmed", "scheduled", "en_route", "in_progress", "completed", "cancelled", "rescheduled", "missed",
]);
export const bookingServiceTypeEnum = pgEnum("booking_service_type", [
  "car_wash", "detailing", "solar_cleaning", "one_time_wash", "daily_cleaning", "subscription_wash", "pickup_drop", "emergency",
]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  serviceLocationId: integer("service_location_id"),
  assetId: integer("asset_id"),
  vehicleId: integer("vehicle_id"),
  solarSiteId: integer("solar_site_id"),
  subscriptionId: integer("subscription_id"),
  serviceId: integer("service_id"),
  staffId: integer("staff_id"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  status: bookingStatusEnum("status").notNull().default("scheduled"),
  serviceType: bookingServiceTypeEnum("service_type").notNull(),
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
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancellationReason: text("cancellation_reason"),
  proofPhotoUrls: json("proof_photo_urls").$type<string[]>().default([]),
  customerSignatureUrl: text("customer_signature_url"),
  beforePhotoUrl: text("before_photo_url"),
  afterPhotoUrl: text("after_photo_url"),
  technicianNotes: text("technician_notes"),
  rating: integer("rating"),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  cityId: integer("city_id"),
  entitlementId: integer("entitlement_id"),
  addonIds: json("addon_ids").$type<number[]>().default([]),
  recurrenceRule: text("recurrence_rule"),
  parentBookingId: integer("parent_booking_id"),
  platformStatus: bookingPlatformStatusEnum("platform_status").default("DRAFT"),
  coverageStatus: text("coverage_status"),
  coverageValidationId: text("coverage_validation_id"),
  confidenceScore: doublePrecision("confidence_score"),
  locationContextSnapshot: jsonb("location_context_snapshot").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
