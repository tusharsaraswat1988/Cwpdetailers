export const BILLING_TABS = [
  "invoices",
  "payments",
  "quotations",
  "expenses",
  "dues",
  "wallet-adjustments",
] as const;

export type BillingTab = typeof BILLING_TABS[number];

export function billingTabFromSearch(search: string): BillingTab {
  const tab = new URLSearchParams(search).get("tab");
  if (BILLING_TABS.includes(tab as BillingTab)) return tab as BillingTab;
  return "invoices";
}

export function isValidBillingTab(tab: string | null): tab is BillingTab {
  return !!tab && BILLING_TABS.includes(tab as BillingTab);
}

export const BILLING_TAB_LABELS: Record<BillingTab, string> = {
  invoices: "Invoices",
  payments: "Payments",
  quotations: "Quotations",
  expenses: "Expenses",
  dues: "Dues",
  "wallet-adjustments": "Wallet Adjustments",
};
