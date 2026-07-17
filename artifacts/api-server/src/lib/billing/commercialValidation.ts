/**
 * Phase 5.6 — Commercial validation rules.
 * Billing owns commercial closure; does not mutate Job Orchestration.
 */

import type { CustomerContract, Invoice, ServiceExecution } from "@workspace/db";

export class CommercialValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_READY"
      | "ALREADY_BILLED"
      | "CONTRACT_INVALID"
      | "ENTITLEMENT_UNAVAILABLE"
      | "NEGATIVE_TOTAL"
      | "INVALID_STATE"
      | "UNAUTHORIZED"
      | "NOT_FOUND",
  ) {
    super(message);
    this.name = "CommercialValidationError";
  }
}

export function assertAdminBillingActor(role: string | undefined | null): void {
  const allowed = new Set(["admin", "superadmin", "manager", "franchisee"]);
  if (!role || !allowed.has(role)) {
    throw new CommercialValidationError("Billing actions require admin or manager role", "UNAUTHORIZED");
  }
}

export function assertJobReadyForBilling(job: ServiceExecution): void {
  if (job.opsStatus !== "ready_for_billing") {
    throw new CommercialValidationError(
      "Job must be ready_for_billing before commercial billing",
      "NOT_READY",
    );
  }
  if (job.status !== "completed") {
    throw new CommercialValidationError(
      "Job field status must be completed before billing",
      "NOT_READY",
    );
  }
}

export function assertContractBillable(contract: CustomerContract): void {
  if (contract.status === "cancelled") {
    throw new CommercialValidationError("Contract is cancelled — cannot bill", "CONTRACT_INVALID");
  }
  if (contract.status === "expired") {
    throw new CommercialValidationError("Contract is expired — cannot bill", "CONTRACT_INVALID");
  }
  if (contract.validUntil) {
    const today = new Date().toISOString().slice(0, 10);
    if (contract.validUntil < today && contract.status !== "completed") {
      throw new CommercialValidationError("Contract validity has ended — cannot bill", "CONTRACT_INVALID");
    }
  }
}

export function assertNoExistingJobInvoice(existing: Invoice | null | undefined): void {
  if (existing && existing.status !== "cancelled" && existing.commercialStatus !== "voided") {
    throw new CommercialValidationError(
      `Invoice ${existing.invoiceNumber} already exists for this job`,
      "ALREADY_BILLED",
    );
  }
}

export function assertNonNegativeTotals(totalAmount: number, discount = 0): void {
  if (totalAmount < 0 || discount < 0) {
    throw new CommercialValidationError("Invoice totals cannot be negative", "NEGATIVE_TOTAL");
  }
}

export function assertCanIssue(invoice: Invoice): void {
  if (invoice.documentType !== "tax_invoice") {
    throw new CommercialValidationError("Only tax invoices can be issued", "INVALID_STATE");
  }
  if (invoice.commercialStatus === "voided" || invoice.status === "cancelled") {
    throw new CommercialValidationError("Cannot issue a voided invoice", "INVALID_STATE");
  }
  if (invoice.commercialStatus !== "draft" && invoice.status !== "draft") {
    throw new CommercialValidationError("Only draft invoices can be issued", "INVALID_STATE");
  }
}

export function assertCanMarkPaid(invoice: Invoice): void {
  if (invoice.documentType !== "tax_invoice") {
    throw new CommercialValidationError("Only tax invoices can be marked paid", "INVALID_STATE");
  }
  if (invoice.commercialStatus === "voided" || invoice.status === "cancelled") {
    throw new CommercialValidationError("Cannot mark a voided invoice as paid", "INVALID_STATE");
  }
  if (invoice.commercialStatus === "draft" || invoice.status === "draft") {
    throw new CommercialValidationError("Issue the invoice before marking paid", "INVALID_STATE");
  }
  if (invoice.commercialStatus === "commercially_closed") {
    throw new CommercialValidationError("Invoice is already commercially closed", "INVALID_STATE");
  }
}

export function assertCanVoid(invoice: Invoice): void {
  if (invoice.documentType !== "tax_invoice") {
    throw new CommercialValidationError("Only tax invoices can be voided here", "INVALID_STATE");
  }
  if (invoice.commercialStatus === "voided" || invoice.status === "cancelled") {
    throw new CommercialValidationError("Invoice is already voided", "INVALID_STATE");
  }
  if (invoice.commercialStatus === "commercially_closed") {
    throw new CommercialValidationError("Cannot void a commercially closed invoice — use credit note", "INVALID_STATE");
  }
}

export function isSubscriptionVisitMode(sourceSystem: CustomerContract["sourceSystem"]): boolean {
  return sourceSystem === "dcms" || sourceSystem === "subscription" || sourceSystem === "entitlement";
}

export function isOneTimeMode(sourceSystem: CustomerContract["sourceSystem"]): boolean {
  return sourceSystem === "booking";
}
