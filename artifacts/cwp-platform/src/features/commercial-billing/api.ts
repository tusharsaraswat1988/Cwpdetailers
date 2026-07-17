/**
 * Phase 5.6 — Commercial Closure API client.
 * PDF reuses existing GET /api/invoices/:id/pdf.
 */

export type InvoiceBillingMode =
  | "subscription_visit"
  | "one_time"
  | "prepaid_fulfillment"
  | "manual";

export type InvoiceCommercialStatus =
  | "draft"
  | "issued"
  | "payment_pending"
  | "paid"
  | "commercially_closed"
  | "voided";

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

export type CommercialLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstInclusive: boolean;
  serviceCategory: string;
  sac: string;
  isComplimentary?: boolean;
};

export type CommercialPreview = {
  jobId: number;
  executionId: number;
  contractId: number;
  customerId: number;
  customerName: string | null;
  billingMode: InvoiceBillingMode;
  pricingSource: string;
  paymentTerms: string;
  lines: CommercialLine[];
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
  existingInvoiceId: number | null;
  existingInvoiceNumber: string | null;
  notes: string;
};

export type CommercialInvoice = {
  id: number;
  invoiceNumber: string;
  customerId: number;
  executionId: number | null;
  contractRegistryId: number | null;
  billingMode: InvoiceBillingMode | null;
  commercialStatus: InvoiceCommercialStatus;
  status: string;
  totalAmount: string;
  balanceDue: string;
  paidAmount: string;
  discount: string;
  gstAmount: string;
  subtotal: string;
  items: unknown[];
  notes: string | null;
  voidReason: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  commerciallyClosedAt: string | null;
  /** Present on the raw row returned by GET /billing/commercial and /billing/invoices/:id — not previously typed here. */
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialTimelineEntry = {
  id: number;
  invoiceId: number | null;
  executionId: number | null;
  eventType: string;
  title: string;
  description: string | null;
  actorName: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const COMMERCIAL_BILLING_QUERY_KEY = ["commercial-billing"] as const;

export async function fetchReadyForBilling(limit = 50, offset = 0) {
  return api<{ items: ReadyForBillingRow[]; total: number }>(
    `/api/billing/ready-for-billing?limit=${limit}&offset=${offset}`,
  );
}

export async function previewJobInvoice(jobId: number) {
  return api<CommercialPreview>(`/api/billing/jobs/${jobId}/preview`);
}

export async function generateJobInvoice(jobId: number) {
  return api<CommercialInvoice>(`/api/billing/jobs/${jobId}/generate`, { method: "POST", body: "{}" });
}

export async function fetchCommercialInvoices(
  status: InvoiceCommercialStatus | "outstanding" | "all" = "all",
  limit = 50,
  offset = 0,
) {
  return api<{ items: CommercialInvoice[]; total: number }>(
    `/api/billing/commercial?status=${status}&limit=${limit}&offset=${offset}`,
  );
}

export async function fetchCommercialInvoiceDetail(id: number) {
  return api<{ invoice: CommercialInvoice; timeline: CommercialTimelineEntry[] }>(
    `/api/billing/invoices/${id}`,
  );
}

export async function issueCommercialInvoice(id: number) {
  return api<CommercialInvoice>(`/api/billing/invoices/${id}/issue`, { method: "POST", body: "{}" });
}

export async function markCommercialInvoicePaid(
  id: number,
  body?: { amount?: number; method?: string; notes?: string },
) {
  return api<CommercialInvoice>(`/api/billing/invoices/${id}/mark-paid`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function voidCommercialInvoice(id: number, reason?: string) {
  return api<CommercialInvoice>(`/api/billing/invoices/${id}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function invoicePdfUrl(id: number) {
  return `/api/invoices/${id}/pdf`;
}

export function commercialStatusLabel(status: InvoiceCommercialStatus | null | undefined): string {
  switch (status) {
    case "draft": return "Draft";
    case "issued": return "Issued";
    case "payment_pending": return "Payment pending";
    case "paid": return "Paid";
    case "commercially_closed": return "Commercially closed";
    case "voided": return "Voided";
    default: return "—";
  }
}

export function billingModeLabel(mode: InvoiceBillingMode | null | undefined): string {
  switch (mode) {
    case "subscription_visit": return "Subscription visit";
    case "one_time": return "One-time";
    case "prepaid_fulfillment": return "Prepaid fulfillment";
    case "manual": return "Manual";
    default: return "—";
  }
}

/**
 * Payment-progression stages for the visual stepper (Draft → Issued →
 * Outstanding → Paid → Closed). `voided` is shown as a standalone badge
 * instead of a stage index — see CommercialOperationsCenter.
 */
export const PAYMENT_STAGES = ["draft", "issued", "outstanding", "paid", "closed"] as const;
export type PaymentStage = typeof PAYMENT_STAGES[number];

export function paymentStageIndex(status: InvoiceCommercialStatus | null | undefined): number {
  switch (status) {
    case "draft": return 0;
    case "issued": return 1;
    case "payment_pending": return 2;
    case "paid": return 3;
    case "commercially_closed": return 4;
    default: return -1;
  }
}
