import { db } from "@workspace/db";
import {
  systemJobsTable, commAutomationsTable, commCampaignsTable,
  commTemplatesTable, customersTable, subscriptionsTable, leadsTable,
} from "@workspace/db";
import { eq, and, lte, sql } from "drizzle-orm";
import { launchCampaign } from "./campaignEngine";
import { dispatchAutomationEvent } from "./automationEngine";
import { processQueueJobs } from "./queueService";
import { continueWorkflowRun } from "./workflowEngine";
import { logger } from "../logger";

export type CommJobPayload =
  | { type: "campaign_send"; campaignId: number }
  | { type: "campaign_batch"; campaignId: number }
  | { type: "automation_trigger"; automationId: number; context: Record<string, unknown> }
  | { type: "process_scheduled" }
  | { type: "process_queue" }
  | { type: "workflow_continue"; runId: number; stepId: number };

export async function enqueueCommJob(payload: CommJobPayload, runAt?: Date) {
  const [job] = await db.insert(systemJobsTable).values({
    jobType: `comm_${payload.type}`,
    status: "pending",
    payload,
    runAt: runAt ?? new Date(),
  }).returning();
  return job;
}

export async function processCommJobs(limit = 10) {
  const now = new Date();
  const jobs = await db.select().from(systemJobsTable)
    .where(and(
      eq(systemJobsTable.status, "pending"),
      sql`${systemJobsTable.jobType} LIKE 'comm_%'`,
      sql`(${systemJobsTable.runAt} IS NULL OR ${systemJobsTable.runAt} <= ${now})`,
    ))
    .limit(limit);

  const results: Array<{ jobId: number; ok: boolean; error?: string }> = [];

  for (const job of jobs) {
    await db.update(systemJobsTable).set({
      status: "running",
      startedAt: new Date(),
    }).where(eq(systemJobsTable.id, job.id));

    try {
      const payload = job.payload as CommJobPayload;
      switch (payload.type) {
        case "campaign_send":
        case "campaign_batch":
          await launchCampaign(payload.campaignId);
          break;
        case "automation_trigger":
          await dispatchAutomationEvent(payload.automationId, payload.context);
          break;
        case "process_scheduled":
          await processScheduledCampaigns();
          await processAutomationTriggers();
          break;
        case "process_queue":
          await processQueueJobs(50);
          break;
        case "workflow_continue":
          await continueWorkflowRun(payload.runId, payload.stepId);
          break;
      }

      await db.update(systemJobsTable).set({
        status: "success",
        completedAt: new Date(),
        lastRunAt: new Date(),
      }).where(eq(systemJobsTable.id, job.id));
      results.push({ jobId: job.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Job failed";
      await db.update(systemJobsTable).set({
        status: "failed",
        error: msg,
        completedAt: new Date(),
        lastRunAt: new Date(),
      }).where(eq(systemJobsTable.id, job.id));
      results.push({ jobId: job.id, ok: false, error: msg });
      logger.error({ err, jobId: job.id }, "Comm job failed");
    }
  }

  return results;
}

async function processScheduledCampaigns() {
  const now = new Date();
  const due = await db.select().from(commCampaignsTable)
    .where(and(
      eq(commCampaignsTable.status, "scheduled"),
      lte(commCampaignsTable.scheduledAt, now),
    ));

  for (const c of due) {
    await enqueueCommJob({ type: "campaign_send", campaignId: c.id });
  }
}

async function processAutomationTriggers() {
  const automations = await db.select().from(commAutomationsTable)
    .where(eq(commAutomationsTable.isActive, true));

  for (const auto of automations) {
    switch (auto.trigger) {
      case "payment_due": {
        const dueCustomers = await db.select({ id: customersTable.id })
          .from(customersTable)
          .where(sql`CAST(${customersTable.totalDues} AS numeric) > 0`)
          .limit(100);
        for (const c of dueCustomers) {
          await dispatchAutomationEvent(auto.id, { customerId: c.id });
        }
        break;
      }
      case "wash_due": {
        const subs = await db.select({ customerId: subscriptionsTable.customerId })
          .from(subscriptionsTable)
          .where(and(
            eq(subscriptionsTable.status, "active"),
            sql`${subscriptionsTable.nextServiceDate} <= CURRENT_DATE`,
          )).limit(100);
        for (const s of subs) {
          if (s.customerId) await dispatchAutomationEvent(auto.id, { customerId: s.customerId });
        }
        break;
      }
      case "package_expiry": {
        const subs = await db.select({ customerId: subscriptionsTable.customerId })
          .from(subscriptionsTable)
          .where(and(
            eq(subscriptionsTable.status, "expiring"),
          )).limit(100);
        for (const s of subs) {
          if (s.customerId) await dispatchAutomationEvent(auto.id, { customerId: s.customerId });
        }
        break;
      }
      case "lead_follow_up": {
        const dueLeads = await db.select({ id: leadsTable.id })
          .from(leadsTable)
          .where(and(
            sql`${leadsTable.nextFollowUpAt} <= NOW()`,
            sql`${leadsTable.status} NOT IN ('lost', 'completed', 'subscription')`,
          )).limit(100);
        for (const l of dueLeads) {
          await dispatchAutomationEvent(auto.id, { leadId: l.id });
        }
        break;
      }
      default:
        break;
    }
  }
}
