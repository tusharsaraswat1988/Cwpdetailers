/**
 * Async message queue — BullMQ when REDIS_URL is set, DB fallback otherwise.
 * Queues: sms_queue, whatsapp_queue, email_queue, push_queue
 */
import { db } from "@workspace/db";
import {
  commQueueJobsTable, commDeadLetterTable, commEventsTable,
} from "@workspace/db";
import { eq, and, lte, or, isNull, sql } from "drizzle-orm";
import { sendViaChannel } from "./channels/channelService";
import { syncTimelineFromEvent } from "./timelineService";
import { computeNextRetryAt, shouldDeadLetter } from "./retryEngine";
import { logger } from "../logger";
import type { CommChannel } from "./channels/types";

export type QueuePayload = {
  eventId: number;
  channel: CommChannel;
  companyId?: number | null;
  brandId?: number | null;
  sendPayload: Parameters<typeof sendViaChannel>[1];
};

const CHANNEL_TO_QUEUE: Record<string, "sms_queue" | "whatsapp_queue" | "email_queue" | "push_queue"> = {
  sms: "sms_queue",
  whatsapp: "whatsapp_queue",
  email: "email_queue",
  push: "push_queue",
};

let bullQueues: Map<string, { add: (name: string, data: unknown, opts?: { jobId?: string }) => Promise<unknown> }> | null = null;

async function initBullMQ() {
  if (bullQueues !== null) return bullQueues;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    bullQueues = new Map();
    return bullQueues;
  }
  try {
    const { Queue } = await import("bullmq");
    const connection = { url: redisUrl };
    bullQueues = new Map([
      ["sms_queue", new Queue("sms_queue", { connection })],
      ["whatsapp_queue", new Queue("whatsapp_queue", { connection })],
      ["email_queue", new Queue("email_queue", { connection })],
      ["push_queue", new Queue("push_queue", { connection })],
    ] as const);
  } catch (err) {
    logger.warn({ err }, "BullMQ unavailable — using DB queue fallback");
    bullQueues = new Map();
  }
  return bullQueues;
}

export async function enqueueMessage(payload: QueuePayload, maxRetries = 4) {
  const queueName = CHANNEL_TO_QUEUE[payload.channel] ?? "sms_queue";

  const [job] = await db.insert(commQueueJobsTable).values({
    queueName,
    eventId: payload.eventId,
    brandId: payload.brandId ?? null,
    payload: payload as unknown as Record<string, unknown>,
    status: "queued",
    maxRetries,
    companyId: payload.companyId ?? null,
  }).returning();

  await db.update(commEventsTable).set({ status: "queued" })
    .where(eq(commEventsTable.id, payload.eventId));

  const queues = await initBullMQ();
  const q = queues.get(queueName);
  if (q) {
    await q.add("send", { dbJobId: job!.id, ...payload }, { jobId: String(job!.id) });
    await db.update(commQueueJobsTable).set({ bullJobId: String(job!.id) })
      .where(eq(commQueueJobsTable.id, job!.id));
  }

  return job!;
}

export async function processQueueJobs(limit = 20) {
  const now = new Date();
  const jobs = await db.select().from(commQueueJobsTable)
    .where(and(
      or(
        eq(commQueueJobsTable.status, "queued"),
        and(
          eq(commQueueJobsTable.status, "retrying"),
          or(isNull(commQueueJobsTable.nextRetryAt), lte(commQueueJobsTable.nextRetryAt, now)),
        ),
      ),
    ))
    .orderBy(commQueueJobsTable.createdAt)
    .limit(limit);

  const results: Array<{ jobId: number; ok: boolean; error?: string }> = [];

  for (const job of jobs) {
    await db.update(commQueueJobsTable).set({ status: "processing", updatedAt: new Date() })
      .where(eq(commQueueJobsTable.id, job.id));

    const payload = job.payload as unknown as QueuePayload;
    try {
      await db.update(commEventsTable).set({ status: "processing" })
        .where(eq(commEventsTable.id, payload.eventId));

      const result = await sendViaChannel(payload.channel, payload.sendPayload);

      if (result.success) {
        await db.update(commEventsTable).set({
          status: "sent",
          externalId: result.externalId ?? null,
          sentAt: new Date(),
          deliveredAt: new Date(),
        }).where(eq(commEventsTable.id, payload.eventId));

        await db.update(commQueueJobsTable).set({
          status: "sent",
          updatedAt: new Date(),
        }).where(eq(commQueueJobsTable.id, job.id));

        await syncTimelineFromEvent(payload.eventId);
        results.push({ jobId: job.id, ok: true });
      } else {
        throw new Error(result.error ?? "Send failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Queue job failed";
      const retryCount = job.retryCount + 1;

      if (shouldDeadLetter(retryCount, job.maxRetries)) {
        await db.update(commQueueJobsTable).set({
          status: "dead_letter",
          retryCount,
          lastError: msg,
          updatedAt: new Date(),
        }).where(eq(commQueueJobsTable.id, job.id));

        await db.update(commEventsTable).set({
          status: "dead_letter",
          errorMessage: msg,
          retryCount,
        }).where(eq(commEventsTable.id, payload.eventId));

        await db.insert(commDeadLetterTable).values({
          queueJobId: job.id,
          eventId: payload.eventId,
          channel: payload.channel as "sms",
          payload: job.payload as Record<string, unknown>,
          error: msg,
          brandId: job.brandId,
          companyId: job.companyId,
        });

        await syncTimelineFromEvent(payload.eventId);
      } else {
        const nextRetryAt = computeNextRetryAt(retryCount - 1);
        await db.update(commQueueJobsTable).set({
          status: "retrying",
          retryCount,
          lastError: msg,
          nextRetryAt,
          updatedAt: new Date(),
        }).where(eq(commQueueJobsTable.id, job.id));

        await db.update(commEventsTable).set({
          status: "retrying",
          retryCount,
          errorMessage: msg,
        }).where(eq(commEventsTable.id, payload.eventId));
      }

      results.push({ jobId: job.id, ok: false, error: msg });
      logger.error({ err, jobId: job.id }, "Queue job failed");
    }
  }

  return results;
}

export async function getQueueStats(companyId?: number | null) {
  const [stats] = await db.select({
    queued: sql<number>`count(*) filter (where ${commQueueJobsTable.status} = 'queued')::int`,
    processing: sql<number>`count(*) filter (where ${commQueueJobsTable.status} = 'processing')::int`,
    retrying: sql<number>`count(*) filter (where ${commQueueJobsTable.status} = 'retrying')::int`,
    failed: sql<number>`count(*) filter (where ${commQueueJobsTable.status} in ('failed','dead_letter'))::int`,
  }).from(commQueueJobsTable)
    .where(companyId ? eq(commQueueJobsTable.companyId, companyId) : undefined);

  const [dlq] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(commDeadLetterTable)
    .where(companyId ? eq(commDeadLetterTable.companyId, companyId) : undefined);

  return { ...(stats ?? {}), deadLetter: dlq?.count ?? 0 };
}
