import type { Logger } from "pino";
import { db, assignmentTimelineTable, type AssignmentTimelineEventType } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const TITLES: Record<AssignmentTimelineEventType, string> = {
  ASSIGNMENT_CREATED: "Staff Assigned",
  ASSIGNMENT_CHANGED: "Assignment Changed",
  ASSIGNMENT_REMOVED: "Assignment Removed",
  READY_FOR_EXECUTION: "Ready for Execution",
  NOTE_ADDED: "Note Added",
};

export type RecordAssignmentTimelineInput = {
  assignmentId: number;
  pendingAssignmentId?: number | null;
  eventType: AssignmentTimelineEventType;
  title?: string;
  description?: string;
  fromStaffId?: number | null;
  toStaffId?: number | null;
  actorId?: number | null;
  actorName?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAssignmentTimeline(
  input: RecordAssignmentTimelineInput,
  _logger?: Logger,
) {
  const [entry] = await db.insert(assignmentTimelineTable).values({
    assignmentId: input.assignmentId,
    pendingAssignmentId: input.pendingAssignmentId ?? null,
    eventType: input.eventType,
    title: input.title ?? TITLES[input.eventType],
    description: input.description ?? null,
    fromStaffId: input.fromStaffId ?? null,
    toStaffId: input.toStaffId ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  }).returning();
  return entry;
}

export async function getAssignmentTimeline(assignmentId: number) {
  return db.select().from(assignmentTimelineTable)
    .where(eq(assignmentTimelineTable.assignmentId, assignmentId))
    .orderBy(asc(assignmentTimelineTable.createdAt));
}
