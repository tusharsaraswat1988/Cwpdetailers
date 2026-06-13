import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedLocationsTable = pgTable("saved_locations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  label: text("label").notNull(),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  placeId: text("place_id"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSavedLocationSchema = createInsertSchema(savedLocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type SavedLocation = typeof savedLocationsTable.$inferSelect;
export type InsertSavedLocation = z.infer<typeof insertSavedLocationSchema>;
