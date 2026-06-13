import { db } from "@workspace/db";
import {
  commAutomationsTable, commEventsTable, commTemplatesTable,
  customersTable, leadsTable, subscriptionsTable, vehiclesTable,
  notificationsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { renderTemplate, contextToVars, type RecipientContext } from "./templateEngine";
import { sendViaProvider } from "./providerRegistry";
import { logCommAudit } from "./audit";

export async function dispatchAutomationEvent(
  automationId: number,
  context: Record<string, unknown>,
) {
  const [auto] = await db.select().from(commAutomationsTable)
    .where(eq(commAutomationsTable.id, automationId)).limit(1);
  if (!auto?.isActive) return;

  const [template] = await db.select().from(commTemplatesTable)
    .where(eq(commTemplatesTable.id, auto.templateId)).limit(1);
  if (!template) return;

  let recipient: RecipientContext | null = null;

  if (context.customerId) {
    const [c] = await db.select().from(customersTable)
      .where(eq(customersTable.id, Number(context.customerId))).limit(1);
    if (c) {
      const [vehicle] = await db.select({ reg: vehiclesTable.registrationNumber })
        .from(vehiclesTable).where(eq(vehiclesTable.customerId, c.id)).limit(1);
      const [sub] = await db.select({
        type: subscriptionsTable.type,
        nextServiceDate: subscriptionsTable.nextServiceDate,
      }).from(subscriptionsTable).where(eq(subscriptionsTable.customerId, c.id)).limit(1);

      recipient = {
        customerId: c.id,
        customerName: c.name,
        phone: c.phone,
        email: c.email,
        userId: c.userId,
        vehicleNumber: vehicle?.reg ?? null,
        amountDue: c.totalDues,
        packageName: sub?.type?.replace(/_/g, " ") ?? null,
        nextServiceDate: sub?.nextServiceDate ?? null,
      };
    }
  } else if (context.leadId) {
    const [l] = await db.select().from(leadsTable)
      .where(eq(leadsTable.id, Number(context.leadId))).limit(1);
    if (l) {
      recipient = { leadId: l.id, customerName: l.name, phone: l.phone };
    }
  }

  if (!recipient) return;

  const vars = contextToVars(recipient);
  const renderedBody = renderTemplate(template.body, vars);
  const renderedSubject = template.subject ? renderTemplate(template.subject, vars) : null;

  const dedupeKey = `auto:${automationId}:${recipient.customerId ?? recipient.leadId}:${auto.trigger}`;
  const [existing] = await db.select({ id: commEventsTable.id }).from(commEventsTable)
    .where(eq(commEventsTable.renderedBody, renderedBody))
    .limit(1);
  if (existing) return;

  const [event] = await db.insert(commEventsTable).values({
    automationId: auto.id,
    customerId: recipient.customerId ?? null,
    leadId: recipient.leadId ?? null,
    channel: auto.channel,
    templateId: auto.templateId,
    renderedBody,
    renderedSubject,
    status: "pending",
    metadata: { dedupeKey, trigger: auto.trigger },
    companyId: auto.companyId,
    branchId: auto.branchId,
  }).returning();

  let success = false;
  if (auto.channel === "in_app" && recipient.userId) {
    await db.insert(notificationsTable).values({
      userId: recipient.userId,
      title: renderedSubject ?? auto.name,
      message: renderedBody,
      type: "broadcast",
      channel: "in_app",
      deliveryStatus: "sent",
      companyId: auto.companyId,
      branchId: auto.branchId,
    });
    success = true;
  } else {
    const result = await sendViaProvider(auto.channel, {
      phone: recipient.phone ?? undefined,
      email: recipient.email ?? undefined,
      message: renderedBody,
      subject: renderedSubject ?? undefined,
      companyId: auto.companyId,
    }, auto.companyId);
    success = result.success;
    await db.update(commEventsTable).set({
      status: result.success ? "sent" : "failed",
      externalId: result.externalId ?? null,
      errorMessage: result.error ?? null,
      sentAt: result.success ? new Date() : null,
      deliveredAt: result.success ? new Date() : null,
    }).where(eq(commEventsTable.id, event!.id));
  }

  await logCommAudit({
    action: "automation.trigger",
    resource: "automation",
    resourceId: automationId,
    companyId: auto.companyId,
    payload: { trigger: auto.trigger, success, eventId: event?.id },
  });
}

/** Hook for external events (invoice generated, payment received, etc.) */
export async function triggerAutomationsByEvent(
  trigger: string,
  context: Record<string, unknown>,
  companyId?: number | null,
) {
  const automations = await db.select().from(commAutomationsTable)
    .where(eq(commAutomationsTable.trigger, trigger as "payment_due"));

  for (const auto of automations) {
    if (companyId && auto.companyId && auto.companyId !== companyId) continue;
    await dispatchAutomationEvent(auto.id, context);
  }
}
