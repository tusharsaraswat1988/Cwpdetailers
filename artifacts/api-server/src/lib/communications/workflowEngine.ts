/**
 * Phase 2 workflow automation engine — multi-step with wait/branch actions.
 */
import { db } from "@workspace/db";
import {
  commWorkflowsTable, commWorkflowStepsTable, commWorkflowRunsTable,
  commTemplatesTable, commEmailTemplatesTable, commWhatsappTemplatesTable,
  commEventsTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { renderTemplate, contextToVars, type RecipientContext } from "./templateEngine";
import { enqueueMessage } from "./queueService";
import { resolveBrandId } from "./brandService";
import { logCommAudit } from "./audit";
import { enqueueCommJob } from "./jobProcessor";

export async function listWorkflows(companyId?: number | null, brandId?: number | null) {
  const conditions = [];
  if (companyId) conditions.push(eq(commWorkflowsTable.companyId, companyId));
  if (brandId) conditions.push(eq(commWorkflowsTable.brandId, brandId));
  return db.select().from(commWorkflowsTable)
    .where(conditions.length ? and(...conditions) : undefined);
}

export async function getWorkflowWithSteps(workflowId: number) {
  const [workflow] = await db.select().from(commWorkflowsTable)
    .where(eq(commWorkflowsTable.id, workflowId)).limit(1);
  if (!workflow) return null;

  const steps = await db.select().from(commWorkflowStepsTable)
    .where(eq(commWorkflowStepsTable.workflowId, workflowId))
    .orderBy(asc(commWorkflowStepsTable.stepOrder));

  return { ...workflow, steps };
}

export async function startWorkflowRun(
  workflowId: number,
  context: RecipientContext & { companyId?: number | null },
) {
  const wf = await getWorkflowWithSteps(workflowId);
  if (!wf || !wf.isActive) throw new Error("Workflow not found or inactive");

  const [run] = await db.insert(commWorkflowRunsTable).values({
    workflowId,
    customerId: context.customerId ?? null,
    leadId: context.leadId ?? null,
    currentStepId: wf.steps[0]?.id ?? null,
    status: "running",
    context: context as Record<string, unknown>,
    startedAt: new Date(),
    companyId: context.companyId ?? wf.companyId,
  }).returning();

  if (wf.steps[0]) {
    await executeWorkflowStep(run!.id, wf.steps[0].id, context);
  }

  return run!;
}

async function executeWorkflowStep(
  runId: number,
  stepId: number,
  context: RecipientContext & { companyId?: number | null },
) {
  const [run] = await db.select().from(commWorkflowRunsTable)
    .where(eq(commWorkflowRunsTable.id, runId)).limit(1);
  if (!run) return;

  const [step] = await db.select().from(commWorkflowStepsTable)
    .where(eq(commWorkflowStepsTable.id, stepId)).limit(1);
  if (!step) return;

  const [workflow] = await db.select().from(commWorkflowsTable)
    .where(eq(commWorkflowsTable.id, run.workflowId)).limit(1);
  if (!workflow) return;

  const brandId = await resolveBrandId(workflow.brandId, workflow.companyId);
  const cfg = step.config ?? {};

  switch (step.stepType) {
    case "wait": {
      const waitMinutes = cfg.waitMinutes ?? 60;
      await enqueueCommJob(
        { type: "workflow_continue", runId, stepId: step.id },
        new Date(Date.now() + waitMinutes * 60_000),
      );
      break;
    }
    case "send_sms":
    case "send_whatsapp":
    case "send_email":
    case "send_push": {
      const channel = step.stepType.replace("send_", "") as "sms" | "whatsapp" | "email" | "push";
      let body = "";
      let subject: string | null = null;
      let templateId: number | null = null;

      if (channel === "email" && cfg.emailTemplateId) {
        const [t] = await db.select().from(commEmailTemplatesTable)
          .where(eq(commEmailTemplatesTable.id, cfg.emailTemplateId)).limit(1);
        if (t) {
          body = renderTemplate(t.htmlContent, contextToVars(context));
          subject = renderTemplate(t.subject, contextToVars(context));
        }
      } else if (channel === "whatsapp" && cfg.whatsappTemplateId) {
        const [t] = await db.select().from(commWhatsappTemplatesTable)
          .where(eq(commWhatsappTemplatesTable.id, cfg.whatsappTemplateId)).limit(1);
        if (t) body = t.bodyPreview;
      } else if (cfg.templateId) {
        const [t] = await db.select().from(commTemplatesTable)
          .where(eq(commTemplatesTable.id, cfg.templateId)).limit(1);
        if (t) {
          body = renderTemplate(t.body, contextToVars(context));
          subject = t.subject ? renderTemplate(t.subject, contextToVars(context)) : null;
          templateId = t.id;
        }
      }

      const [event] = await db.insert(commEventsTable).values({
        brandId,
        automationId: null,
        customerId: context.customerId ?? null,
        leadId: context.leadId ?? null,
        channel,
        templateId,
        renderedBody: body,
        renderedSubject: subject,
        status: "queued",
        metadata: context as Record<string, unknown>,
        companyId: context.companyId ?? workflow.companyId,
      }).returning();

      await enqueueMessage({
        eventId: event!.id,
        channel,
        companyId: context.companyId ?? workflow.companyId,
        brandId,
        sendPayload: {
          phone: context.phone ?? undefined,
          email: context.email ?? undefined,
          message: body,
          subject: subject ?? undefined,
          companyId: context.companyId ?? workflow.companyId,
          brandId,
          whatsappVariables: contextToVars(context),
        },
      });
      break;
    }
    case "branch":
    case "create_task":
    case "assign_staff":
      await logCommAudit({
        action: `workflow.${step.stepType}`,
        resource: "workflow_run",
        resourceId: runId,
        companyId: workflow.companyId,
        brandId: workflow.brandId,
        payload: { stepId, config: cfg },
      });
      break;
  }

  const steps = await db.select().from(commWorkflowStepsTable)
    .where(eq(commWorkflowStepsTable.workflowId, run.workflowId))
    .orderBy(asc(commWorkflowStepsTable.stepOrder));

  const idx = steps.findIndex(s => s.id === stepId);
  const next = steps[idx + 1];

  if (next && step.stepType !== "wait") {
    await db.update(commWorkflowRunsTable).set({ currentStepId: next.id })
      .where(eq(commWorkflowRunsTable.id, runId));
    await executeWorkflowStep(runId, next.id, context);
  } else if (!next) {
    await db.update(commWorkflowRunsTable).set({
      status: "completed",
      completedAt: new Date(),
    }).where(eq(commWorkflowRunsTable.id, runId));
  }
}

export async function continueWorkflowRun(runId: number, completedStepId: number) {
  const [run] = await db.select().from(commWorkflowRunsTable)
    .where(eq(commWorkflowRunsTable.id, runId)).limit(1);
  if (!run || run.status !== "running") return;

  const steps = await db.select().from(commWorkflowStepsTable)
    .where(eq(commWorkflowStepsTable.workflowId, run.workflowId))
    .orderBy(asc(commWorkflowStepsTable.stepOrder));

  const idx = steps.findIndex(s => s.id === completedStepId);
  const next = steps[idx + 1];
  const context = run.context as RecipientContext & { companyId?: number | null };

  if (next) {
    await db.update(commWorkflowRunsTable).set({ currentStepId: next.id })
      .where(eq(commWorkflowRunsTable.id, runId));
    await executeWorkflowStep(runId, next.id, context);
  } else {
    await db.update(commWorkflowRunsTable).set({
      status: "completed",
      completedAt: new Date(),
    }).where(eq(commWorkflowRunsTable.id, runId));
  }
}

export async function dispatchWorkflowTrigger(
  trigger: string,
  context: RecipientContext & { companyId?: number | null; brandId?: number | null },
) {
  const conditions = [
    eq(commWorkflowsTable.trigger, trigger as "payment_due"),
    eq(commWorkflowsTable.isActive, true),
  ];
  if (context.companyId) conditions.push(eq(commWorkflowsTable.companyId, context.companyId));
  if (context.brandId) conditions.push(eq(commWorkflowsTable.brandId, context.brandId));

  const workflows = await db.select().from(commWorkflowsTable).where(and(...conditions));
  for (const wf of workflows) {
    await startWorkflowRun(wf.id, context);
  }
}
