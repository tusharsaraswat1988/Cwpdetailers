import { pgTable, serial, integer, text, timestamp, pgEnum, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Phase 5.5 — operational history for Job (= service_execution). Field timeline stays in execution_timeline. */
export const jobOrchestrationTimelineEventTypeEnum = pgEnum("job_orchestration_timeline_event_type", [
  "JOB_ENTERED_QUALITY_REVIEW",
  "JOB_REOPENED",
  "JOB_ESCALATED",
  "JOB_DE_ESCALATED",
  "JOB_PRIORITY_CHANGED",
  "JOB_APPROVED",
  "JOB_READY_FOR_BILLING",
  "JOB_CANCELLED",
  "JOB_OWNERSHIP_CHANGED",
  "JOB_DEPENDENCY_SET",
  "JOB_DEPENDENCY_CLEARED",
]);

export const jobOrchestrationTimelineTable = pgTable("job_orchestration_timeline", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull(),
  eventType: jobOrchestrationTimelineEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_job_orch_timeline_execution").on(t.executionId),
  index("idx_job_orch_timeline_event").on(t.eventType),
]);

export const insertJobOrchestrationTimelineSchema = createInsertSchema(jobOrchestrationTimelineTable).omit({
  id: true,
  createdAt: true,
});

export type JobOrchestrationTimeline = typeof jobOrchestrationTimelineTable.$inferSelect;
export type InsertJobOrchestrationTimeline = z.infer<typeof insertJobOrchestrationTimelineSchema>;
export type JobOrchestrationTimelineEventType = typeof jobOrchestrationTimelineEventTypeEnum.enumValues[number];
