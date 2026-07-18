/**
 * Phase 5.6 — Billing & Commercial Closure public exports.
 * Existing invoice/GST/contract billing remain available via their modules.
 */

export {
  listReadyForBillingQueue,
  previewJobInvoice,
  generateJobInvoice,
  issueInvoice,
  markInvoicePaid,
  voidInvoice,
  createCommercialCreditNote,
  listCommercialInvoices,
  getCommercialInvoiceDetail,
  type CommercialCalculation,
  type ReadyForBillingRow,
} from "./commercialClosureService";

export {
  CommercialValidationError,
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

export {
  billingDomainEventPublisher,
  baseBillingEventFields,
  type BillingDomainEvent,
  type BillingDomainEventType,
} from "./commercialDomainEvents";

export {
  recordCommercialTimeline,
  getCommercialTimeline,
  getInvoiceCommercialHistory,
  getMergedCommercialHistory,
} from "./commercialTimeline";
