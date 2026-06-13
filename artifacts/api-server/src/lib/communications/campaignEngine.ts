import { db } from "@workspace/db";
import {
  commCampaignsTable, commEventsTable, commTemplatesTable,
  commAudiencesTable, type CommCampaign,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { resolveAudience } from "./audienceBuilder";
import { renderTemplate, contextToVars } from "./templateEngine";
import { logCommAudit } from "./audit";
import { logger } from "../logger";
import type { RecipientContext } from "./templateEngine";
import {
  channelRequiresConsent, hasConsentForChannel, loadConsentsForCustomers,
} from "./consentService";
import { processCampaignAttribution, refreshCampaignStats } from "./attributionService";
import { sendViaChannel } from "./channels/channelService";
import { validateSmsTemplate } from "./dltValidator";
import { enqueueMessage } from "./queueService";
import { syncTimelineFromEvent } from "./timelineService";
import { resolveBrandId } from "./brandService";
import { processQueueJobs } from "./queueService";

const BATCH_SIZE = 100;

async function queueRecipientSend(
  campaign: CommCampaign,
  template: {
    id?: number;
    body: string; subject: string | null; dltTemplateId: string | null;
    name?: string; category?: string; headerId?: number | null;
  },
  recipient: RecipientContext,
  eventId: number,
  brandId: number | null,
  consent?: import("@workspace/db").CommCustomerConsent,
) {
  const vars = contextToVars(recipient);
  const renderedBody = renderTemplate(template.body, vars);
  const renderedSubject = template.subject ? renderTemplate(template.subject, vars) : null;

  if (campaign.channel === "sms" && brandId && template.id) {
    const dltCheck = await validateSmsTemplate(template.id, brandId, {
      brandId,
      headerId: template.headerId,
      channel: "sms",
      customerId: recipient.customerId,
      consent,
      companyId: campaign.companyId,
    });
    if (!dltCheck.valid) {
      await db.update(commEventsTable).set({
        status: "failed",
        errorMessage: dltCheck.error ?? "DLT validation failed",
        renderedBody,
        renderedSubject,
      }).where(eq(commEventsTable.id, eventId));
      await syncTimelineFromEvent(eventId);
      return false;
    }
  }

  await db.update(commEventsTable).set({
    renderedBody,
    renderedSubject,
    brandId,
    status: "queued",
  }).where(eq(commEventsTable.id, eventId));

  if (campaign.channel === "in_app" && recipient.userId) {
    const result = await sendViaChannel("in_app", {
      message: renderedBody,
      subject: renderedSubject ?? campaign.name,
      companyId: campaign.companyId,
      brandId,
      metadata: { userId: recipient.userId },
    });
    const status = result.success ? "sent" : "failed";
    await db.update(commEventsTable).set({
      status,
      externalId: result.externalId ?? null,
      errorMessage: result.error ?? null,
      sentAt: result.success ? new Date() : null,
    }).where(eq(commEventsTable.id, eventId));
    await syncTimelineFromEvent(eventId);
    return result.success;
  }

  const waCategory = template.category === "utility" ? "utility"
    : template.category === "service_implicit" ? "service"
    : template.dltTemplateId ? "template" : "text";

  await enqueueMessage({
    eventId,
    channel: campaign.channel as "sms" | "whatsapp" | "email" | "push",
    companyId: campaign.companyId,
    brandId,
    sendPayload: {
      phone: recipient.phone ?? undefined,
      email: recipient.email ?? undefined,
      message: renderedBody,
      subject: renderedSubject ?? undefined,
      dltTemplateId: template.dltTemplateId ?? undefined,
      companyId: campaign.companyId,
      brandId,
      whatsappTemplateName: template.dltTemplateId ?? template.name,
      whatsappTemplateLanguage: "en",
      whatsappVariables: vars,
      whatsappMessageType: campaign.channel === "whatsapp" ? waCategory as "template" | "utility" | "service" | "text" : undefined,
    },
  });

  return true;
}

async function markConsentBlocked(eventId: number, channel: string) {
  await db.update(commEventsTable).set({
    status: "consent_blocked",
    errorMessage: "consent_blocked",
    metadata: { reason: "consent_blocked", channel },
  }).where(eq(commEventsTable.id, eventId));
}

export async function processCampaignBatch(campaignId: number, batchSize = BATCH_SIZE) {
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
      }, batchSize);
      recipients = [...resolved.customers, ...resolved.leads];
    }
  }

  const brandId = await resolveBrandId(campaign.brandId, campaign.companyId);

  let pendingEvents = await db.select().from(commEventsTable)
    .where(and(
      eq(commEventsTable.campaignId, campaignId),
      inArray(commEventsTable.status, ["pending", "queued"]),
    ))
    .limit(batchSize);

  if (!pendingEvents.length && recipients.length) {
    pendingEvents = await createEventsForRecipients(campaign, recipients, brandId);
  }

  const needsConsent = channelRequiresConsent(campaign.channel);
  const customerIds = pendingEvents.map(e => e.customerId).filter((id): id is number => id != null);
  const consentMap = needsConsent ? await loadConsentsForCustomers(customerIds) : new Map();

  let queued = 0, failed = 0, consentBlocked = 0;

  for (const event of pendingEvents) {
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

    if (needsConsent && recipient.customerId) {
      const consent = consentMap.get(recipient.customerId);
      if (!hasConsentForChannel(consent, campaign.channel)) {
        await markConsentBlocked(event.id, campaign.channel);
        consentBlocked++;
        continue;
      }
    }

    try {
      const ok = await queueRecipientSend(
        campaign,
        { ...template, id: template.id, headerId: template.headerId },
        recipient,
        event.id,
        brandId,
        consentMap.get(recipient.customerId!),
      );
      if (ok) queued++; else failed++;
    } catch (err) {
      failed++;
      await db.update(commEventsTable).set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Queue failed",
      }).where(eq(commEventsTable.id, event.id));
      logger.error({ err, eventId: event.id }, "Campaign queue error");
    }
  }

  await processQueueJobs(BATCH_SIZE);

  const remainingRows = await db.select({ id: commEventsTable.id }).from(commEventsTable)
    .where(and(
      eq(commEventsTable.campaignId, campaignId),
      inArray(commEventsTable.status, ["pending", "queued", "processing", "retrying"]),
    ))
    .limit(1);

  const allDone = remainingRows.length === 0 && pendingEvents.length < batchSize;

  await processCampaignAttribution(campaignId);
  const stats = await refreshCampaignStats(campaignId);

  if (allDone) {
    await db.update(commCampaignsTable).set({
      status: (stats?.failed ?? 0) === (stats?.sent ?? 0) + (stats?.failed ?? 0) && (stats?.sent ?? 0) === 0 ? "failed" : "sent",
      sentAt: new Date(),
      stats: { ...stats, consentBlocked: (stats?.consentBlocked ?? 0) + consentBlocked },
    }).where(eq(commCampaignsTable.id, campaignId));
  } else {
    await db.update(commCampaignsTable).set({
      stats: { ...stats, consentBlocked: (stats?.consentBlocked ?? 0) + consentBlocked },
    }).where(eq(commCampaignsTable.id, campaignId));
  }

  return { sent: queued, failed, consentBlocked, stats, done: allDone };
}

async function createEventsForRecipients(
  campaign: CommCampaign,
  recipients: RecipientContext[],
  brandId: number | null,
) {
  if (!recipients.length) return [];

  const events = await db.insert(commEventsTable).values(
    recipients.map(r => ({
      brandId,
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
    brandId: campaign.brandId,
    payload: { campaignId },
  });

  let done = false;
  let aggregate = { sent: 0, failed: 0, consentBlocked: 0 };

  while (!done) {
    const result = await processCampaignBatch(campaignId, BATCH_SIZE);
    aggregate.sent += result.sent;
    aggregate.failed += result.failed;
    aggregate.consentBlocked += result.consentBlocked;
    done = result.done ?? true;
    if (result.sent === 0 && result.failed === 0 && result.consentBlocked === 0) break;
  }

  return { ...aggregate, stats: (await refreshCampaignStats(campaignId)) };
}

export async function previewCampaign(
  templateBody: string,
  recipient: RecipientContext,
): Promise<{ body: string; subject?: string }> {
  const vars = contextToVars(recipient);
  return { body: renderTemplate(templateBody, vars) };
}

export async function testWhatsAppSend(params: {
  phone: string;
  templateBody: string;
  templateName?: string;
  companyId?: number | null;
  recipient?: RecipientContext;
}) {
  const vars = contextToVars(params.recipient ?? {
    customerName: "Test User",
    vehicleNumber: "MH12AB1234",
    amountDue: "1500",
    nextServiceDate: new Date().toISOString().slice(0, 10),
  });
  const message = renderTemplate(params.templateBody, vars);

  const result = await sendViaChannel("whatsapp", {
    phone: params.phone,
    message,
    whatsappTemplateName: params.templateName,
    whatsappTemplateLanguage: "en",
    whatsappVariables: vars,
    whatsappMessageType: params.templateName ? "template" : "text",
    companyId: params.companyId,
  });

  return { ...result, renderedMessage: message, variables: vars };
}
