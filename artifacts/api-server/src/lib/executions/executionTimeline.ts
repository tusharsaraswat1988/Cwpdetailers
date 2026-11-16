import type { Logger } from "pino";
import { db, executionTimelineTable, type ExecutionTimelineEventType } from "@workspace/db";
import { eq, asc, desc, and } from "drizzle-orm";

const TITLES: Record<ExecutionTimelineEventType, string> = {
  EXECUTION_READY: "Ready for Execution",
  EXECUTION_STARTED: "Work Started",
  EXECUTION_PAUSED: "Work Paused",
  EXECUTION_RESUMED: "Work Resumed",
  EXECUTION_COMPLETED: "Work Completed",
  EXECUTION_CANCELLED: "Execution Cancelled",
  BEFORE_PHOTOS_UPLOADED: "Before Photos Uploaded",
  AFTER_PHOTOS_UPLOADED: "After Photos Uploaded",
  CHECKLIST_UPDATED: "Checklist Updated",
  CHECKLIST_COMPLETED: "Checklist Completed",
  NOTE_ADDED: "Note Added",
  SIGNATURE_CAPTURED: "Customer Signature Captured",
};

export type RecordExecutionTimelineInput = {
  executionId: number;
  eventType: ExecutionTimelineEventType;
  title?: string;
  description?: string;
  actorId?: number | null;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordExecutionTimeline(
  input: RecordExecutionTimelineInput,
  _logger?: Logger,
) {
  // Prevent duplicate consecutive timeline events with identical executionId, eventType, and description within 5 seconds
  const [recent] = await db.select()
    .from(executionTimelineTable)
    .where(and(
      eq(executionTimelineTable.executionId, input.executionId),
      eq(executionTimelineTable.eventType, input.eventType),
    ))
    .orderBy(desc(executionTimelineTable.createdAt))
    .limit(1);

  if (recent) {
    const elapsed = Date.now() - new Date(recent.createdAt).getTime();
    if (elapsed < 5000 && recent.description === (input.description ?? null)) {
      return recent;
    }
  }

  const [entry] = await db.insert(executionTimelineTable).values({
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

export async function getExecutionTimeline(executionId: number) {
  return db.select().from(executionTimelineTable)
    .where(eq(executionTimelineTable.executionId, executionId))
    .orderBy(asc(executionTimelineTable.createdAt));
}
