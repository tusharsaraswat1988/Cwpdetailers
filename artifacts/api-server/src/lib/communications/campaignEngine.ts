import { db } from "@workspace/db";
import {
  commCampaignsTable, commEventsTable, commTemplatesTable,
  commAudiencesTable, notificationsTable, type CommCampaign,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveAudience } from "./audienceBuilder";
import { renderTemplate, contextToVars } from "./templateEngine";
import { sendViaProvider } from "./providerRegistry";
import { logCommAudit } from "./audit";
import { logger } from "../logger";
import type { RecipientContext } from "./templateEngine";

const MAX_RETRIES = 3;

async function sendToRecipient(
  campaign: CommCampaign,
  template: { body: string; subject: string | null; dltTemplateId: string | null },
  recipient: RecipientContext,
  eventId: number,
) {
  const vars = contextToVars(recipient);
  const renderedBody = renderTemplate(template.body, vars);
  const renderedSubject = template.subject ? renderTemplate(template.subject, vars) : null;

  let result: { success: boolean; externalId?: string; error?: string };

  if (campaign.channel === "in_app" && recipient.userId) {
    await db.insert(notificationsTable).values({
      userId: recipient.userId,
      title: renderedSubject ?? campaign.name,
      message: renderedBody,
      type: "broadcast",
      channel: "in_app",
      deliveryStatus: "sent",
      companyId: campaign.companyId,
      branchId: campaign.branchId,
    });
    result = { success: true, externalId: "in_app" };
  } else {
    result = await sendViaProvider(campaign.channel, {
      phone: recipient.phone ?? undefined,
      email: recipient.email ?? undefined,
      message: renderedBody,
      subject: renderedSubject ?? undefined,
      dltTemplateId: template.dltTemplateId ?? undefined,
      companyId: campaign.companyId,
    }, campaign.companyId);
  }

  const status = result.success ? "sent" : "failed";
  await db.update(commEventsTable).set({
    renderedBody,
    renderedSubject,
    status,
    externalId: result.externalId ?? null,
    errorMessage: result.error ?? null,
    sentAt: result.success ? new Date() : null,
    deliveredAt: result.success ? new Date() : null,
  }).where(eq(commEventsTable.id, eventId));

  return result.success;
}

export async function processCampaignBatch(campaignId: number, batchSize = 50) {
  const [campaign] = await db.select().from(commCampaignsTable)
    .where(eq(commCampaignsTable.id, campaignId)).limit(1);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (!campaign.templateId) throw new Error("Campaign has no template");

  const [template] = await db.select().from(commTemplatesTable)
    .where(eq(commTemplatesTable.id, campaign.templateId)).limit(1);
  if (!template) throw new Error("Template not found");

  await db.update(commCampaignsTable).set({ status: "processing" })
    .where(eq(commCampaignsTable.id, campaignId));

  let recipients: RecipientContext[] = [];

  if (campaign.audienceId) {
    const [audience] = await db.select().from(commAudiencesTable)
      .where(eq(commAudiencesTable.id, campaign.audienceId)).limit(1);
    if (audience?.filterDefinition) {
      const resolved = await resolveAudience(audience.filterDefinition, {
        companyId: campaign.companyId,
        branchId: campaign.branchId,
      });
      recipients = [...resolved.customers, ...resolved.leads];
    }
  }

  const pendingEvents = await db.select().from(commEventsTable)
    .where(eq(commEventsTable.campaignId, campaignId))
    .limit(batchSize);

  const toProcess = pendingEvents.length
    ? pendingEvents
    : await createEventsForRecipients(campaign, template.body, recipients);

  let sent = 0, failed = 0;

  for (const event of toProcess) {
    if (event.status !== "pending" && event.status !== "queued") continue;

    const recipient: RecipientContext = {
      customerId: event.customerId,
      leadId: event.leadId,
      customerName: (event.metadata as Record<string, string>)?.customerName,
      phone: (event.metadata as Record<string, string>)?.phone,
      email: (event.metadata as Record<string, string>)?.email,
      userId: (event.metadata as Record<string, number>)?.userId,
      vehicleNumber: (event.metadata as Record<string, string>)?.vehicleNumber,
      amountDue: (event.metadata as Record<string, string>)?.amountDue,
    };

    try {
      const ok = await sendToRecipient(campaign, template, recipient, event.id);
      if (ok) sent++; else failed++;
    } catch (err) {
      failed++;
      const retryCount = event.retryCount + 1;
      await db.update(commEventsTable).set({
        status: retryCount >= MAX_RETRIES ? "failed" : "pending",
        retryCount,
        errorMessage: err instanceof Error ? err.message : "Send failed",
      }).where(eq(commEventsTable.id, event.id));
      logger.error({ err, eventId: event.id }, "Campaign send error");
    }
  }

  const remaining = await db.select({ id: commEventsTable.id }).from(commEventsTable)
    .where(eq(commEventsTable.campaignId, campaignId));

  const allEvents = await db.select().from(commEventsTable)
    .where(eq(commEventsTable.campaignId, campaignId));

  const stats = {
    sent: allEvents.filter(e => ["sent", "delivered", "read"].includes(e.status)).length,
    failed: allEvents.filter(e => e.status === "failed").length,
    delivered: allEvents.filter(e => e.deliveredAt).length,
    read: allEvents.filter(e => e.readAt).length,
    clicked: allEvents.filter(e => e.clickedAt).length,
    converted: allEvents.filter(e => e.convertedAt).length,
    revenue: allEvents.reduce((sum, e) => sum + Number(e.revenue ?? 0), 0),
  };

  const allDone = allEvents.every(e => !["pending", "queued"].includes(e.status));
  if (allDone) {
    await db.update(commCampaignsTable).set({
      status: stats.failed === allEvents.length ? "failed" : "sent",
      sentAt: new Date(),
      stats,
    }).where(eq(commCampaignsTable.id, campaignId));
  } else {
    await db.update(commCampaignsTable).set({ stats }).where(eq(commCampaignsTable.id, campaignId));
  }

  return { sent, failed, remaining: remaining.length, stats, done: allDone };
}

async function createEventsForRecipients(
  campaign: CommCampaign,
  _body: string,
  recipients: RecipientContext[],
) {
  if (!recipients.length) return [];

  const events = await db.insert(commEventsTable).values(
    recipients.map(r => ({
      campaignId: campaign.id,
      customerId: r.customerId ?? null,
      leadId: r.leadId ?? null,
      channel: campaign.channel,
      templateId: campaign.templateId,
      renderedBody: "",
      status: "pending" as const,
      metadata: {
        customerName: r.customerName,
        phone: r.phone,
        email: r.email,
        userId: r.userId,
        vehicleNumber: r.vehicleNumber,
        amountDue: r.amountDue,
      },
      companyId: campaign.companyId,
      branchId: campaign.branchId,
    })),
  ).returning();

  return events;
}

export async function launchCampaign(campaignId: number, userId?: number) {
  const [campaign] = await db.select().from(commCampaignsTable)
    .where(eq(commCampaignsTable.id, campaignId)).limit(1);
  if (!campaign) throw new Error("Campaign not found");

  await logCommAudit({
    action: "campaign.launch",
    resource: "campaign",
    resourceId: campaignId,
    userId,
    companyId: campaign.companyId,
    payload: { campaignId },
  });

  return processCampaignBatch(campaignId, 100);
}

export async function previewCampaign(
  templateBody: string,
  recipient: RecipientContext,
): Promise<{ body: string; subject?: string }> {
  const vars = contextToVars(recipient);
  return { body: renderTemplate(templateBody, vars) };
}
