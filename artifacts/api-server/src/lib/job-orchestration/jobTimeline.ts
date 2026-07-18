import type { Logger } from "pino";
import {
  db,
  jobOrchestrationTimelineTable,
  type JobOrchestrationTimelineEventType,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { getExecutionTimeline } from "../executions/executionTimeline";

const TITLES: Record<JobOrchestrationTimelineEventType, string> = {
  JOB_ENTERED_QUALITY_REVIEW: "Entered Quality Review",
  JOB_REOPENED: "Job Reopened",
  JOB_ESCALATED: "Job Escalated",
  JOB_DE_ESCALATED: "Escalation Cleared",
  JOB_PRIORITY_CHANGED: "Priority Changed",
  JOB_APPROVED: "Job Approved",
  JOB_READY_FOR_BILLING: "Ready for Billing",
  JOB_CANCELLED: "Job Cancelled",
  JOB_OWNERSHIP_CHANGED: "Ownership Changed",
  JOB_DEPENDENCY_SET: "Dependency Set",
  JOB_DEPENDENCY_CLEARED: "Dependency Cleared",
};

export type RecordJobTimelineInput = {
  executionId: number;
  eventType: JobOrchestrationTimelineEventType;
  title?: string;
  description?: string;
  actorId?: number | null;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordJobTimeline(
  input: RecordJobTimelineInput,
  _logger?: Logger,
) {
  const [entry] = await db.insert(jobOrchestrationTimelineTable).values({
    executionId: input.executionId,
    eventType: input.eventType,
    title: input.title ?? TITLES[input.eventType],
    description: input.description ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    metadata: input.metadata ?? {},
  }).returning();
  return entry;
}

export async function getJobOpsTimeline(executionId: number) {
  return db.select().from(jobOrchestrationTimelineTable)
    .where(eq(jobOrchestrationTimelineTable.executionId, executionId))
    .orderBy(asc(jobOrchestrationTimelineTable.createdAt));
}

/** Merged field + ops timeline for operational management UI. */
export async function getOperationalTimeline(executionId: number) {
  const [field, ops] = await Promise.all([
    getExecutionTimeline(executionId),
    getJobOpsTimeline(executionId),
  ]);

  const merged = [
    ...field.map((t) => ({
      id: `field-${t.id}`,
      source: "field" as const,
      eventType: t.eventType,
      title: t.title,
      description: t.description,
      actorId: t.actorId,
      actorName: t.actorName,
      metadata: (t.metadata ?? {}) as Record<string, unknown>,
      createdAt: t.createdAt,
    })),
    ...ops.map((t) => ({
      id: `ops-${t.id}`,
      source: "ops" as const,
      eventType: t.eventType,
      title: t.title,
      description: t.description,
      actorId: t.actorId,
      actorName: t.actorName,
      metadata: (t.metadata ?? {}) as Record<string, unknown>,
      createdAt: t.createdAt,
    })),
  ];

  merged.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return merged;
}
