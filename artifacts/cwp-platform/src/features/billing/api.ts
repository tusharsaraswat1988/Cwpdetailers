import type { InvoiceBillingSettings } from "./types";

export const INVOICE_BILLING_QUERY_KEY = ["invoice-billing-settings"];

export type InvoiceBillingSettingsResponse = {
  settings: InvoiceBillingSettings;
  serviceCategoryTerms: Record<string, string[]>;
};

export async function fetchInvoiceBillingSettings(): Promise<InvoiceBillingSettingsResponse> {
  const res = await fetch("/api/invoices/billing-settings", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load invoice settings");
  return res.json();
}

export async function saveInvoiceBillingSettings(
  patch: Partial<InvoiceBillingSettings>,
): Promise<InvoiceBillingSettings> {
  const res = await fetch("/api/invoices/billing-settings", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to save");
  }
  const data = await res.json();
  return data.settings;
}

export type { InvoiceBillingSettings };
