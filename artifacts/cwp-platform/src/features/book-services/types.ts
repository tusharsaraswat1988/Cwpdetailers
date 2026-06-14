import type { CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import type { CustomerServiceLocationRow } from "@/features/service-locations/api";
import type { AssetListRow } from "@/features/assets/api";
import type { ServiceAddon } from "@/features/service-catalog/api";

export type BookServiceKind = "service" | "package" | "plan";

export type SelectedBookService = {
  kind: BookServiceKind;
  id: number;
  name: string;
  price: number;
  /** Catalog service id when kind is service (for add-ons / pricing quote) */
  catalogServiceId?: number;
};

export type PaymentTermsChoice = "full_advance" | "partial_advance" | "after_service";

export type BillingActionChoice = "quotation" | "invoice";

export type BookServicesDraft = {
  customer: CustomerSearchValue | null;
  location: CustomerServiceLocationRow | null;
  asset: AssetListRow | null;
  service: SelectedBookService | null;
  addonIds: number[];
  discountType: "none" | "percent" | "flat";
  discountValue: string;
  paymentTerms: PaymentTermsChoice;
  partialAdvancePercent: string;
  billingAction: BillingActionChoice;
};

export const EMPTY_BOOK_SERVICES_DRAFT: BookServicesDraft = {
  customer: null,
  location: null,
  asset: null,
  service: null,
  addonIds: [],
  discountType: "none",
  discountValue: "",
  paymentTerms: "after_service",
  partialAdvancePercent: "50",
  billingAction: "quotation",
};

export const WIZARD_STEPS = [
  { id: "customer", label: "Customer", short: "1" },
  { id: "location", label: "Service Location", short: "2" },
  { id: "asset", label: "Asset", short: "3" },
  { id: "service", label: "Service", short: "4" },
  { id: "addons", label: "Add-ons", short: "5" },
  { id: "discount", label: "Discount", short: "6" },
  { id: "payment", label: "Payment Terms", short: "7" },
  { id: "review", label: "Review", short: "8" },
] as const;

export type WizardStepId = typeof WIZARD_STEPS[number]["id"];

export type AddonOption = ServiceAddon;

export function paymentTermsLabel(terms: PaymentTermsChoice): string {
  switch (terms) {
    case "full_advance": return "Full payment in advance";
    case "partial_advance": return "Partial advance, balance after service";
    case "after_service": return "Payment after service completion";
    default: return terms;
  }
}

export function billingActionLabel(action: BillingActionChoice): string {
  switch (action) {
    case "quotation": return "Create quotation (await approval)";
    case "invoice": return "Create invoice directly";
    default: return action;
  }
}

export function computeDraftTotals(
  draft: BookServicesDraft,
  addons: AddonOption[],
): { subtotal: number; discountAmount: number; estimatedTotal: number } {
  const servicePrice = draft.service?.price ?? 0;
  const addonTotal = draft.addonIds.reduce((sum, id) => {
    const a = addons.find(x => x.id === id);
    return sum + (a ? parseFloat(a.basePrice) || 0 : 0);
  }, 0);
  const subtotal = servicePrice + addonTotal;
  let discountAmount = 0;
  if (draft.discountType === "percent" && draft.discountValue) {
    const pct = Math.min(100, Math.max(0, parseFloat(draft.discountValue) || 0));
    discountAmount = (subtotal * pct) / 100;
  } else if (draft.discountType === "flat" && draft.discountValue) {
    discountAmount = Math.min(subtotal, Math.max(0, parseFloat(draft.discountValue) || 0));
  }
  return {
    subtotal,
    discountAmount,
    estimatedTotal: Math.max(0, subtotal - discountAmount),
  };
}

export function validateStep(step: WizardStepId, draft: BookServicesDraft): string | null {
  switch (step) {
    case "customer":
      return draft.customer ? null : "Select a customer to continue.";
    case "location":
      return draft.location ? null : "Select a service location to continue.";
    case "asset":
      return draft.asset ? null : "Select an asset at this location to continue.";
    case "service":
      return draft.service ? null : "Select a service, plan, or package to continue.";
    case "addons":
      return null;
    case "discount":
      if (draft.discountType === "percent" && draft.discountValue) {
        const pct = parseFloat(draft.discountValue);
        if (Number.isNaN(pct) || pct < 0 || pct > 100) return "Enter a discount between 0 and 100%.";
      }
      if (draft.discountType === "flat" && draft.discountValue) {
        const flat = parseFloat(draft.discountValue);
        if (Number.isNaN(flat) || flat < 0) return "Enter a valid discount amount.";
      }
      return null;
    case "payment":
      if (draft.paymentTerms === "partial_advance") {
        const pct = parseFloat(draft.partialAdvancePercent);
        if (Number.isNaN(pct) || pct <= 0 || pct >= 100) return "Enter advance percentage between 1 and 99.";
      }
      return null;
    case "review":
      return null;
    default:
      return null;
  }
}

export function canProceedToStep(targetIndex: number, draft: BookServicesDraft): boolean {
  for (let i = 0; i < targetIndex; i++) {
    const stepId = WIZARD_STEPS[i]!.id;
    if (validateStep(stepId, draft)) return false;
  }
  return true;
}
