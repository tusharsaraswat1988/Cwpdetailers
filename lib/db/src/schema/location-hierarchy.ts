import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citiesTable, serviceAreasTable } from "./city-masters";

export const geographicLocalitiesTable = pgTable("geographic_localities", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => citiesTable.id, { onDelete: "cascade" }),
  serviceAreaId: integer("service_area_id").references(() => serviceAreasTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  code: text("code"),
  pincode: text("pincode"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  boundaryGeoJson: jsonb("boundary_geojson"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_geographic_localities_city").on(t.cityId),
  index("idx_geographic_localities_slug").on(t.slug),
  index("idx_geographic_localities_pincode").on(t.pincode),
]);

export const locationAliasesTable = pgTable("location_aliases", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'city', 'locality', 'society', 'property'
  entityId: integer("entity_id").notNull(),
  alias: text("alias").notNull(),
  normalizedAlias: text("normalized_alias").notNull(),
  locale: text("locale").notNull().default("en"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_location_aliases_lookup").on(t.entityType, t.normalizedAlias),
  index("idx_location_aliases_entity").on(t.entityType, t.entityId),
]);

export const insertGeographicLocalitySchema = createInsertSchema(geographicLocalitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGeographicLocality = z.infer<typeof insertGeographicLocalitySchema>;
export type GeographicLocality = typeof geographicLocalitiesTable.$inferSelect;

export const insertLocationAliasSchema = createInsertSchema(locationAliasesTable).omit({ id: true, createdAt: true });
export type InsertLocationAlias = z.infer<typeof insertLocationAliasSchema>;
export type LocationAlias = typeof locationAliasesTable.$inferSelect;
