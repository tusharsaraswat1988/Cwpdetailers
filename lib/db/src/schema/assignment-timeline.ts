import { pgTable, serial, integer, text, timestamp, pgEnum, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Phase 5.3 — assignment audit timeline (Assignment owns this, not Booking). */
export const assignmentTimelineEventTypeEnum = pgEnum("assignment_timeline_event_type", [
  "ASSIGNMENT_CREATED",
  "ASSIGNMENT_CHANGED",
  "ASSIGNMENT_REMOVED",
  "READY_FOR_EXECUTION",
  "NOTE_ADDED",
]);

export const assignmentTimelineTable = pgTable("assignment_timeline", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull(),
  pendingAssignmentId: integer("pending_assignment_id"),
  eventType: assignmentTimelineEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  fromStaffId: integer("from_staff_id"),
  toStaffId: integer("to_staff_id"),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  notes: text("notes"),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_assignment_timeline_assignment").on(t.assignmentId),
  index("idx_assignment_timeline_pending").on(t.pendingAssignmentId),
  index("idx_assignment_timeline_event").on(t.eventType),
]);

export const insertAssignmentTimelineSchema = createInsertSchema(assignmentTimelineTable).omit({
  id: true,
  createdAt: true,
});

export type AssignmentTimeline = typeof assignmentTimelineTable.$inferSelect;
export type InsertAssignmentTimeline = z.infer<typeof insertAssignmentTimelineSchema>;
export type AssignmentTimelineEventType = typeof assignmentTimelineEventTypeEnum.enumValues[number];
