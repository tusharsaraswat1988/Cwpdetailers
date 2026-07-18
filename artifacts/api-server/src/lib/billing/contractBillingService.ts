/**
 * Sprint 4C — contract-first billing from Book Services.
 * Every quotation/invoice must reference an existing customer_contracts registry row.
 */

import {
  db,
  customerContractsTable,
  customersTable,
  bookingsTable,
  servicesTable,
  catalogPackagesTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  subscriptionsTable,
  customerEntitlementsTable,
  quotationsTable,
  invoicesTable,
  type CustomerContract,
  type InvoiceItem,
} from "@workspace/db";
import { enqueuePendingFromContract } from "../assignments/pendingAssignmentEnqueue";
import { eq, and, sql } from "drizzle-orm";
import { getDefaultGstRate } from "../catalog/pricingEngine";
import {
  computeInvoiceGst,
  resolvePlaceOfSupply,
} from "./invoiceGstEngine";
import {
  createInvoice,
  buildCustomerSnapshot,
  type TenantFields,
} from "./invoiceService";
import { getInvoiceBillingSettings } from "./invoiceBillingSettings";
import type { Transaction } from "../../subscriptions/service";

export type GstSummary = {
  subtotal: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  isCorporate: boolean;
  isInterState: boolean;
};

export type ContractBillingResult = {
  contractRegistryId: number;
  quotationId?: number;
  quotationNumber?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  pendingAssignmentId: number;
  paymentTerms: string;
  gstSummary: GstSummary;
};

type BillingLineDraft = {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstInclusive: boolean;
  serviceCategory: string;
  sac: string;
};

type BuiltBillingContext = {
  contract: CustomerContract;
  lines: BillingLineDraft[];
  bookingId?: number | null;
  subscriptionId?: number | null;
  invoiceDiscount: number;
  paymentTerms: string;
  gstInclusive: boolean;
};

const VALID_PAYMENT_TERMS = new Set(["full_advance", "partial_advance", "after_service"]);

/**
 * Stable quotation numbers from DB max sequence (survives restarts / multi-instance).
 * Format preserved: Q-{calendarYear}-{####} for backward compatibility.
 */
async function generateQuotationNumber(tx?: Transaction): Promise<string> {
  const ctx = tx ?? db;
  const fy = new Date().getFullYear();
  const prefix = `Q-${fy}-`;
  const [row] = await ctx
    .select({
      maxNum: sql<string>`max(cast(substring(${quotationsTable.quotationNumber} from '[0-9]+$') as integer))`,
    })
    .from(quotationsTable)
    .where(sql`${quotationsTable.quotationNumber} like ${prefix + "%"}`);
  const next = Math.max(1001, (parseInt(row?.maxNum ?? "0", 10) || 0) + 1);
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function serviceCategoryForContract(contract: CustomerContract): string {
  switch (contract.productLine) {
    case "daily_cleaning": return "dcms";
    case "wash_package":
    case "monthly_wash": return "package";
    case "solar_amc": return "solar";
    case "one_time_service": return "service";
    case "detailing_plan": return "detailing";
    default: return "general";
  }
}

function paymentTermsFromSummary(summary: Record<string, unknown>): string {
  const terms = summary.paymentTerms;
  if (typeof terms === "string" && VALID_PAYMENT_TERMS.has(terms)) return terms;
  return "after_service";
}

function discountFromSummary(summary: Record<string, unknown>, grossTotal: number): number {
  const discountType = summary.discountType;
  const discountValue = summary.discountValue;
  if (discountType === "percent" && typeof discountValue === "string") {
    const pct = Math.min(100, Math.max(0, parseFloat(discountValue) || 0));
    return Math.round((grossTotal * pct) / 100 * 100) / 100;
  }
  if (discountType === "flat" && typeof discountValue === "string") {
    return Math.min(grossTotal, Math.max(0, parseFloat(discountValue) || 0));
  }
  return 0;
}

async function loadContract(registryId: number, tx?: Transaction): Promise<CustomerContract> {
  const ctx = tx ?? db;
  const [contract] = await ctx.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, registryId))
    .limit(1);
  if (!contract) throw new Error("Service contract not found — billing requires an existing contract");
  return contract;
}

async function buildBillingContext(registryId: number, tx?: Transaction): Promise<BuiltBillingContext> {
  const ctx = tx ?? db;
  const contract = await loadContract(registryId, tx);
  const summary = (contract.summaryJson ?? {}) as Record<string, unknown>;
  const paymentTerms = paymentTermsFromSummary(summary);
  const defaultRate = await getDefaultGstRate();
  const billingSettings = await getInvoiceBillingSettings();
  const defaultSac = billingSettings.defaultSac;
  const category = serviceCategoryForContract(contract);
  const lines: BillingLineDraft[] = [];
  let bookingId: number | null = null;
  let subscriptionId: number | null = null;
  let gstInclusive = true;

  switch (contract.sourceSystem) {
    case "booking": {
      const [booking] = await ctx.select().from(bookingsTable)
        .where(eq(bookingsTable.id, contract.sourceId)).limit(1);
      if (!booking) throw new Error("Booking source record not found for contract");

      bookingId = booking.id;
      // Phase 5.2: amount lives on contract summaryJson (not bookings)
      const amount = parseFloat(String(summary.amount ?? "0"));
      if (amount <= 0) throw new Error("Contract has no billable amount");

      const [svc] = booking.serviceId
        ? await ctx.select().from(servicesTable).where(eq(servicesTable.id, booking.serviceId)).limit(1)
        : [null];

      const svcRate = svc ? parseFloat(svc.gstRate) : defaultRate;
      gstInclusive = svc?.pricingType !== "exclusive";

      lines.push({
        description: (summary.serviceName as string) ?? svc?.name ?? "One-time service",
        quantity: 1,
        unitPrice: amount,
        gstRate: svcRate,
        gstInclusive,
        serviceCategory: category,
        sac: defaultSac,
      });
      break;
    }
    case "dcms": {
      const [row] = await ctx.select({
        sub: dcmsSubscriptionsTable,
        plan: dcmsPlansTable,
      })
        .from(dcmsSubscriptionsTable)
        .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
        .where(eq(dcmsSubscriptionsTable.id, contract.sourceId))
        .limit(1);
      if (!row) throw new Error("DCMS subscription not found for contract");

      const price = parseFloat(row.plan.price);
      if (price <= 0) throw new Error("Contract has no billable amount");

      lines.push({
        description: `Daily cleaning plan: ${row.plan.name}`,
        quantity: 1,
        unitPrice: price,
        gstRate: defaultRate,
        gstInclusive: true,
        serviceCategory: "dcms",
        sac: defaultSac,
      });
      break;
    }
    case "subscription": {
      const [sub] = await ctx.select().from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, contract.sourceId)).limit(1);
      if (!sub) throw new Error("Subscription not found for contract");

      subscriptionId = sub.id;
      const price = parseFloat(sub.price ?? "0");
      if (price <= 0) throw new Error("Contract has no billable amount");

      let gstRate = defaultRate;
      let pricingType: "inclusive" | "exclusive" = "inclusive";
      let label = (summary.packageName as string) ?? "Service plan";

      if (contract.catalogRefKind === "package" && contract.catalogRefId) {
        const [pkg] = await ctx.select().from(catalogPackagesTable)
          .where(eq(catalogPackagesTable.id, contract.catalogRefId)).limit(1);
        if (pkg) {
          gstRate = parseFloat(pkg.gstRate) || defaultRate;
          pricingType = pkg.pricingType as "inclusive" | "exclusive";
          label = pkg.name;
        }
      }

      gstInclusive = pricingType !== "exclusive";
      lines.push({
        description: label,
        quantity: 1,
        unitPrice: price,
        gstRate,
        gstInclusive,
        serviceCategory: category,
        sac: defaultSac,
      });
      break;
    }
    case "entitlement": {
      const [ent] = await ctx.select().from(customerEntitlementsTable)
        .where(eq(customerEntitlementsTable.id, contract.sourceId)).limit(1);
      if (!ent?.packageId) throw new Error("Entitlement package not found for contract");

      const [pkg] = await ctx.select().from(catalogPackagesTable)
        .where(eq(catalogPackagesTable.id, ent.packageId)).limit(1);
      if (!pkg) throw new Error("Package not found for contract");

      const price = parseFloat(pkg.price);
      if (price <= 0) throw new Error("Contract has no billable amount");

      gstInclusive = pkg.pricingType !== "exclusive";
      lines.push({
        description: `Package: ${pkg.name}`,
        quantity: 1,
        unitPrice: price,
        gstRate: parseFloat(pkg.gstRate) || defaultRate,
        gstInclusive,
        serviceCategory: "package",
        sac: defaultSac,
      });
      break;
    }
    default:
      throw new Error(`Unsupported contract source: ${contract.sourceSystem}`);
  }

  const grossTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const invoiceDiscount = contract.sourceSystem === "booking" || contract.sourceSystem === "subscription"
    ? 0
    : discountFromSummary(summary, grossTotal);

  return {
    contract,
    lines,
    bookingId,
    subscriptionId,
    invoiceDiscount,
    paymentTerms,
    gstInclusive,
  };
}

async function computeBillingGst(
  customerId: number,
  lines: BillingLineDraft[],
  invoiceDiscount: number,
  tx?: Transaction,
): Promise<{ items: InvoiceItem[]; gst: ReturnType<typeof computeInvoiceGst>; isCorporate: boolean }> {
  const ctx = tx ?? db;
  const [customer] = await ctx.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) throw new Error("Customer not found");

  const snapshot = await buildCustomerSnapshot(customerId, undefined, tx);
  const pos = resolvePlaceOfSupply({
    customerState: snapshot.state,
    customerGstin: snapshot.gstin,
    explicit: snapshot.placeOfSupply,
  });

  const items: InvoiceItem[] = lines.map(line => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.quantity * line.unitPrice,
    gstRate: line.gstRate,
    sac: line.sac,
    serviceCategory: line.serviceCategory,
  }));

  const gstInclusive = lines.every(l => l.gstInclusive);
  const gst = computeInvoiceGst({
    items,
    invoiceDiscount,
    gstInclusive,
    isInterState: pos.isInterState,
  });

  return {
    items: gst.items,
    gst,
    isCorporate: Boolean(customer.gstin?.trim()),
  };
}

function toGstSummary(
  gst: ReturnType<typeof computeInvoiceGst>,
  isCorporate: boolean,
  isInterState: boolean,
): GstSummary {
  return {
    subtotal: gst.subtotal,
    gstAmount: gst.gstAmount,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    totalAmount: gst.totalAmount,
    isCorporate,
    isInterState,
  };
}

async function mergeContractSummary(
  registryId: number,
  patch: Record<string, unknown>,
  tx?: Transaction,
) {
  const ctx = tx ?? db;
  const contract = await loadContract(registryId, tx);
  const merged = { ...(contract.summaryJson as Record<string, unknown>), ...patch };
  await ctx.update(customerContractsTable)
    .set({ summaryJson: merged, updatedAt: new Date() })
    .where(eq(customerContractsTable.id, registryId));
}

/** @deprecated Use enqueuePendingFromContract from pendingAssignmentEnqueue.ts */
export async function createPendingAssignmentForContract(
  contract: CustomerContract,
  tenant: TenantFields,
  tx?: Transaction,
): Promise<number> {
  return enqueuePendingFromContract(contract, tenant, tx);
}

export async function createQuotationForContract(
  registryId: number,
  tenant: TenantFields,
  tx?: Transaction,
): Promise<ContractBillingResult> {
  const ctx = tx ?? db;

  const [existing] = await ctx.select().from(quotationsTable)
    .where(and(
      eq(quotationsTable.contractRegistryId, registryId),
      eq(quotationsTable.status, "sent"),
    ))
    .limit(1);
  if (existing) {
    throw new Error(`Quotation ${existing.quotationNumber} already exists for this contract`);
  }

  const built = await buildBillingContext(registryId, tx);
  const { items, gst, isCorporate } = await computeBillingGst(
    built.contract.customerId,
    built.lines,
    built.invoiceDiscount,
    tx,
  );

  const snapshot = await buildCustomerSnapshot(built.contract.customerId, undefined, tx);
  const pos = resolvePlaceOfSupply({
    customerState: snapshot.state,
    customerGstin: snapshot.gstin,
  });

  const [quotation] = await ctx.insert(quotationsTable).values({
    quotationNumber: await generateQuotationNumber(tx),
    customerId: built.contract.customerId,
    contractRegistryId: registryId,
    serviceLocationId: built.contract.serviceLocationId,
    assetId: built.contract.registryAssetId,
    serviceId: built.contract.serviceId,
    bookingId: built.bookingId ?? null,
    paymentTerms: built.paymentTerms,
    items,
    subtotal: gst.subtotal.toString(),
    gstAmount: gst.gstAmount.toString(),
    cgstAmount: gst.cgstAmount.toString(),
    sgstAmount: gst.sgstAmount.toString(),
    igstAmount: gst.igstAmount.toString(),
    discount: built.invoiceDiscount.toString(),
    totalAmount: gst.totalAmount.toString(),
    status: "sent",
    notes: `Book Services quotation · Contract #${registryId}`,
    companyId: tenant.companyId ?? built.contract.companyId,
    franchiseeId: tenant.franchiseeId ?? built.contract.franchiseeId,
    branchId: tenant.branchId ?? built.contract.branchId,
  }).returning();

  const pendingAssignmentId = await createPendingAssignmentForContract(built.contract, tenant, tx);

  await mergeContractSummary(registryId, {
    quotationId: quotation!.id,
    quotationNumber: quotation!.quotationNumber,
    pendingAssignmentId,
    billingStatus: "quotation_sent",
  }, tx);

  return {
    contractRegistryId: registryId,
    quotationId: quotation!.id,
    quotationNumber: quotation!.quotationNumber,
    pendingAssignmentId,
    paymentTerms: built.paymentTerms,
    gstSummary: toGstSummary(gst, isCorporate, pos.isInterState),
  };
}

export async function createInvoiceForContract(
  registryId: number,
  tenant: TenantFields,
  tx?: Transaction,
): Promise<ContractBillingResult> {
  const ctx = tx ?? db;

  const [existing] = await ctx.select().from(invoicesTable)
    .where(and(
      eq(invoicesTable.contractRegistryId, registryId),
      eq(invoicesTable.documentType, "tax_invoice"),
    ))
    .limit(1);
  if (existing) {
    throw new Error(`Invoice ${existing.invoiceNumber} already exists for this contract`);
  }

  const built = await buildBillingContext(registryId, tx);
  const { items, gst, isCorporate } = await computeBillingGst(
    built.contract.customerId,
    built.lines,
    built.invoiceDiscount,
    tx,
  );

  const snapshot = await buildCustomerSnapshot(built.contract.customerId, undefined, tx);
  const pos = resolvePlaceOfSupply({
    customerState: snapshot.state,
    customerGstin: snapshot.gstin,
  });

  const invoice = await createInvoice({
    customerId: built.contract.customerId,
    items,
    discount: built.invoiceDiscount,
    gstInclusive: built.gstInclusive,
    bookingId: built.bookingId ?? null,
    subscriptionId: built.subscriptionId ?? null,
    contractRegistryId: registryId,
    serviceLocationId: built.contract.serviceLocationId,
    assetId: built.contract.registryAssetId,
    serviceId: built.contract.serviceId,
    paymentTerms: built.paymentTerms,
    gstin: isCorporate ? snapshot.gstin : null,
    status: "sent",
    ...tenant,
    companyId: tenant.companyId ?? built.contract.companyId,
    franchiseeId: tenant.franchiseeId ?? built.contract.franchiseeId,
    branchId: tenant.branchId ?? built.contract.branchId,
  }, tx);

  const pendingAssignmentId = await createPendingAssignmentForContract(built.contract, tenant, tx);

  await mergeContractSummary(registryId, {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    pendingAssignmentId,
    billingStatus: "invoiced",
  }, tx);

  return {
    contractRegistryId: registryId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    pendingAssignmentId,
    paymentTerms: built.paymentTerms,
    gstSummary: toGstSummary(gst, isCorporate, pos.isInterState),
  };
}

export async function previewContractBilling(registryId: number): Promise<{
  paymentTerms: string;
  gstSummary: GstSummary;
  lineCount: number;
}> {
  const built = await buildBillingContext(registryId);
  const { gst, isCorporate } = await computeBillingGst(
    built.contract.customerId,
    built.lines,
    built.invoiceDiscount,
  );
  const snapshot = await buildCustomerSnapshot(built.contract.customerId);
  const pos = resolvePlaceOfSupply({
    customerState: snapshot.state,
    customerGstin: snapshot.gstin,
  });

  return {
    paymentTerms: built.paymentTerms,
    gstSummary: toGstSummary(gst, isCorporate, pos.isInterState),
    lineCount: built.lines.length,
  };
}
