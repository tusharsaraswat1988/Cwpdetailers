import { describe, expect, it, beforeEach } from "vitest";
import {
  assertAdminBillingActor,
  assertCanIssue,
  assertCanMarkPaid,
  assertCanVoid,
  assertContractBillable,
  assertJobReadyForBilling,
  assertNoExistingJobInvoice,
  assertNonNegativeTotals,
  isOneTimeMode,
  isSubscriptionVisitMode,
  CommercialValidationError,
} from "./commercialValidation";
import {
  billingDomainEventPublisher,
  baseBillingEventFields,
  type BillingDomainEvent,
} from "./commercialDomainEvents";
import type { CustomerContract, Invoice, ServiceExecution } from "@workspace/db";

function job(overrides: Partial<ServiceExecution> = {}): ServiceExecution {
  return {
    id: 1,
    serviceAssignmentId: 10,
    contractId: 2,
    customerId: 3,
    serviceLocationId: null,
    assetId: null,
    assignedStaffId: 4,
    taskType: "one_time_service",
    isSubstitute: false,
    substituteForStaffId: null,
    scheduledDate: "2026-07-17",
    scheduledTime: null,
    status: "completed",
    startedAt: null,
    pausedAt: null,
    resumedAt: null,
    completedAt: new Date(),
    customerSignatureUrl: null,
    customerSignedAt: null,
    cancellationReason: null,
    rescheduledFromId: null,
    opsStatus: "ready_for_billing",
    priority: "normal",
    dependsOnExecutionId: null,
    isEscalated: false,
    escalationReason: null,
    escalatedAt: null,
    escalatedBy: null,
    opsOwnerUserId: null,
    qualityReviewStartedAt: null,
    approvedAt: new Date(),
    approvedBy: 1,
    readyForBillingAt: new Date(),
    reopenedAt: null,
    reopenReason: null,
    opsCancelledAt: null,
    opsCancelReason: null,
    legacyBookingId: null,
    legacyDcmsVisitId: null,
    companyId: 1,
    franchiseeId: null,
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function contract(overrides: Partial<CustomerContract> = {}): CustomerContract {
  return {
    id: 2,
    customerId: 3,
    assetType: "vehicle",
    assetId: 1,
    serviceLocationId: null,
    registryAssetId: null,
    serviceId: 5,
    contractType: "one_time",
    catalogRefKind: null,
    catalogRefId: null,
    productLine: "one_time_service",
    sourceSystem: "booking",
    sourceId: 99,
    status: "active",
    validFrom: "2026-01-01",
    validUntil: "2026-12-31",
    summaryJson: { amount: "1500" },
    companyId: 1,
    franchiseeId: null,
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 10,
    invoiceNumber: "CWP/2026-27/1001",
    documentType: "tax_invoice",
    referenceInvoiceId: null,
    referenceInvoiceNumber: null,
    referenceInvoiceDate: null,
    customerId: 3,
    customerSnapshot: null,
    subscriptionId: null,
    bookingId: null,
    quotationId: null,
    contractRegistryId: 2,
    executionId: 1,
    serviceLocationId: null,
    assetId: null,
    serviceId: null,
    paymentTerms: "after_service",
    billingMode: "one_time",
    commercialStatus: "draft",
    commerciallyClosedAt: null,
    voidedAt: null,
    voidReason: null,
    entitlementConsumed: false,
    items: [],
    subtotal: "1000",
    tax: "0",
    gstAmount: "180",
    cgstAmount: "90",
    sgstAmount: "90",
    igstAmount: "0",
    discount: "0",
    roundOff: "0",
    totalAmount: "1180",
    paidAmount: "0",
    dueAmount: "1180",
    balanceDue: "1180",
    status: "draft",
    gstin: null,
    placeOfSupply: "Uttar Pradesh",
    supplyStateCode: "09",
    isInterState: false,
    hsnSummary: null,
    notes: null,
    terms: null,
    creditReason: null,
    currency: "INR",
    companyId: 1,
    franchiseeId: null,
    branchId: null,
    dueDate: null,
    issuedAt: null,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Phase 5.6 commercial validation", () => {
  it("allows ready_for_billing completed jobs", () => {
    expect(() => assertJobReadyForBilling(job())).not.toThrow();
  });

  it("rejects jobs not ready for billing", () => {
    expect(() => assertJobReadyForBilling(job({ opsStatus: "approved" }))).toThrow(/ready_for_billing/i);
    expect(() => assertJobReadyForBilling(job({ status: "started" }))).toThrow(/completed/i);
  });

  it("rejects expired or cancelled contracts", () => {
    expect(() => assertContractBillable(contract({ status: "cancelled" }))).toThrow(/cancelled/i);
    expect(() => assertContractBillable(contract({ status: "expired" }))).toThrow(/expired/i);
    expect(() => assertContractBillable(contract({
      validUntil: "2020-01-01",
      status: "active",
    }))).toThrow(/validity/i);
  });

  it("prevents duplicate job invoices", () => {
    expect(() => assertNoExistingJobInvoice(invoice())).toThrow(/already exists/i);
    expect(() => assertNoExistingJobInvoice(invoice({ status: "cancelled", commercialStatus: "voided" }))).not.toThrow();
    expect(() => assertNoExistingJobInvoice(null)).not.toThrow();
  });

  it("rejects negative totals", () => {
    expect(() => assertNonNegativeTotals(-1)).toThrow(CommercialValidationError);
    expect(() => assertNonNegativeTotals(100, -5)).toThrow(/negative/i);
    expect(() => assertNonNegativeTotals(0)).not.toThrow();
  });

  it("enforces issue / paid / void lifecycle", () => {
    expect(() => assertCanIssue(invoice())).not.toThrow();
    expect(() => assertCanIssue(invoice({ commercialStatus: "payment_pending", status: "sent" }))).toThrow(/draft/i);

    expect(() => assertCanMarkPaid(invoice({ commercialStatus: "payment_pending", status: "sent" }))).not.toThrow();
    expect(() => assertCanMarkPaid(invoice())).toThrow(/Issue/i);

    expect(() => assertCanVoid(invoice({ commercialStatus: "payment_pending", status: "sent" }))).not.toThrow();
    expect(() => assertCanVoid(invoice({ commercialStatus: "commercially_closed", status: "paid" }))).toThrow(/credit note/i);
  });

  it("authorizes admin billing actors only", () => {
    expect(() => assertAdminBillingActor("admin")).not.toThrow();
    expect(() => assertAdminBillingActor("manager")).not.toThrow();
    expect(() => assertAdminBillingActor("staff")).toThrow(/admin/i);
  });

  it("classifies subscription vs one-time modes", () => {
    expect(isSubscriptionVisitMode("dcms")).toBe(true);
    expect(isSubscriptionVisitMode("subscription")).toBe(true);
    expect(isSubscriptionVisitMode("entitlement")).toBe(true);
    expect(isOneTimeMode("booking")).toBe(true);
    expect(isOneTimeMode("dcms")).toBe(false);
  });
});

describe("Phase 5.6 billing domain events", () => {
  beforeEach(() => {
    billingDomainEventPublisher.clearSubscribers();
  });

  it("publishes InvoiceCreated / InvoiceIssued / CommercialClosed", () => {
    const seen: BillingDomainEvent["type"][] = [];
    billingDomainEventPublisher.subscribe((e) => { seen.push(e.type); });

    billingDomainEventPublisher.publish({
      ...baseBillingEventFields({ invoiceId: 1, customerId: 3, executionId: 9 }),
      type: "InvoiceCreated",
    });
    billingDomainEventPublisher.publish({
      ...baseBillingEventFields({ invoiceId: 1, customerId: 3 }),
      type: "InvoiceIssued",
    });
    billingDomainEventPublisher.publish({
      ...baseBillingEventFields({ invoiceId: 1, customerId: 3 }),
      type: "CommercialClosed",
    });

    expect(seen).toEqual(["InvoiceCreated", "InvoiceIssued", "CommercialClosed"]);
  });
});
