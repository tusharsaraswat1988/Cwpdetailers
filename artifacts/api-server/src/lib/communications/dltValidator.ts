/**
 * DLT Governance validation chain:
 * Brand → Header → Template → Template Type → Consent → Send
 * Every validation is audited.
 */
import { db } from "@workspace/db";
import {
  commDltTemplatesTable, commDltHeadersTable, commDltEntitiesTable,
  commTemplatesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logCommAudit } from "./audit";
import { hasConsentForChannel, type ConsentChannel } from "./consentService";
import type { CommCustomerConsent } from "@workspace/db";

export type DltValidationInput = {
  brandId: number;
  headerId?: number | null;
  dltTemplateId?: string | null;
  templateType?: string;
  channel: string;
  customerId?: number | null;
  consent?: CommCustomerConsent | null;
  companyId?: number | null;
  userId?: number | null;
};

export type DltValidationResult = {
  valid: boolean;
  step: string;
  error?: string;
};

async function auditValidation(input: DltValidationInput, result: DltValidationResult) {
  await logCommAudit({
    action: result.valid ? "dlt.validation.pass" : "dlt.validation.block",
    resource: "dlt_template",
    userId: input.userId,
    companyId: input.companyId,
    brandId: input.brandId,
    payload: {
      step: result.step,
      error: result.error,
      dltTemplateId: input.dltTemplateId,
      channel: input.channel,
      customerId: input.customerId,
    },
  });
}

export async function validateBeforeSmsSend(input: DltValidationInput): Promise<DltValidationResult> {
  if (input.channel !== "sms") {
    const ok = { valid: true, step: "non_sms_skip" };
    return ok;
  }

  if (!input.brandId) {
    const r = { valid: false, step: "brand", error: "Brand is required for SMS" };
    await auditValidation(input, r);
    return r;
  }

  if (!input.dltTemplateId) {
    const r = { valid: false, step: "template", error: "DLT template ID is required" };
    await auditValidation(input, r);
    return r;
  }

  const [govTemplate] = await db.select().from(commDltTemplatesTable)
    .where(and(
      eq(commDltTemplatesTable.brandId, input.brandId),
      eq(commDltTemplatesTable.templateId, input.dltTemplateId),
      eq(commDltTemplatesTable.status, "approved"),
    )).limit(1);

  if (!govTemplate) {
    const r = { valid: false, step: "template", error: "DLT template not approved for brand" };
    await auditValidation(input, r);
    return r;
  }

  if (input.headerId && govTemplate.headerId !== input.headerId) {
    const r = { valid: false, step: "header", error: "Header does not match approved DLT template" };
    await auditValidation(input, r);
    return r;
  }

  const [header] = await db.select().from(commDltHeadersTable)
    .where(and(eq(commDltHeadersTable.id, govTemplate.headerId), eq(commDltHeadersTable.isActive, true)))
    .limit(1);
  if (!header) {
    const r = { valid: false, step: "header", error: "DLT header inactive or missing" };
    await auditValidation(input, r);
    return r;
  }

  const [entity] = await db.select().from(commDltEntitiesTable)
    .where(and(eq(commDltEntitiesTable.id, govTemplate.entityId), eq(commDltEntitiesTable.isActive, true)))
    .limit(1);
  if (!entity) {
    const r = { valid: false, step: "entity", error: "DLT entity inactive or missing" };
    await auditValidation(input, r);
    return r;
  }

  if (input.templateType && govTemplate.templateType !== input.templateType) {
    const r = { valid: false, step: "template_type", error: "Template type mismatch" };
    await auditValidation(input, r);
    return r;
  }

  if (input.customerId) {
    const channel = input.channel as ConsentChannel;
    if (channel === "sms" && !hasConsentForChannel(input.consent ?? undefined, channel)) {
      const r = { valid: false, step: "consent", error: "SMS consent not granted" };
      await auditValidation(input, r);
      return r;
    }
  }

  const r = { valid: true, step: "send" };
  await auditValidation(input, r);
  return r;
}

/** Validate comm_templates row against DLT governance when sending SMS */
export async function validateSmsTemplate(
  templateId: number,
  brandId: number,
  input: Omit<DltValidationInput, "dltTemplateId" | "templateType">,
): Promise<DltValidationResult & { approvedContent?: string }> {
  const [template] = await db.select().from(commTemplatesTable)
    .where(eq(commTemplatesTable.id, templateId)).limit(1);
  if (!template) {
    return { valid: false, step: "template", error: "Template not found" };
  }

  const result = await validateBeforeSmsSend({
    ...input,
    brandId,
    headerId: template.headerId,
    dltTemplateId: template.dltTemplateId,
    templateType: template.category,
  });

  if (!result.valid) return result;

  const [gov] = await db.select().from(commDltTemplatesTable)
    .where(and(
      eq(commDltTemplatesTable.brandId, brandId),
      eq(commDltTemplatesTable.templateId, template.dltTemplateId!),
    )).limit(1);

  return { ...result, approvedContent: gov?.approvedContent };
}
