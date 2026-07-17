import { pgTable, serial, integer, text, timestamp, pgEnum, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Phase 5.4 — execution audit timeline (Execution owns this). */
export const executionTimelineEventTypeEnum = pgEnum("execution_timeline_event_type", [
  "EXECUTION_READY",
  "EXECUTION_STARTED",
  "EXECUTION_PAUSED",
  "EXECUTION_RESUMED",
  "EXECUTION_COMPLETED",
  "EXECUTION_CANCELLED",
  "BEFORE_PHOTOS_UPLOADED",
  "AFTER_PHOTOS_UPLOADED",
  "CHECKLIST_UPDATED",
  "CHECKLIST_COMPLETED",
  "NOTE_ADDED",
  "SIGNATURE_CAPTURED",
]);

export const executionTimelineTable = pgTable("execution_timeline", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull(),
  eventType: executionTimelineEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_execution_timeline_execution").on(t.executionId),
  index("idx_execution_timeline_event").on(t.eventType),
]);

export const insertExecutionTimelineSchema = createInsertSchema(executionTimelineTable).omit({
  id: true,
  createdAt: true,
});

export type ExecutionTimeline = typeof executionTimelineTable.$inferSelect;
export type InsertExecutionTimeline = z.infer<typeof insertExecutionTimelineSchema>;
export type ExecutionTimelineEventType = typeof executionTimelineEventTypeEnum.enumValues[number];
