import { pgTable, serial, text, integer, timestamp, pgEnum, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehicleTypeEnum = pgEnum("vehicle_type", ["sedan", "suv", "hatchback", "luxury", "van", "truck"]);

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  vehicleModelId: integer("vehicle_model_id"),
  /**
   * Optional seating override for pricing (e.g. same model as 5 or 7 seater).
   * When null, pricing falls back to vehicle_models.seat_category_id.
   */
  seatCategoryId: integer("seat_category_id"),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  color: text("color"),
  registrationNumber: text("registration_number").notNull(),
  registrationNormalized: text("registration_normalized"),
  vehicleType: vehicleTypeEnum("vehicle_type").default("sedan"),
  serviceAddress: text("service_address"),
  serviceLat: doublePrecision("service_lat"),
  serviceLng: doublePrecision("service_lng"),
  placeId: text("place_id"),
  locationLabel: text("location_label"),
  locationComplete: boolean("location_complete").notNull().default(false),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  assignedStaffId: integer("assigned_staff_id"),
  refPhotoFrontUrl: text("ref_photo_front_url"),
  refPhotoRearUrl: text("ref_photo_rear_url"),
  refPhotoLeftUrl: text("ref_photo_left_url"),
  refPhotoRightUrl: text("ref_photo_right_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
