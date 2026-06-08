import { pgTable, serial, integer, text, numeric, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]);
export const bookingServiceTypeEnum = pgEnum("booking_service_type", ["car_wash", "detailing", "solar_cleaning", "pickup_drop", "emergency"]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
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
  status: bookingStatusEnum("status").notNull().default("pending"),
  serviceType: bookingServiceTypeEnum("service_type").notNull(),
  address: text("address"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  beforePhotoUrl: text("before_photo_url"),
  afterPhotoUrl: text("after_photo_url"),
  technicianNotes: text("technician_notes"),
  rating: integer("rating"),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
