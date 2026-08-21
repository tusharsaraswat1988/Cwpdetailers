import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type SavedLocationGoogleComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export const savedLocationsTable = pgTable("saved_locations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  label: text("label").notNull(),
  /** Readable composed address — display + booking snapshot fallback. */
  address: text("address").notNull(),
  houseNumber: text("house_number"),
  buildingName: text("building_name"),
  area: text("area"),
  landmark: text("landmark"),
  cityId: integer("city_id"),
  cityName: text("city_name"),
  pincode: text("pincode"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  placeId: text("place_id"),
  formattedAddress: text("formatted_address"),
  googleComponents: jsonb("google_components").$type<SavedLocationGoogleComponent[] | null>(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  index("saved_locations_customer_idx").on(table.customerId),
  index("saved_locations_customer_default_idx").on(table.customerId, table.isDefault),
  index("saved_locations_place_id_idx").on(table.placeId),
]);

export const insertSavedLocationSchema = createInsertSchema(savedLocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type SavedLocation = typeof savedLocationsTable.$inferSelect;
export type InsertSavedLocation = z.infer<typeof insertSavedLocationSchema>;
