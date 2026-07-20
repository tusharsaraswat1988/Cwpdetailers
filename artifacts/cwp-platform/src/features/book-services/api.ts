import { buildRequestNotes, resolveSolarServicePrice, type BookServicesDraft } from "./types";

export type FulfillmentMode = "one_time" | "contract_recurring" | "contract_credits";

export type ServiceContractResult = {
  contractType: FulfillmentMode;
  registryId: number;
  sourceSystem: "booking" | "dcms" | "entitlement" | "subscription";
  sourceId: number;
  bookingId?: number;
  productLine: string;
  label: string;
  status: string;
  validFrom: string | null;
  validUntil: string | null;
};

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

/** Client-side fulfillment hint (server resolves authoritatively). */
export function resolveFulfillmentHint(draft: BookServicesDraft): { mode: FulfillmentMode; label: string } {
  const service = draft.service;
  if (!service) return { mode: "one_time", label: "Service" };

  if (service.kind === "service") {
    return {
      mode: "one_time",
      label: draft.asset?.assetType === "solar_site" ? "One-time solar job" : "One-time service job",
    };
  }
  if (service.kind === "plan") {
    return { mode: "contract_recurring", label: "Daily cleaning plan" };
  }
  if (draft.asset?.assetType === "solar_site") {
    return { mode: "contract_recurring", label: "Solar AMC plan" };
  }
  return { mode: "contract_credits", label: "Wash package" };
}

export function fulfillmentLabel(mode: FulfillmentMode): string {
  switch (mode) {
    case "one_time": return "One-time job";
    case "contract_recurring": return "Monthly plan";
    case "contract_credits": return "Wash package";
    default: return mode;
  }
}

export function draftToContractPayload(
  draft: BookServicesDraft,
  addons: Array<{ id: number; basePrice: string }>,
) {
  const servicePrice = draft.asset?.assetType === "solar_site"
    ? resolveSolarServicePrice(draft)
    : (draft.service?.price ?? 0);
  const addonTotal = draft.addonIds.reduce((sum, id) => {
    const a = addons.find(x => x.id === id);
    return sum + (a ? parseFloat(a.basePrice) || 0 : 0);
  }, 0);
  let estimatedAmount = servicePrice + addonTotal;
  if (draft.discountType === "percent" && draft.discountValue) {
    const pct = Math.min(100, Math.max(0, parseFloat(draft.discountValue) || 0));
    estimatedAmount = Math.max(0, estimatedAmount - (estimatedAmount * pct) / 100);
  } else if (draft.discountType === "flat" && draft.discountValue) {
    estimatedAmount = Math.max(0, estimatedAmount - (parseFloat(draft.discountValue) || 0));
  }

  return {
    customerId: draft.customer!.id,
    serviceLocationId: draft.location!.id,
    assetId: draft.asset!.id,
    selectionKind: draft.service!.kind,
    selectionId: draft.service!.id,
    catalogServiceId: draft.service!.kind === "service"
      ? (draft.service!.catalogServiceId ?? draft.service!.id)
      : undefined,
    addonIds: draft.addonIds,
    discountType: draft.discountType,
    discountValue: draft.discountValue || undefined,
    paymentTerms: draft.paymentTerms,
    partialAdvancePercent: draft.partialAdvancePercent || undefined,
    estimatedAmount,
    notes: buildRequestNotes(draft),
  };
}

async function contractFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function createServiceContract(
  draft: BookServicesDraft,
  addons: Array<{ id: number; basePrice: string }>,
): Promise<ServiceContractResult> {
  return contractFetch<ServiceContractResult>("/service-contracts", {
    method: "POST",
    body: JSON.stringify(draftToContractPayload(draft, addons)),
  });
}

export async function getServiceContract(registryId: number) {
  return contractFetch<Record<string, unknown>>(`/service-contracts/${registryId}`);
}

export async function createContractQuotation(registryId: number): Promise<ContractBillingResult> {
  return contractFetch<ContractBillingResult>(`/service-contracts/${registryId}/quotation`, {
    method: "POST",
  });
}

export async function createContractInvoice(registryId: number): Promise<ContractBillingResult> {
  return contractFetch<ContractBillingResult>(`/service-contracts/${registryId}/invoice`, {
    method: "POST",
  });
}

export async function createContractBilling(
  registryId: number,
  action: import("./types").BillingActionChoice,
): Promise<ContractBillingResult> {
  return action === "invoice"
    ? createContractInvoice(registryId)
    : createContractQuotation(registryId);
}
