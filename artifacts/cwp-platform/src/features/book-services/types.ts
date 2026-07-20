import type { CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import type { CustomerServiceLocationRow } from "@/features/service-locations/api";
import type { AssetListRow } from "@/features/assets/api";
import type { ServiceAddon } from "@/features/service-catalog/api";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_OPTIONS,
  type LeadSource,
} from "@/features/leads/constants";

export type BookServiceKind = "service" | "package" | "plan";

export type SelectedBookService = {
  kind: BookServiceKind;
  id: number;
  name: string;
  price: number;
  /** Catalog service id when kind is service (for add-ons / pricing quote) */
  catalogServiceId?: number;
  /** Solar rate-card term when applicable */
  solarTerm?: "one_time" | "amc_6" | "amc_12";
};

export type SolarPricingStatus = "idle" | "loading" | "priced" | "needs_site_visit" | "no_slab" | "manual";

export type PaymentTermsChoice = "full_advance" | "partial_advance" | "after_service";

export type BillingActionChoice = "quotation" | "invoice";

/** How the request entered the desk — same values as Postgres `lead_source`. */
export type RequestSource = LeadSource;

export const REQUEST_SOURCE_OPTIONS = LEAD_SOURCE_OPTIONS;

export type BookServicesDraft = {
  customer: CustomerSearchValue | null;
  requestSource: RequestSource;
  requestNotes: string;
  location: CustomerServiceLocationRow | null;
  asset: AssetListRow | null;
  service: SelectedBookService | null;
  addonIds: number[];
  discountType: "none" | "percent" | "flat";
  discountValue: string;
  paymentTerms: PaymentTermsChoice;
  partialAdvancePercent: string;
  billingAction: BillingActionChoice;
  /** Panel count from solar site (loaded when asset selected). */
  solarPanelCount: number | null;
  solarPricingStatus: SolarPricingStatus;
  /** Pre-GST subtotal from rate card (exclusive GST added at billing). */
  solarQuotedSubtotal: number | null;
  solarPricePerPanel: number | null;
  solarMinimumBilling: number | null;
  /** Advisor override after site visit. */
  solarManualAmount: string;
  solarCallbackLeadId: number | null;
};

export const EMPTY_BOOK_SERVICES_DRAFT: BookServicesDraft = {
  customer: null,
  requestSource: "walk_in",
  requestNotes: "",
  location: null,
  asset: null,
  service: null,
  addonIds: [],
  discountType: "none",
  discountValue: "",
  paymentTerms: "after_service",
  partialAdvancePercent: "50",
  billingAction: "quotation",
  solarPanelCount: null,
  solarPricingStatus: "idle",
  solarQuotedSubtotal: null,
  solarPricePerPanel: null,
  solarMinimumBilling: null,
  solarManualAmount: "",
  solarCallbackLeadId: null,
};

/**
 * Service Advisor workflow:
 * Who → What needs service → Where → What to sell → Pricing → Confirm request
 */
export const WIZARD_STEPS = [
  { id: "customer", label: "Customer", short: "1", question: "Who is requesting service?" },
  { id: "asset", label: "Asset", short: "2", question: "What needs service today?" },
  { id: "location", label: "Location", short: "3", question: "Where should CWP perform this service?" },
  { id: "service", label: "Service", short: "4", question: "What would the customer like today?" },
  { id: "pricing", label: "Pricing", short: "5", question: "What are we selling?" },
  { id: "review", label: "Review", short: "6", question: "Ready to create this service request?" },
] as const;

export type WizardStepId = typeof WIZARD_STEPS[number]["id"];

export type AddonOption = ServiceAddon;

export function requestSourceLabel(source: RequestSource): string {
  return LEAD_SOURCE_LABELS[source] ?? source;
}

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

export function buildRequestNotes(draft: BookServicesDraft): string | undefined {
  const parts: string[] = [];
  parts.push(`Source: ${requestSourceLabel(draft.requestSource)}`);
  if (draft.requestNotes.trim()) parts.push(draft.requestNotes.trim());
  return parts.length ? parts.join("\n") : undefined;
}

export function resolveSolarServicePrice(draft: BookServicesDraft): number {
  if (draft.solarPricingStatus === "manual" || draft.solarPricingStatus === "needs_site_visit") {
    const manual = parseFloat(draft.solarManualAmount);
    if (Number.isFinite(manual) && manual >= 0) return manual;
  }
  if (draft.solarQuotedSubtotal != null) return draft.solarQuotedSubtotal;
  return draft.service?.price ?? 0;
}

export function computeDraftTotals(
  draft: BookServicesDraft,
  addons: AddonOption[],
): { subtotal: number; discountAmount: number; estimatedTotal: number } {
  const isSolar = draft.asset?.assetType === "solar_site";
  const servicePrice = isSolar ? resolveSolarServicePrice(draft) : (draft.service?.price ?? 0);
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
      return draft.customer ? null : "Select or create a customer to continue.";
    case "asset":
      return draft.asset ? null : "Select or register what needs service to continue.";
    case "location":
      return draft.location ? null : "Choose where CWP should perform this service.";
    case "service":
      return draft.service ? null : "Select a service, plan, or package to continue.";
    case "pricing":
      if (draft.asset?.assetType === "solar_site") {
        if (draft.solarPricingStatus === "needs_site_visit" || draft.solarPricingStatus === "no_slab" || draft.solarPricingStatus === "manual") {
          const manual = parseFloat(draft.solarManualAmount);
          if (!Number.isFinite(manual) || manual <= 0) {
            return draft.solarPricingStatus === "needs_site_visit"
              ? "Large site: request callback, then enter the finalized amount after site visit."
              : "Enter a finalized amount (no matching rate-card slab, or manual override).";
          }
        }
      }
      if (draft.discountType === "percent" && draft.discountValue) {
        const pct = parseFloat(draft.discountValue);
        if (Number.isNaN(pct) || pct < 0 || pct > 100) return "Enter a discount between 0 and 100%.";
      }
      if (draft.discountType === "flat" && draft.discountValue) {
        const flat = parseFloat(draft.discountValue);
        if (Number.isNaN(flat) || flat < 0) return "Enter a valid discount amount.";
      }
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
