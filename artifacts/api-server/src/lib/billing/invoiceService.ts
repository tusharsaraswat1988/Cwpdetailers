import { db } from "@workspace/db";

import {

  invoicesTable,

  paymentsTable,

  customersTable,

  catalogPackagesTable,

  servicesTable,

  businessInfoTable,

  type InvoiceItem,

  type Invoice,

  type InvoiceCustomerSnapshot,

  type InvoiceDocumentType,

} from "@workspace/db";

import { eq, and, sql, gt, asc } from "drizzle-orm";

import type { Transaction } from "../../subscriptions/service";

import { logger } from "../logger";

import {

  computeInvoiceGst,

  financialYearLabel,

  resolvePlaceOfSupply,

  DEFAULT_SAC,

} from "./invoiceGstEngine";

import { getTermsForCategories } from "./invoiceBillingSettings";

import { getDefaultGstRate } from "../catalog/pricingEngine";

import { creditWallet, debitWallet, getLedgerBalance } from "../wallet/service";



export type TenantFields = {

  companyId?: number | null;

  franchiseeId?: number | null;

  branchId?: number | null;

};



export type CreateInvoiceInput = {

  customerId: number;

  items: InvoiceItem[];

  discount?: number;

  gstInclusive?: boolean;

  subscriptionId?: number | null;

  bookingId?: number | null;

  quotationId?: number | null;

  contractRegistryId?: number | null;

  /** Phase 5.6 — Job id (= service_executions.id) */
  executionId?: number | null;

  serviceLocationId?: number | null;

  assetId?: number | null;

  serviceId?: number | null;

  paymentTerms?: string | null;

  dueDate?: string | null;

  status?: Invoice["status"];

  /** Phase 5.6 commercial lifecycle */
  commercialStatus?: Invoice["commercialStatus"];

  billingMode?: Invoice["billingMode"];

  entitlementConsumed?: boolean;

  paidAmount?: number;

  gstin?: string | null;

  documentType?: InvoiceDocumentType;

  referenceInvoiceId?: number | null;

  creditReason?: string | null;

  notes?: string | null;

  terms?: string[] | null;

  customerSnapshot?: Partial<InvoiceCustomerSnapshot>;

  placeOfSupply?: string | null;

} & TenantFields;



let invoiceCounter = 1000;



async function loadCustomer(customerId: number, tx?: Transaction) {

  const ctx = tx ?? db;

  const [customer] = await ctx.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);

  return customer ?? null;

}



async function loadSupplierState(tx?: Transaction) {

  const ctx = tx ?? db;

  const [biz] = await ctx.select({ state: businessInfoTable.state, gstNumber: businessInfoTable.gstNumber })

    .from(businessInfoTable).where(eq(businessInfoTable.id, 1)).limit(1);

  return biz ?? null;

}



export async function buildCustomerSnapshot(

  customerId: number,

  overrides?: Partial<InvoiceCustomerSnapshot>,

  tx?: Transaction,

): Promise<InvoiceCustomerSnapshot> {

  const customer = await loadCustomer(customerId, tx);

  if (!customer) throw new Error("Customer not found");



  const supplier = await loadSupplierState(tx);

  const pos = resolvePlaceOfSupply({

    customerState: overrides?.state ?? customer.city ?? supplier?.state ?? null,

    customerGstin: overrides?.gstin ?? customer.gstin,

    explicit: overrides?.placeOfSupply,

  });



  return {

    name: overrides?.name ?? customer.billingName ?? customer.name,

    billingName: overrides?.billingName ?? customer.billingName,

    phone: overrides?.phone ?? customer.phone,

    email: overrides?.email ?? customer.email,

    address: overrides?.address ?? customer.address,

    city: overrides?.city ?? customer.city,

    state: overrides?.state ?? supplier?.state ?? "Uttar Pradesh",

    pinCode: overrides?.pinCode ?? null,

    gstin: overrides?.gstin ?? customer.gstin,

    placeOfSupply: pos.placeOfSupply,

    supplyStateCode: pos.supplyStateCode,

  };

}



export async function generateDocumentNumber(

  documentType: InvoiceDocumentType = "tax_invoice",

  tx?: Transaction,

): Promise<string> {

  const ctx = tx ?? db;

  const fy = financialYearLabel();

  const prefix = documentType === "credit_note"

    ? `CWP/CN/${fy}/`

    : documentType === "debit_note"

      ? `CWP/DN/${fy}/`

      : `CWP/${fy}/`;



  const [row] = await ctx

    .select({

      maxNum: sql<string>`max(cast(substring(${invoicesTable.invoiceNumber} from '[0-9]+$') as integer))`,

    })

    .from(invoicesTable)

    .where(sql`${invoicesTable.invoiceNumber} like ${prefix + "%"}`);



  const next = Math.max(invoiceCounter, parseInt(row?.maxNum ?? "0", 10) + 1);

  invoiceCounter = next;

  return `${prefix}${next}`;

}



/** @deprecated use generateDocumentNumber */

export async function generateInvoiceNumber(tx?: Transaction): Promise<string> {

  return generateDocumentNumber("tax_invoice", tx);

}



export async function getCustomerOutstandingDues(customerId: number, tx?: Transaction): Promise<number> {

  const ctx = tx ?? db;

  const [row] = await ctx

    .select({ total: sql<string>`coalesce(sum(${invoicesTable.balanceDue}), 0)` })

    .from(invoicesTable)

    .where(and(

      eq(invoicesTable.customerId, customerId),

      eq(invoicesTable.documentType, "tax_invoice"),

      sql`${invoicesTable.balanceDue} > 0`,

      sql`${invoicesTable.status} not in ('paid', 'cancelled')`,

    ));

  return parseFloat(row?.total ?? "0");

}



export async function syncCustomerTotalDues(customerId: number, tx?: Transaction): Promise<number> {

  const ctx = tx ?? db;

  const total = await getCustomerOutstandingDues(customerId, tx);

  await ctx

    .update(customersTable)

    .set({ totalDues: total.toFixed(2), updatedAt: new Date() })

    .where(eq(customersTable.id, customerId));

  return total;

}



export async function findInvoiceByBookingId(bookingId: number, tx?: Transaction) {

  const ctx = tx ?? db;

  const [row] = await ctx

    .select()

    .from(invoicesTable)

    .where(eq(invoicesTable.bookingId, bookingId))

    .limit(1);

  return row ?? null;

}



async function normalizeItems(items: InvoiceItem[]): Promise<InvoiceItem[]> {

  const defaultRate = await getDefaultGstRate();

  return items.map(item => ({

    ...item,

    sac: item.sac ?? item.hsn ?? DEFAULT_SAC,

    unit: item.unit ?? "UNT",

    gstRate: item.gstRate ?? defaultRate,

  }));

}



export async function createInvoice(input: CreateInvoiceInput, tx?: Transaction): Promise<Invoice> {

  const ctx = tx ?? db;

  const documentType = input.documentType ?? "tax_invoice";

  const snapshot = input.customerSnapshot

    ? await buildCustomerSnapshot(input.customerId, input.customerSnapshot, tx)

    : await buildCustomerSnapshot(input.customerId, { placeOfSupply: input.placeOfSupply ?? undefined }, tx);



  const pos = resolvePlaceOfSupply({

    customerState: snapshot.state,

    customerGstin: snapshot.gstin ?? input.gstin,

    explicit: input.placeOfSupply ?? snapshot.placeOfSupply,

  });



  const normalizedItems = await normalizeItems(input.items);

  const categories = [...new Set(normalizedItems.map(i => i.serviceCategory).filter(Boolean))] as string[];

  const terms = input.terms?.length

    ? input.terms

    : await getTermsForCategories(categories);



  const gst = computeInvoiceGst({

    items: normalizedItems,

    invoiceDiscount: input.discount ?? 0,

    gstInclusive: input.gstInclusive !== false,

    isInterState: pos.isInterState,

  });



  const hasChargeableLine = gst.totalAmount > 0

    || normalizedItems.some(i => i.isComplimentary);

  if (!hasChargeableLine) throw new Error("Invoice must include at least one line item");



  const paid = Math.max(0, input.paidAmount ?? 0);

  const balanceDue = documentType === "credit_note"

    ? 0

    : Math.max(0, gst.totalAmount - paid);

  const dueAmount = balanceDue;



  let status = input.status ?? "sent";

  if (documentType === "credit_note") status = "sent";

  else if (status !== "draft" && balanceDue <= 0 && paid > 0) status = "paid";

  else if (status !== "draft" && balanceDue <= 0 && gst.totalAmount === 0) status = "paid";

  let commercialStatus = input.commercialStatus;
  if (!commercialStatus) {
    if (documentType === "credit_note") commercialStatus = "issued";
    else if (status === "draft") commercialStatus = "draft";
    else if (status === "cancelled") commercialStatus = "voided";
    else if (status === "paid") commercialStatus = "commercially_closed";
    else commercialStatus = "payment_pending";
  }



  let referenceInvoiceNumber: string | null = null;

  let referenceInvoiceDate: string | null = null;

  if (input.referenceInvoiceId) {

    const [ref] = await ctx.select().from(invoicesTable).where(eq(invoicesTable.id, input.referenceInvoiceId)).limit(1);

    if (!ref) throw new Error("Reference invoice not found");

    referenceInvoiceNumber = ref.invoiceNumber;

    referenceInvoiceDate = ref.issuedAt

      ? new Date(ref.issuedAt).toISOString().slice(0, 10)

      : ref.createdAt.toISOString().slice(0, 10);



    if (documentType === "credit_note") {

      const creditValue = gst.totalAmount;

      const newBal = Math.max(0, parseFloat(ref.balanceDue) - creditValue);

      await ctx.update(invoicesTable).set({

        balanceDue: newBal.toFixed(2),

        dueAmount: newBal.toFixed(2),

        status: newBal <= 0 ? "paid" : ref.status,

        paidAt: newBal <= 0 ? new Date() : ref.paidAt,

        updatedAt: new Date(),

      }).where(eq(invoicesTable.id, ref.id));

    }

  }



  const gstin = input.gstin !== undefined ? input.gstin : snapshot.gstin ?? null;



  const [invoice] = await ctx.insert(invoicesTable).values({

    invoiceNumber: await generateDocumentNumber(documentType, tx),

    documentType,

    referenceInvoiceId: input.referenceInvoiceId ?? null,

    referenceInvoiceNumber,

    referenceInvoiceDate,

    customerId: input.customerId,

    customerSnapshot: snapshot,

    subscriptionId: input.subscriptionId ?? null,

    bookingId: input.bookingId ?? null,

    quotationId: input.quotationId ?? null,

    contractRegistryId: input.contractRegistryId ?? null,

    executionId: input.executionId ?? null,

    serviceLocationId: input.serviceLocationId ?? null,

    assetId: input.assetId ?? null,

    serviceId: input.serviceId ?? null,

    paymentTerms: input.paymentTerms ?? null,

    billingMode: input.billingMode ?? null,

    commercialStatus,

    entitlementConsumed: input.entitlementConsumed ?? false,

    items: gst.items,

    subtotal: gst.subtotal.toString(),

    tax: "0",

    gstAmount: gst.gstAmount.toString(),

    cgstAmount: gst.cgstAmount.toString(),

    sgstAmount: gst.sgstAmount.toString(),

    igstAmount: gst.igstAmount.toString(),

    discount: gst.discount.toString(),

    roundOff: gst.roundOff.toString(),

    totalAmount: gst.totalAmount.toString(),

    paidAmount: paid.toString(),

    dueAmount: dueAmount.toString(),

    balanceDue: balanceDue.toString(),

    status,

    gstin,

    placeOfSupply: pos.placeOfSupply,

    supplyStateCode: pos.supplyStateCode,

    isInterState: pos.isInterState,

    hsnSummary: gst.hsnSummary,

    notes: input.notes ?? null,

    terms,

    creditReason: input.creditReason ?? null,

    currency: "INR",

    companyId: input.companyId ?? null,

    franchiseeId: input.franchiseeId ?? null,

    branchId: input.branchId ?? null,

    dueDate: input.dueDate ?? null,

    issuedAt: status === "draft" ? null : new Date(),

    paidAt: status !== "draft" && balanceDue <= 0 && documentType !== "credit_note" ? new Date() : null,

    commerciallyClosedAt: commercialStatus === "commercially_closed" ? new Date() : null,

  }).returning();



  await syncCustomerTotalDues(input.customerId, tx);

  logger.info({ invoiceId: invoice.id, customerId: input.customerId, total: gst.totalAmount, documentType }, "Invoice created");

  return invoice;

}



export async function createCreditNote(

  params: {

    referenceInvoiceId: number;

    items?: InvoiceItem[];

    creditAmount?: number;

    creditReason?: string;

    notes?: string | null;

  } & TenantFields,

  tx?: Transaction,

): Promise<Invoice> {

  const ctx = tx ?? db;

  const [ref] = await ctx.select().from(invoicesTable).where(eq(invoicesTable.id, params.referenceInvoiceId)).limit(1);

  if (!ref) throw new Error("Reference invoice not found");



  let items: InvoiceItem[];

  if (params.items?.length) {

    items = params.items;

  } else {

    const amount = params.creditAmount ?? parseFloat(ref.balanceDue) ?? parseFloat(ref.totalAmount);

    if (!amount || amount <= 0) throw new Error("Nothing to credit on this invoice");

    items = [{

      description: `Credit against invoice ${ref.invoiceNumber}`,

      quantity: 1,

      unitPrice: amount,

      total: amount,

      sac: DEFAULT_SAC,

      serviceCategory: "general",

    }];

  }



  return createInvoice({

    customerId: ref.customerId,

    items,

    documentType: "credit_note",

    referenceInvoiceId: ref.id,

    creditReason: params.creditReason ?? "Credit note issued",

    notes: params.notes,

    customerSnapshot: ref.customerSnapshot ?? undefined,

    gstin: ref.gstin,

    placeOfSupply: ref.placeOfSupply,

    companyId: params.companyId ?? ref.companyId,

    franchiseeId: params.franchiseeId ?? ref.franchiseeId,

    branchId: params.branchId ?? ref.branchId,

    status: "sent",

  }, tx);

}



export async function applyPaymentToInvoice(

  invoiceRow: Invoice,

  amount: number,

  tx?: Transaction,

): Promise<Invoice> {

  const ctx = tx ?? db;

  const newPaid = parseFloat(invoiceRow.paidAmount) + amount;

  const newDue = parseFloat(invoiceRow.totalAmount) - newPaid;

  const balanceDue = Math.max(0, newDue);



  const [updated] = await ctx.update(invoicesTable).set({

    paidAmount: newPaid.toString(),

    dueAmount: newDue.toString(),

    balanceDue: balanceDue.toString(),

    status: balanceDue <= 0 ? "paid" : invoiceRow.status,

    paidAt: balanceDue <= 0 ? new Date() : invoiceRow.paidAt,

    updatedAt: new Date(),

  }).where(eq(invoicesTable.id, invoiceRow.id)).returning();



  await syncCustomerTotalDues(invoiceRow.customerId, tx);

  return updated!;

}



export async function recordPayment(

  params: {

    customerId: number;

    amount: number;

    method: string;

    invoiceId?: number | null;

    useWallet?: boolean;

    transactionId?: string | null;

    notes?: string | null;

    receivedByStaffId?: number | null;

    createdBy?: number | null;

  } & TenantFields,

  tx?: Transaction,

) {

  const run = async (ctx: Transaction) => {

    let invoiceRow: Invoice | null = null;

    if (params.invoiceId) {

      const [inv] = await ctx.select().from(invoicesTable).where(eq(invoicesTable.id, params.invoiceId)).limit(1);

      invoiceRow = inv ?? null;

    } else {

      const [openInv] = await ctx

        .select()

        .from(invoicesTable)

        .where(

          and(

            eq(invoicesTable.customerId, params.customerId),

            gt(invoicesTable.balanceDue, "0"),

          ),

        )

        .orderBy(asc(invoicesTable.createdAt))

        .limit(1);

      invoiceRow = openInv ?? null;

    }



    let walletApplied = 0;

    let walletTxId: number | undefined;



    if (params.useWallet && invoiceRow) {

      const balanceDue = parseFloat(invoiceRow.balanceDue);

      if (balanceDue > 0) {

        const walletBalance = await getLedgerBalance(params.customerId, ctx);

        walletApplied = Math.min(walletBalance, balanceDue);

        if (walletApplied > 0) {

          const entry = await debitWallet({

            customerId: params.customerId,

            amount: walletApplied,

            reference: "invoice_payment",

            referenceId: invoiceRow.id,

            notes: params.notes ?? `Wallet applied to invoice ${invoiceRow.invoiceNumber}`,

            createdBy: params.createdBy ?? null,

            companyId: params.companyId ?? invoiceRow.companyId,

          }, ctx);

          walletTxId = entry.id;

        }

      }

    }



    const externalAmount = Math.max(0, params.amount);

    const totalToApply = walletApplied + externalAmount;



    if (totalToApply <= 0) {

      throw new Error("Payment amount must be greater than zero");

    }



    const paymentRows: (typeof paymentsTable.$inferSelect)[] = [];



    if (walletApplied > 0) {

      const [walletPayment] = await ctx.insert(paymentsTable).values({

        customerId: params.customerId,

        invoiceId: params.invoiceId ?? null,

        amount: walletApplied.toString(),

        method: "wallet",

        transactionId: walletTxId ? `wallet-tx-${walletTxId}` : null,

        notes: `Wallet offset${params.notes ? `: ${params.notes}` : ""}`,

        receivedByStaffId: params.receivedByStaffId ?? null,

        receivedAt: new Date(),

        status: "completed",

        companyId: params.companyId ?? null,

        branchId: params.branchId ?? null,

      }).returning();

      paymentRows.push(walletPayment);

    }



    if (externalAmount > 0) {

      const [extPayment] = await ctx.insert(paymentsTable).values({

        customerId: params.customerId,

        invoiceId: params.invoiceId ?? null,

        amount: externalAmount.toString(),

        method: params.method as typeof paymentsTable.$inferInsert["method"],

        transactionId: params.transactionId ?? null,

        notes: params.notes ?? null,

        receivedByStaffId: params.receivedByStaffId ?? null,

        receivedAt: new Date(),

        status: "completed",

        companyId: params.companyId ?? null,

        branchId: params.branchId ?? null,

      }).returning();

      paymentRows.push(extPayment);

    }



    if (invoiceRow) {

      const balanceDue = parseFloat(invoiceRow.balanceDue);

      const appliedToInvoice = Math.min(totalToApply, balanceDue);

      const overpayment = Math.max(0, totalToApply - balanceDue);



      if (appliedToInvoice > 0) {

        await applyPaymentToInvoice(invoiceRow, appliedToInvoice, ctx);

      }



      if (overpayment > 0) {

        const refPaymentId = paymentRows[paymentRows.length - 1]?.id;

        await creditWallet({

          customerId: params.customerId,

          amount: overpayment,

          paymentMode: "adjustment",

          reference: "overpayment",

          referenceId: refPaymentId,

          notes: `Overpayment credit from invoice ${invoiceRow.invoiceNumber}`,

          createdBy: params.createdBy ?? null,

          companyId: params.companyId ?? invoiceRow.companyId,

        }, ctx);

      }

    } else {

      await syncCustomerTotalDues(params.customerId, ctx);

    }



    return paymentRows[paymentRows.length - 1]!;

  };



  return tx ? run(tx) : db.transaction(run);

}



export async function maybeCreateInvoiceOnBookingComplete(
  booking: {
    id: number;
    customerId: number;
    contractRegistryId?: number | null;
    serviceId?: number | null;
    serviceType?: string;
    companyId?: number | null;
    franchiseeId?: number | null;
    branchId?: number | null;
  },
  extras?: { serviceName?: string | null; amount?: string | number | null },
  tx?: Transaction,
): Promise<Invoice | null> {
  const existing = await findInvoiceByBookingId(booking.id, tx);
  if (existing) return null;

  let amount = extras?.amount != null ? parseFloat(String(extras.amount)) : 0;
  if (!amount || amount <= 0) {
    const { customerContractsTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const dbOrTx = tx ?? db;
    const [contract] = booking.contractRegistryId
      ? await dbOrTx.select().from(customerContractsTable)
        .where(eq(customerContractsTable.id, booking.contractRegistryId)).limit(1)
      : await dbOrTx.select().from(customerContractsTable)
        .where(and(
          eq(customerContractsTable.sourceSystem, "booking"),
          eq(customerContractsTable.sourceId, booking.id),
        )).limit(1);
    const summary = (contract?.summaryJson ?? {}) as Record<string, unknown>;
    amount = parseFloat(String(summary.amount ?? "0"));
  }
  if (!amount || amount <= 0) return null;

  const description = extras?.serviceName
    ? `${extras.serviceName} · Booking #${booking.id}`
    : `${(booking.serviceType ?? "service").replace(/_/g, " ")} · Booking #${booking.id}`;



  return createInvoice({

    customerId: booking.customerId,

    bookingId: booking.id,

    items: [{

      description,

      quantity: 1,

      unitPrice: amount,

      total: amount,

      sac: DEFAULT_SAC,

      serviceCategory: "service",

    }],

    gstInclusive: true,

    status: "sent",

    companyId: booking.companyId,

    franchiseeId: booking.franchiseeId,

    branchId: booking.branchId,

  }, tx);

}



export async function createInvoiceForPackagePurchase(

  customerId: number,

  packageId: number,

  tenant: TenantFields,

  tx?: Transaction,

): Promise<Invoice | null> {

  const ctx = tx ?? db;

  const [pkg] = await ctx.select().from(catalogPackagesTable).where(eq(catalogPackagesTable.id, packageId)).limit(1);

  if (!pkg) throw new Error("Package not found");



  const price = parseFloat(pkg.price);

  if (!price || price <= 0) return null;



  return createInvoice({

    customerId,

    items: [{

      description: `Package: ${pkg.name}`,

      quantity: 1,

      unitPrice: price,

      total: price,

      sac: DEFAULT_SAC,

      serviceCategory: "package",

    }],

    gstInclusive: pkg.pricingType === "inclusive",

    status: "sent",

    ...tenant,

  }, tx);

}



export async function createInvoiceForDcmsPlan(

  customerId: number,

  plan: { name: string; price: string | number },

  tenant: TenantFields,

  tx?: Transaction,

): Promise<Invoice | null> {

  const price = parseFloat(String(plan.price));

  if (!price || price <= 0) return null;



  return createInvoice({

    customerId,

    items: [{

      description: `Daily cleaning plan: ${plan.name}`,

      quantity: 1,

      unitPrice: price,

      total: price,

      sac: DEFAULT_SAC,

      serviceCategory: "dcms",

    }],

    gstInclusive: true,

    status: "sent",

    ...tenant,

  }, tx);

}



export async function createPaidInvoiceForWalletRecharge(

  params: {

    customerId: number;

    amount: number;

    paymentMode: string;

    walletTransactionId: number;

    notes?: string | null;

    receivedByStaffId?: number | null;

  } & TenantFields,

  tx?: Transaction,

) {

  const ctx = tx ?? db;

  const invoice = await createInvoice({

    customerId: params.customerId,

    items: [{

      description: "Wallet recharge",

      quantity: 1,

      unitPrice: params.amount,

      total: params.amount,

      sac: DEFAULT_SAC,

      serviceCategory: "general",

    }],

    gstInclusive: true,

    status: "paid",

    paidAmount: params.amount,

    companyId: params.companyId,

    franchiseeId: params.franchiseeId,

    branchId: params.branchId,

  }, tx);



  await ctx.insert(paymentsTable).values({

    customerId: params.customerId,

    invoiceId: invoice.id,

    amount: params.amount.toString(),

    method: params.paymentMode as typeof paymentsTable.$inferInsert["method"],

    transactionId: `wallet-tx-${params.walletTransactionId}`,

    notes: params.notes ?? "Wallet recharge",

    receivedByStaffId: params.receivedByStaffId ?? null,

    receivedAt: new Date(),

    status: "completed",

    companyId: params.companyId ?? null,

    branchId: params.branchId ?? null,

  });



  return invoice;

}



export async function createInvoiceFromQuotation(

  quotation: {

    id: number;

    customerId: number;

    bookingId?: number | null;

    contractRegistryId?: number | null;

    serviceLocationId?: number | null;

    assetId?: number | null;

    serviceId?: number | null;

    paymentTerms?: string | null;

    items: InvoiceItem[];

    subtotal: string;

    gstAmount: string;

    discount: string;

    totalAmount: string;

  },

  tenant: TenantFields & { dueDate?: string | null; gstin?: string | null },

  tx?: Transaction,

): Promise<Invoice> {

  return createInvoice({

    customerId: quotation.customerId,

    bookingId: quotation.bookingId ?? null,

    quotationId: quotation.id,

    contractRegistryId: quotation.contractRegistryId ?? null,

    serviceLocationId: quotation.serviceLocationId ?? null,

    assetId: quotation.assetId ?? null,

    serviceId: quotation.serviceId ?? null,

    paymentTerms: quotation.paymentTerms ?? null,

    items: quotation.items,

    discount: parseFloat(quotation.discount),

    gstInclusive: true,

    dueDate: tenant.dueDate,

    gstin: tenant.gstin,

    status: "sent",

    ...tenant,

  }, tx);

}



export async function resolveBookingServiceName(serviceId?: number | null, tx?: Transaction): Promise<string | null> {

  if (!serviceId) return null;

  const ctx = tx ?? db;

  const [svc] = await ctx.select({ name: servicesTable.name }).from(servicesTable)

    .where(eq(servicesTable.id, serviceId)).limit(1);

  return svc?.name ?? null;

}


