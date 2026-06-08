import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingEventTypeEnum = pgEnum("booking_event_type", [
  "status_change", "proof_upload", "reassign", "reschedule", "cancel", "note",
]);

export const bookingEventsTable = pgTable("booking_events", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  type: bookingEventTypeEnum("type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  body: text("body"),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingEventSchema = createInsertSchema(bookingEventsTable).omit({ id: true, createdAt: true });
export type InsertBookingEvent = z.infer<typeof insertBookingEventSchema>;
export type BookingEvent = typeof bookingEventsTable.$inferSelect;
