/**
 * Phase 5.6 — Commercial audit timeline (Billing-owned).
 */

import type { Logger } from "pino";
import {
  db,
  billingCommercialTimelineTable,
  type BillingCommercialTimelineEventType,
} from "@workspace/db";
import { and, asc, eq, or } from "drizzle-orm";

const TITLES: Record<BillingCommercialTimelineEventType, string> = {
  COMMERCIAL_PREVIEWED: "Commercial Previewed",
  INVOICE_DRAFT_CREATED: "Invoice Draft Created",
  INVOICE_ISSUED: "Invoice Issued",
  INVOICE_PAYMENT_PENDING: "Payment Pending",
  INVOICE_PAID: "Invoice Paid",
  INVOICE_VOIDED: "Invoice Voided",
  INVOICE_CANCELLED: "Invoice Cancelled",
  CREDIT_NOTE_CREATED: "Credit Note Created",
  ENTITLEMENT_CONSUMED: "Entitlement Consumed",
  COMMERCIAL_CLOSED: "Commercial Closed",
};

export type RecordCommercialTimelineInput = {
  invoiceId?: number | null;
  executionId?: number | null;
  eventType: BillingCommercialTimelineEventType;
  title?: string;
  description?: string;
  actorId?: number | null;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
  companyId?: number | null;
  franchiseeId?: number | null;
  branchId?: number | null;
};

export async function recordCommercialTimeline(
  input: RecordCommercialTimelineInput,
  _logger?: Logger,
) {
  const [entry] = await db.insert(billingCommercialTimelineTable).values({
    invoiceId: input.invoiceId ?? null,
    executionId: input.executionId ?? null,
    eventType: input.eventType,
    title: input.title ?? TITLES[input.eventType],
    description: input.description ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    metadata: input.metadata ?? {},
    companyId: input.companyId ?? null,
    franchiseeId: input.franchiseeId ?? null,
    branchId: input.branchId ?? null,
  }).returning();
  return entry;
}

export async function getCommercialTimeline(opts: {
  invoiceId?: number;
  executionId?: number;
}) {
  if (!opts.invoiceId && !opts.executionId) return [];

  const conditions = [];
  if (opts.invoiceId) conditions.push(eq(billingCommercialTimelineTable.invoiceId, opts.invoiceId));
  if (opts.executionId) conditions.push(eq(billingCommercialTimelineTable.executionId, opts.executionId));

  return db.select().from(billingCommercialTimelineTable)
    .where(conditions.length === 1 ? conditions[0]! : or(...conditions))
    .orderBy(asc(billingCommercialTimelineTable.createdAt));
}

export async function getInvoiceCommercialHistory(invoiceId: number) {
  return db.select().from(billingCommercialTimelineTable)
    .where(eq(billingCommercialTimelineTable.invoiceId, invoiceId))
    .orderBy(asc(billingCommercialTimelineTable.createdAt));
}

/** Convenience: timeline scoped by invoice, optionally merging execution-linked rows. */
export async function getMergedCommercialHistory(invoiceId: number, executionId?: number | null) {
  if (!executionId) return getInvoiceCommercialHistory(invoiceId);
  return db.select().from(billingCommercialTimelineTable)
    .where(and(
      or(
        eq(billingCommercialTimelineTable.invoiceId, invoiceId),
        eq(billingCommercialTimelineTable.executionId, executionId),
      ),
    ))
    .orderBy(asc(billingCommercialTimelineTable.createdAt));
}
