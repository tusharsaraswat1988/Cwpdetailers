/**
 * Phase 5.6 — Billing & Commercial Closure.
 *
 * Starts when Job is ready_for_billing.
 * Ends when billing is commercially complete.
 *
 * Reuses: invoices, payments, invoiceGstEngine, catalog/contract pricing.
 * Does NOT modify Booking, Assignment, Field Execution, or Job Orchestration.
 */

import type { Request } from "express";
import {
  db,
  serviceExecutionsTable,
  customerContractsTable,
  customersTable,
  invoicesTable,
  bookingsTable,
  servicesTable,
  catalogPackagesTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  subscriptionsTable,
  customerEntitlementsTable,
  entitlementConsumptionLogTable,
  type Invoice,
  type InvoiceItem,
  type InvoiceBillingMode,
  type InvoiceCommercialStatus,
  type ServiceExecution,
  type CustomerContract,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { tenantFilters, rowInScope } from "../../middlewares/tenantScope";
import { getDefaultGstRate } from "../catalog/pricingEngine";
import { consumeEntitlementOnCompletion } from "../catalog/entitlementEngine";
import { decrementOnCompletion } from "../../subscriptions/service";
import { computeInvoiceGst, resolvePlaceOfSupply } from "./invoiceGstEngine";
import { getInvoiceBillingSettings } from "./invoiceBillingSettings";
import {
  createInvoice,
  buildCustomerSnapshot,
  recordPayment,
  createCreditNote,
  type TenantFields,
} from "./invoiceService";
import {
  CommercialValidationError,
  assertAdminBillingActor,
  assertJobReadyForBilling,
  assertContractBillable,
  assertNoExistingJobInvoice,
  assertNonNegativeTotals,
  assertCanIssue,
  assertCanMarkPaid,
  assertCanVoid,
  isSubscriptionVisitMode,
  isOneTimeMode,
} from "./commercialValidation";
import { recordCommercialTimeline, getMergedCommercialHistory } from "./commercialTimeline";
import {
  billingDomainEventPublisher,
  baseBillingEventFields,
} from "./commercialDomainEvents";
import { logger } from "../logger";

const JOB_SCOPE = {
  companyCol: serviceExecutionsTable.companyId,
  branchCol: serviceExecutionsTable.branchId,
  franchiseeCol: serviceExecutionsTable.franchiseeId,
  customerCol: serviceExecutionsTable.customerId,
};

const INVOICE_SCOPE = {
  companyCol: invoicesTable.companyId,
  branchCol: invoicesTable.branchId,
  franchiseeCol: invoicesTable.franchiseeId,
  customerCol: invoicesTable.customerId,
};

export type CommercialLineDraft = {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstInclusive: boolean;
  serviceCategory: string;
  sac: string;
  isComplimentary?: boolean;
  lineDiscount?: number;
};

export type CommercialCalculation = {
  jobId: number;
  executionId: number;
  contractId: number;
  customerId: number;
  customerName: string | null;
  billingMode: InvoiceBillingMode;
  pricingSource: "contract" | "catalog" | "subscription" | "dcms_plan" | "package" | "existing_invoice";
  paymentTerms: string;
  lines: CommercialLineDraft[];
  discount: number;
  gstInclusive: boolean;
  subtotal: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  isInterState: boolean;
  entitlementAvailable: boolean | null;
  entitlementId: number | null;
  subscriptionId: number | null;
  bookingId: number | null;
  existingInvoiceId: number | null;
  existingInvoiceNumber: string | null;
  notes: string;
};

export type ReadyForBillingRow = {
  jobId: number;
  executionId: number;
  contractId: number;
  customerId: number;
  customerName: string | null;
  productLine: string | null;
  sourceSystem: string | null;
  scheduledDate: string;
  completedAt: string | null;
  readyForBillingAt: string | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  commercialStatus: InvoiceCommercialStatus | null;
  billingMode: InvoiceBillingMode | null;
};

function actorFromReq(req: Request): { actorId: number | null; actorName: string | null; role: string | null } {
  const user = req.user;
  return {
    actorId: user?.id ?? null,
    actorName: user?.name ?? user?.phone ?? null,
    role: user?.role ?? null,
  };
}

function tenantFromJob(job: ServiceExecution): TenantFields {
  return {
    companyId: job.companyId,
    franchiseeId: job.franchiseeId,
    branchId: job.branchId,
  };
}

async function loadJobInScope(req: Request, jobId: number): Promise<ServiceExecution> {
  const [job] = await db.select().from(serviceExecutionsTable)
    .where(and(eq(serviceExecutionsTable.id, jobId), ...tenantFilters(req, JOB_SCOPE)))
    .limit(1);
  if (!job || !rowInScope(req, job)) {
    throw new CommercialValidationError("Job not found", "NOT_FOUND");
  }
  return job;
}

async function loadInvoiceInScope(req: Request, invoiceId: number): Promise<Invoice> {
  const [invoice] = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.id, invoiceId), ...tenantFilters(req, INVOICE_SCOPE)))
    .limit(1);
  if (!invoice || !rowInScope(req, invoice)) {
    throw new CommercialValidationError("Invoice not found", "NOT_FOUND");
  }
  return invoice;
}

async function findActiveInvoiceForExecution(executionId: number): Promise<Invoice | null> {
  const [row] = await db.select().from(invoicesTable)
    .where(and(
      eq(invoicesTable.executionId, executionId),
      eq(invoicesTable.documentType, "tax_invoice"),
      ne(invoicesTable.status, "cancelled"),
      ne(invoicesTable.commercialStatus, "voided"),
    ))
    .limit(1);
  return row ?? null;
}

async function findExistingContractInvoice(contractId: number): Promise<Invoice | null> {
  const [row] = await db.select().from(invoicesTable)
    .where(and(
      eq(invoicesTable.contractRegistryId, contractId),
      eq(invoicesTable.documentType, "tax_invoice"),
      ne(invoicesTable.status, "cancelled"),
      ne(invoicesTable.commercialStatus, "voided"),
      isNull(invoicesTable.executionId),
    ))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(1);
  return row ?? null;
}

function paymentTermsFromSummary(summary: Record<string, unknown>): string {
  const terms = summary.paymentTerms;
  if (typeof terms === "string" && ["full_advance", "partial_advance", "after_service"].includes(terms)) {
    return terms;
  }
  return "after_service";
}

function discountFromSummary(summary: Record<string, unknown>, grossTotal: number): number {
  const discountType = summary.discountType;
  const discountValue = summary.discountValue;
  if (discountType === "percent" && (typeof discountValue === "string" || typeof discountValue === "number")) {
    const pct = Math.min(100, Math.max(0, parseFloat(String(discountValue)) || 0));
    return Math.round((grossTotal * pct) / 100 * 100) / 100;
  }
  if (discountType === "flat" && (typeof discountValue === "string" || typeof discountValue === "number")) {
    return Math.min(grossTotal, Math.max(0, parseFloat(String(discountValue)) || 0));
  }
  return 0;
}

async function resolveEntitlementForJob(
  contract: CustomerContract,
  bookingId: number | null,
): Promise<{ entitlementId: number | null; available: boolean | null; alreadyConsumed: boolean }> {
  if (contract.sourceSystem === "entitlement") {
    const [ent] = await db.select().from(customerEntitlementsTable)
      .where(eq(customerEntitlementsTable.id, contract.sourceId)).limit(1);
    if (!ent) return { entitlementId: null, available: false, alreadyConsumed: false };
    if (bookingId) {
      const [log] = await db.select().from(entitlementConsumptionLogTable)
        .where(and(
          eq(entitlementConsumptionLogTable.entitlementId, ent.id),
          eq(entitlementConsumptionLogTable.bookingId, bookingId),
        )).limit(1);
      if (log) return { entitlementId: ent.id, available: true, alreadyConsumed: true };
    }
    const available = ent.status === "active" && ent.remainingCredits > 0;
    return { entitlementId: ent.id, available, alreadyConsumed: false };
  }

  if (contract.sourceSystem === "subscription" || contract.sourceSystem === "dcms") {
    return { entitlementId: null, available: true, alreadyConsumed: false };
  }

  return { entitlementId: null, available: null, alreadyConsumed: false };
}

async function buildCommercialCalculation(job: ServiceExecution): Promise<CommercialCalculation> {
  const [contract] = await db.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, job.contractId)).limit(1);
  if (!contract) {
    throw new CommercialValidationError("Contract not found for job", "CONTRACT_INVALID");
  }
  assertContractBillable(contract);

  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, job.customerId)).limit(1);

  const summary = (contract.summaryJson ?? {}) as Record<string, unknown>;
  const paymentTerms = paymentTermsFromSummary(summary);
  const defaultRate = await getDefaultGstRate();
  const billingSettings = await getInvoiceBillingSettings();
  const defaultSac = billingSettings.defaultSac;

  let bookingId: number | null = job.legacyBookingId ?? null;
  if (!bookingId && contract.sourceSystem === "booking") {
    bookingId = contract.sourceId;
  }

  const existingJobInvoice = await findActiveInvoiceForExecution(job.id);
  assertNoExistingJobInvoice(existingJobInvoice);

  // Prepaid one-time: contract already has a purchase invoice — fulfill without a second charge
  const existingContractInvoice = await findExistingContractInvoice(contract.id);
  if (
    existingContractInvoice
    && isOneTimeMode(contract.sourceSystem)
    && (paymentTerms === "full_advance" || parseFloat(existingContractInvoice.balanceDue) <= 0)
  ) {
    const items = (existingContractInvoice.items ?? []) as InvoiceItem[];
    return {
      jobId: job.id,
      executionId: job.id,
      contractId: contract.id,
      customerId: job.customerId,
      customerName: customer?.name ?? null,
      billingMode: "prepaid_fulfillment",
      pricingSource: "existing_invoice",
      paymentTerms,
      lines: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        gstRate: i.gstRate ?? defaultRate,
        gstInclusive: true,
        serviceCategory: i.serviceCategory ?? "service",
        sac: i.sac ?? defaultSac,
        isComplimentary: true,
      })),
      discount: parseFloat(existingContractInvoice.discount ?? "0"),
      gstInclusive: true,
      subtotal: 0,
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
      isInterState: existingContractInvoice.isInterState,
      entitlementAvailable: null,
      entitlementId: null,
      subscriptionId: existingContractInvoice.subscriptionId,
      bookingId,
      existingInvoiceId: existingContractInvoice.id,
      existingInvoiceNumber: existingContractInvoice.invoiceNumber,
      notes: `Prepaid fulfillment for Job #${job.id} against ${existingContractInvoice.invoiceNumber}`,
    };
  }

  const lines: CommercialLineDraft[] = [];
  let billingMode: InvoiceBillingMode = "one_time";
  let pricingSource: CommercialCalculation["pricingSource"] = "contract";
  let subscriptionId: number | null = null;
  let gstInclusive = true;
  let discount = 0;

  if (isSubscriptionVisitMode(contract.sourceSystem)) {
    billingMode = "subscription_visit";
    // Visit under prepaid plan/package — document consumption as complimentary
    if (contract.sourceSystem === "dcms") {
      const [row] = await db.select({
        sub: dcmsSubscriptionsTable,
        plan: dcmsPlansTable,
      })
        .from(dcmsSubscriptionsTable)
        .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
        .where(eq(dcmsSubscriptionsTable.id, contract.sourceId))
        .limit(1);
      if (!row) throw new CommercialValidationError("DCMS subscription not found", "CONTRACT_INVALID");
      if (row.sub.status !== "active" && row.sub.status !== "paused") {
        throw new CommercialValidationError("DCMS subscription is not active", "ENTITLEMENT_UNAVAILABLE");
      }
      const catalogPrice = parseFloat(row.plan.price) || 0;
      pricingSource = "dcms_plan";
      lines.push({
        description: `Visit · ${row.plan.name} · Job #${job.id}`,
        quantity: 1,
        unitPrice: catalogPrice,
        gstRate: defaultRate,
        gstInclusive: true,
        serviceCategory: "dcms",
        sac: defaultSac,
        isComplimentary: true,
      });
    } else if (contract.sourceSystem === "subscription") {
      const [sub] = await db.select().from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, contract.sourceId)).limit(1);
      if (!sub) throw new CommercialValidationError("Subscription not found", "CONTRACT_INVALID");
      if (sub.status !== "active" && sub.status !== "paused" && sub.status !== "expiring") {
        throw new CommercialValidationError("Subscription is not active", "ENTITLEMENT_UNAVAILABLE");
      }
      const remaining = sub.servicesRemaining;
      if (remaining != null && remaining <= 0) {
        throw new CommercialValidationError("No subscription visits remaining", "ENTITLEMENT_UNAVAILABLE");
      }
      subscriptionId = sub.id;
      pricingSource = "subscription";
      let label = (summary.packageName as string) ?? "Service plan visit";
      let gstRate = defaultRate;
      let unitPrice = parseFloat(sub.price ?? "0") || 0;
      if (contract.catalogRefKind === "package" && contract.catalogRefId) {
        const [pkg] = await db.select().from(catalogPackagesTable)
          .where(eq(catalogPackagesTable.id, contract.catalogRefId)).limit(1);
        if (pkg) {
          label = pkg.name;
          gstRate = parseFloat(pkg.gstRate) || defaultRate;
          unitPrice = parseFloat(pkg.price) || unitPrice;
          gstInclusive = pkg.pricingType !== "exclusive";
          pricingSource = "package";
        }
      }
      lines.push({
        description: `Visit · ${label} · Job #${job.id}`,
        quantity: 1,
        unitPrice,
        gstRate,
        gstInclusive,
        serviceCategory: "package",
        sac: defaultSac,
        isComplimentary: true,
      });
    } else {
      // entitlement package visit
      const [ent] = await db.select().from(customerEntitlementsTable)
        .where(eq(customerEntitlementsTable.id, contract.sourceId)).limit(1);
      if (!ent?.packageId) throw new CommercialValidationError("Entitlement not found", "ENTITLEMENT_UNAVAILABLE");
      const [pkg] = await db.select().from(catalogPackagesTable)
        .where(eq(catalogPackagesTable.id, ent.packageId)).limit(1);
      if (!pkg) throw new CommercialValidationError("Package not found for entitlement", "CONTRACT_INVALID");
      pricingSource = "package";
      gstInclusive = pkg.pricingType !== "exclusive";
      lines.push({
        description: `Visit · ${pkg.name} · Job #${job.id}`,
        quantity: 1,
        unitPrice: parseFloat(pkg.price) || 0,
        gstRate: parseFloat(pkg.gstRate) || defaultRate,
        gstInclusive,
        serviceCategory: "package",
        sac: defaultSac,
        isComplimentary: true,
      });
    }
  } else {
    // One-time service — price from contract summary (sourced from catalog at booking)
    billingMode = "one_time";
    pricingSource = "contract";
    const amount = parseFloat(String(summary.amount ?? "0"));
    if (!amount || amount <= 0) {
      throw new CommercialValidationError("Contract has no billable amount from catalog/contract", "CONTRACT_INVALID");
    }
    let gstRate = defaultRate;
    let serviceName = (summary.serviceName as string) ?? "One-time service";
    if (contract.serviceId || bookingId) {
      const [booking] = bookingId
        ? await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1)
        : [null];
      const serviceId = contract.serviceId ?? booking?.serviceId ?? null;
      if (serviceId) {
        const [svc] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
        if (svc) {
          gstRate = parseFloat(svc.gstRate) || defaultRate;
          gstInclusive = svc.pricingType !== "exclusive";
          serviceName = (summary.serviceName as string) ?? svc.name;
          pricingSource = "catalog";
        }
      }
    }
    lines.push({
      description: `${serviceName} · Job #${job.id}`,
      quantity: 1,
      unitPrice: amount,
      gstRate,
      gstInclusive,
      serviceCategory: "service",
      sac: defaultSac,
    });
    discount = discountFromSummary(summary, amount);
  }

  const entInfo = await resolveEntitlementForJob(contract, bookingId);
  if (billingMode === "subscription_visit" && entInfo.available === false && !entInfo.alreadyConsumed) {
    throw new CommercialValidationError("Entitlement not available for this visit", "ENTITLEMENT_UNAVAILABLE");
  }

  const snapshot = await buildCustomerSnapshot(job.customerId);
  const pos = resolvePlaceOfSupply({
    customerState: snapshot.state,
    customerGstin: snapshot.gstin,
  });

  const items: InvoiceItem[] = lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.quantity * line.unitPrice,
    gstRate: line.gstRate,
    sac: line.sac,
    serviceCategory: line.serviceCategory,
    isComplimentary: line.isComplimentary,
    lineDiscount: line.lineDiscount,
  }));

  const gst = computeInvoiceGst({
    items,
    invoiceDiscount: discount,
    gstInclusive,
    isInterState: pos.isInterState,
  });

  assertNonNegativeTotals(gst.totalAmount, discount);

  return {
    jobId: job.id,
    executionId: job.id,
    contractId: contract.id,
    customerId: job.customerId,
    customerName: customer?.name ?? null,
    billingMode,
    pricingSource,
    paymentTerms,
    lines,
    discount,
    gstInclusive,
    subtotal: gst.subtotal,
    gstAmount: gst.gstAmount,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    totalAmount: gst.totalAmount,
    isInterState: pos.isInterState,
    entitlementAvailable: entInfo.available,
    entitlementId: entInfo.entitlementId,
    subscriptionId,
    bookingId,
    existingInvoiceId: null,
    existingInvoiceNumber: null,
    notes: `Commercial closure for Job #${job.id}`,
  };
}

export async function listReadyForBillingQueue(
  req: Request,
  opts?: { limit?: number; offset?: number },
): Promise<{ items: ReadyForBillingRow[]; total: number }> {
  assertAdminBillingActor(actorFromReq(req).role);
  const lim = Math.min(opts?.limit ?? 50, 100);
  const off = opts?.offset ?? 0;

  const conditions = [
    eq(serviceExecutionsTable.opsStatus, "ready_for_billing"),
    ...tenantFilters(req, JOB_SCOPE),
  ];

  const rows = await db.select({
    job: serviceExecutionsTable,
    customerName: customersTable.name,
    productLine: customerContractsTable.productLine,
    sourceSystem: customerContractsTable.sourceSystem,
  })
    .from(serviceExecutionsTable)
    .leftJoin(customersTable, eq(customersTable.id, serviceExecutionsTable.customerId))
    .leftJoin(customerContractsTable, eq(customerContractsTable.id, serviceExecutionsTable.contractId))
    .where(and(...conditions))
    .orderBy(desc(serviceExecutionsTable.readyForBillingAt), desc(serviceExecutionsTable.id))
    .limit(lim)
    .offset(off);

  const [countRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(serviceExecutionsTable)
    .where(and(...conditions));

  const jobIds = rows.map((r) => r.job.id);
  const invoices = jobIds.length
    ? await db.select().from(invoicesTable).where(and(
      inArray(invoicesTable.executionId, jobIds),
      eq(invoicesTable.documentType, "tax_invoice"),
      ne(invoicesTable.status, "cancelled"),
      ne(invoicesTable.commercialStatus, "voided"),
    ))
    : [];
  const byExec = new Map(invoices.map((i) => [i.executionId!, i]));

  return {
    total: countRow?.c ?? 0,
    items: rows.map(({ job, customerName, productLine, sourceSystem }) => {
      const inv = byExec.get(job.id);
      return {
        jobId: job.id,
        executionId: job.id,
        contractId: job.contractId,
        customerId: job.customerId,
        customerName: customerName ?? null,
        productLine: productLine ?? null,
        sourceSystem: sourceSystem ?? null,
        scheduledDate: job.scheduledDate,
        completedAt: job.completedAt?.toISOString() ?? null,
        readyForBillingAt: job.readyForBillingAt?.toISOString() ?? null,
        invoiceId: inv?.id ?? null,
        invoiceNumber: inv?.invoiceNumber ?? null,
        commercialStatus: inv?.commercialStatus ?? null,
        billingMode: inv?.billingMode ?? null,
      };
    }),
  };
}

export async function previewJobInvoice(req: Request, jobId: number): Promise<CommercialCalculation> {
  const { actorId, actorName, role } = actorFromReq(req);
  assertAdminBillingActor(role);
  const job = await loadJobInScope(req, jobId);
  assertJobReadyForBilling(job);
  const calc = await buildCommercialCalculation(job);

  await recordCommercialTimeline({
    executionId: job.id,
    eventType: "COMMERCIAL_PREVIEWED",
    description: `Preview ${calc.billingMode} · total ₹${calc.totalAmount.toFixed(2)}`,
    actorId,
    actorName,
    metadata: {
      billingMode: calc.billingMode,
      totalAmount: calc.totalAmount,
      pricingSource: calc.pricingSource,
    },
    ...tenantFromJob(job),
  });

  return calc;
}

export async function generateJobInvoice(req: Request, jobId: number): Promise<Invoice> {
  const { actorId, actorName, role } = actorFromReq(req);
  assertAdminBillingActor(role);
  const job = await loadJobInScope(req, jobId);
  assertJobReadyForBilling(job);

  const existing = await findActiveInvoiceForExecution(job.id);
  assertNoExistingJobInvoice(existing);

  const calc = await buildCommercialCalculation(job);
  const tenant = tenantFromJob(job);

  // Prepaid fulfillment: attach job to existing invoice and close commercially
  if (calc.billingMode === "prepaid_fulfillment" && calc.existingInvoiceId) {
    const [updated] = await db.update(invoicesTable)
      .set({
        executionId: job.id,
        billingMode: "prepaid_fulfillment",
        commercialStatus: "commercially_closed",
        commerciallyClosedAt: new Date(),
        entitlementConsumed: false,
        updatedAt: new Date(),
        notes: calc.notes,
      })
      .where(eq(invoicesTable.id, calc.existingInvoiceId))
      .returning();

    if (!updated) throw new CommercialValidationError("Existing invoice not found", "NOT_FOUND");

    await recordCommercialTimeline({
      invoiceId: updated.id,
      executionId: job.id,
      eventType: "COMMERCIAL_CLOSED",
      description: `Prepaid fulfillment linked Job #${job.id} to ${updated.invoiceNumber}`,
      actorId,
      actorName,
      metadata: { billingMode: "prepaid_fulfillment" },
      ...tenant,
    });

    billingDomainEventPublisher.publish({
      ...baseBillingEventFields({
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        executionId: job.id,
        contractId: job.contractId,
        customerId: job.customerId,
        actorId,
        metadata: { billingMode: "prepaid_fulfillment" },
      }),
      type: "CommercialClosed",
    }, logger);

    return updated;
  }

  let entitlementConsumed = false;
  if (calc.billingMode === "subscription_visit") {
    if (calc.entitlementId) {
      const already = calc.bookingId
        ? await db.select().from(entitlementConsumptionLogTable)
          .where(and(
            eq(entitlementConsumptionLogTable.entitlementId, calc.entitlementId),
            eq(entitlementConsumptionLogTable.bookingId, calc.bookingId),
          )).limit(1)
        : [];
      if (!already.length) {
        // bookingId optional on consumption log — Job id used only as audit metadata
        await consumeEntitlementOnCompletion(
          calc.entitlementId,
          calc.bookingId ?? job.id,
          1,
        );
        entitlementConsumed = true;
        await recordCommercialTimeline({
          executionId: job.id,
          eventType: "ENTITLEMENT_CONSUMED",
          description: `Consumed entitlement #${calc.entitlementId}`,
          actorId,
          actorName,
          metadata: { entitlementId: calc.entitlementId, bookingId: calc.bookingId, jobId: job.id },
          ...tenant,
        });
      } else {
        entitlementConsumed = true;
      }
    } else if (calc.subscriptionId) {
      await decrementOnCompletion(calc.subscriptionId);
      entitlementConsumed = true;
      await recordCommercialTimeline({
        executionId: job.id,
        eventType: "ENTITLEMENT_CONSUMED",
        description: `Decremented subscription #${calc.subscriptionId} visit balance`,
        actorId,
        actorName,
        metadata: { subscriptionId: calc.subscriptionId },
        ...tenant,
      });
    }
  }

  const items: InvoiceItem[] = calc.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.quantity * line.unitPrice,
    gstRate: line.gstRate,
    sac: line.sac,
    serviceCategory: line.serviceCategory,
    isComplimentary: line.isComplimentary,
    lineDiscount: line.lineDiscount,
  }));

  const invoice = await createInvoice({
    customerId: calc.customerId,
    items,
    discount: calc.discount,
    gstInclusive: calc.gstInclusive,
    bookingId: calc.bookingId,
    subscriptionId: calc.subscriptionId,
    contractRegistryId: calc.contractId,
    executionId: job.id,
    serviceLocationId: job.serviceLocationId,
    assetId: job.assetId,
    serviceId: null,
    paymentTerms: calc.paymentTerms,
    status: "draft",
    commercialStatus: "draft",
    billingMode: calc.billingMode,
    entitlementConsumed,
    notes: calc.notes,
    ...tenant,
  });

  await recordCommercialTimeline({
    invoiceId: invoice.id,
    executionId: job.id,
    eventType: "INVOICE_DRAFT_CREATED",
    description: `Draft ${invoice.invoiceNumber} · ${calc.billingMode} · ₹${parseFloat(invoice.totalAmount).toFixed(2)}`,
    actorId,
    actorName,
    metadata: {
      billingMode: calc.billingMode,
      pricingSource: calc.pricingSource,
      totalAmount: invoice.totalAmount,
    },
    ...tenant,
  });

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      executionId: job.id,
      contractId: job.contractId,
      customerId: job.customerId,
      actorId,
      metadata: { billingMode: calc.billingMode, status: "draft" },
    }),
    type: "InvoiceCreated",
  }, logger);

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      executionId: job.id,
      contractId: job.contractId,
      customerId: job.customerId,
      actorId,
    }),
    type: "InvoiceReady",
  }, logger);

  return invoice;
}

export async function issueInvoice(req: Request, invoiceId: number): Promise<Invoice> {
  const { actorId, actorName, role } = actorFromReq(req);
  assertAdminBillingActor(role);
  const invoice = await loadInvoiceInScope(req, invoiceId);
  assertCanIssue(invoice);

  const total = parseFloat(invoice.totalAmount);
  const balance = parseFloat(invoice.balanceDue);
  const nextCommercial: InvoiceCommercialStatus =
    total <= 0 || balance <= 0 ? "paid" : "payment_pending";

  const [updated] = await db.update(invoicesTable)
    .set({
      status: nextCommercial === "paid" ? "paid" : "sent",
      commercialStatus: nextCommercial === "paid" ? "paid" : "payment_pending",
      issuedAt: invoice.issuedAt ?? new Date(),
      paidAt: nextCommercial === "paid" ? new Date() : invoice.paidAt,
      updatedAt: new Date(),
    })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  if (!updated) throw new CommercialValidationError("Invoice not found", "NOT_FOUND");

  await recordCommercialTimeline({
    invoiceId: updated.id,
    executionId: updated.executionId,
    eventType: "INVOICE_ISSUED",
    description: `Issued ${updated.invoiceNumber}`,
    actorId,
    actorName,
    companyId: updated.companyId,
    franchiseeId: updated.franchiseeId,
    branchId: updated.branchId,
  });

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      executionId: updated.executionId,
      contractId: updated.contractRegistryId,
      customerId: updated.customerId,
      actorId,
    }),
    type: "InvoiceIssued",
  }, logger);

  if (nextCommercial === "paid") {
    return closeCommercially(req, updated.id, { skipAuth: true, actorId, actorName });
  }

  await recordCommercialTimeline({
    invoiceId: updated.id,
    executionId: updated.executionId,
    eventType: "INVOICE_PAYMENT_PENDING",
    description: `Awaiting payment · balance ₹${updated.balanceDue}`,
    actorId,
    actorName,
    companyId: updated.companyId,
    franchiseeId: updated.franchiseeId,
    branchId: updated.branchId,
  });

  return updated;
}

async function closeCommercially(
  req: Request,
  invoiceId: number,
  opts?: { skipAuth?: boolean; actorId?: number | null; actorName?: string | null },
): Promise<Invoice> {
  if (!opts?.skipAuth) {
    assertAdminBillingActor(actorFromReq(req).role);
  }
  const actorId = opts?.actorId ?? actorFromReq(req).actorId;
  const actorName = opts?.actorName ?? actorFromReq(req).actorName;
  const invoice = await loadInvoiceInScope(req, invoiceId);

  const [updated] = await db.update(invoicesTable)
    .set({
      status: "paid",
      commercialStatus: "commercially_closed",
      commerciallyClosedAt: new Date(),
      paidAt: invoice.paidAt ?? new Date(),
      balanceDue: "0",
      dueAmount: "0",
      updatedAt: new Date(),
    })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  if (!updated) throw new CommercialValidationError("Invoice not found", "NOT_FOUND");

  await recordCommercialTimeline({
    invoiceId: updated.id,
    executionId: updated.executionId,
    eventType: "INVOICE_PAID",
    description: `Paid ${updated.invoiceNumber}`,
    actorId,
    actorName,
    companyId: updated.companyId,
    franchiseeId: updated.franchiseeId,
    branchId: updated.branchId,
  });

  await recordCommercialTimeline({
    invoiceId: updated.id,
    executionId: updated.executionId,
    eventType: "COMMERCIAL_CLOSED",
    description: "Commercial closure complete",
    actorId,
    actorName,
    companyId: updated.companyId,
    franchiseeId: updated.franchiseeId,
    branchId: updated.branchId,
  });

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      executionId: updated.executionId,
      contractId: updated.contractRegistryId,
      customerId: updated.customerId,
      actorId,
    }),
    type: "InvoicePaid",
  }, logger);

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      executionId: updated.executionId,
      contractId: updated.contractRegistryId,
      customerId: updated.customerId,
      actorId,
    }),
    type: "CommercialClosed",
  }, logger);

  return updated;
}

export async function markInvoicePaid(
  req: Request,
  invoiceId: number,
  body?: {
    amount?: number;
    method?: "cash" | "upi" | "card" | "bank_transfer" | "wallet";
    transactionId?: string;
    notes?: string;
  },
): Promise<Invoice> {
  const { actorId, actorName, role } = actorFromReq(req);
  assertAdminBillingActor(role);
  const invoice = await loadInvoiceInScope(req, invoiceId);
  assertCanMarkPaid(invoice);

  const balance = parseFloat(invoice.balanceDue);
  if (balance > 0) {
    const amount = body?.amount ?? balance;
    await recordPayment({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      amount,
      method: body?.method ?? "cash",
      transactionId: body?.transactionId,
      notes: body?.notes ?? "Marked paid via commercial closure",
      companyId: invoice.companyId,
      branchId: invoice.branchId,
    });
  }

  return closeCommercially(req, invoiceId, { actorId, actorName });
}

export async function voidInvoice(
  req: Request,
  invoiceId: number,
  reason?: string,
): Promise<Invoice> {
  const { actorId, actorName, role } = actorFromReq(req);
  assertAdminBillingActor(role);
  const invoice = await loadInvoiceInScope(req, invoiceId);
  assertCanVoid(invoice);

  const [updated] = await db.update(invoicesTable)
    .set({
      status: "cancelled",
      commercialStatus: "voided",
      voidedAt: new Date(),
      voidReason: reason?.trim() || "Voided",
      updatedAt: new Date(),
    })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();

  if (!updated) throw new CommercialValidationError("Invoice not found", "NOT_FOUND");

  await recordCommercialTimeline({
    invoiceId: updated.id,
    executionId: updated.executionId,
    eventType: "INVOICE_VOIDED",
    description: updated.voidReason,
    actorId,
    actorName,
    companyId: updated.companyId,
    franchiseeId: updated.franchiseeId,
    branchId: updated.branchId,
  });

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      executionId: updated.executionId,
      contractId: updated.contractRegistryId,
      customerId: updated.customerId,
      actorId,
      metadata: { reason: updated.voidReason },
    }),
    type: "InvoiceVoided",
  }, logger);

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      executionId: updated.executionId,
      contractId: updated.contractRegistryId,
      customerId: updated.customerId,
      actorId,
    }),
    type: "InvoiceCancelled",
  }, logger);

  return updated;
}

/** Future-ready credit note wrapper — reuses existing createCreditNote. */
export async function createCommercialCreditNote(
  req: Request,
  invoiceId: number,
  body: { items?: InvoiceItem[]; reason?: string },
): Promise<Invoice> {
  const { actorId, actorName, role } = actorFromReq(req);
  assertAdminBillingActor(role);
  const invoice = await loadInvoiceInScope(req, invoiceId);

  if (invoice.commercialStatus === "voided" || invoice.status === "cancelled") {
    throw new CommercialValidationError("Cannot credit a voided invoice", "INVALID_STATE");
  }

  const items = body.items?.length
    ? body.items
    : (invoice.items as InvoiceItem[]);

  const credit = await createCreditNote({
    referenceInvoiceId: invoice.id,
    items,
    creditReason: body.reason ?? "Commercial credit note",
    companyId: invoice.companyId,
    franchiseeId: invoice.franchiseeId,
    branchId: invoice.branchId,
  });

  await recordCommercialTimeline({
    invoiceId: invoice.id,
    executionId: invoice.executionId,
    eventType: "CREDIT_NOTE_CREATED",
    description: `Credit note ${credit.invoiceNumber}`,
    actorId,
    actorName,
    metadata: { creditNoteId: credit.id, creditNoteNumber: credit.invoiceNumber },
    companyId: invoice.companyId,
    franchiseeId: invoice.franchiseeId,
    branchId: invoice.branchId,
  });

  billingDomainEventPublisher.publish({
    ...baseBillingEventFields({
      invoiceId: credit.id,
      invoiceNumber: credit.invoiceNumber,
      executionId: invoice.executionId,
      contractId: invoice.contractRegistryId,
      customerId: invoice.customerId,
      actorId,
      metadata: { referenceInvoiceId: invoice.id },
    }),
    type: "CreditNoteCreated",
  }, logger);

  return credit;
}

export async function listCommercialInvoices(
  req: Request,
  opts: {
    commercialStatus?: InvoiceCommercialStatus | "outstanding" | "all";
    limit?: number;
    offset?: number;
  },
): Promise<{ items: Invoice[]; total: number }> {
  assertAdminBillingActor(actorFromReq(req).role);
  const lim = Math.min(opts.limit ?? 50, 100);
  const off = opts.offset ?? 0;

  const conditions = [...tenantFilters(req, INVOICE_SCOPE), eq(invoicesTable.documentType, "tax_invoice")];

  if (opts.commercialStatus === "outstanding") {
    conditions.push(inArray(invoicesTable.commercialStatus, ["issued", "payment_pending"]));
    conditions.push(sql`cast(${invoicesTable.balanceDue} as numeric) > 0`);
  } else if (opts.commercialStatus && opts.commercialStatus !== "all") {
    conditions.push(eq(invoicesTable.commercialStatus, opts.commercialStatus));
  }

  const items = await db.select().from(invoicesTable)
    .where(and(...conditions))
    .orderBy(desc(invoicesTable.updatedAt), desc(invoicesTable.id))
    .limit(lim)
    .offset(off);

  const [countRow] = await db.select({ c: sql<number>`count(*)::int` })
    .from(invoicesTable)
    .where(and(...conditions));

  return { items, total: countRow?.c ?? 0 };
}

export async function getCommercialInvoiceDetail(req: Request, invoiceId: number) {
  assertAdminBillingActor(actorFromReq(req).role);
  const invoice = await loadInvoiceInScope(req, invoiceId);
  const timeline = await getMergedCommercialHistory(invoice.id, invoice.executionId);
  return { invoice, timeline };
}
