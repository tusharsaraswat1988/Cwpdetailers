import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalogAddons, useCatalogPricingQuote } from "@/features/service-catalog/api";
import type { CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import type { CustomerServiceLocationRow } from "@/features/service-locations/api";
import { getAsset, type AssetListRow } from "@/features/assets/api";
import { useQuery } from "@tanstack/react-query";
import { LEAD_SOURCES, type LeadSource } from "@/features/leads/constants";
import {
  EMPTY_BOOK_SERVICES_DRAFT,
  WIZARD_STEPS,
  type BookServicesDraft,
  type SelectedBookService,
  validateStep,
  canProceedToStep,
} from "../types";
import { createServiceContract, createContractBilling, type ServiceContractResult, type ContractBillingResult } from "../api";
import { getApiErrorMessage } from "@/lib/apiError";
import { CustomerSelect } from "./CustomerSelect";
import { LocationSelect } from "./LocationSelect";
import { AssetSelect } from "./AssetSelect";
import { ServiceSelect } from "./ServiceSelect";
import { PricingStep } from "./PricingStep";
import { ReviewSummaryStep } from "./ReviewSummaryStep";
import { ContractCreatedStep } from "./ContractCreatedStep";

type Props = {
  initialCustomer?: CustomerSearchValue | null;
};

const DRAFT_STORAGE_KEY = "cwp:book-services:draft";

function normalizeRequestSource(raw: unknown): LeadSource {
  if (typeof raw === "string" && (LEAD_SOURCES as readonly string[]).includes(raw)) {
    return raw as LeadSource;
  }
  // Migrate older draft values that are not `lead_source` enum members.
  if (raw === "phone") return "call";
  return "walk_in";
}

function loadSavedDraft(): { draft: BookServicesDraft; stepIndex: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.draft) return null;
    // Migrate older drafts that used the previous step set.
    const draft: BookServicesDraft = {
      ...EMPTY_BOOK_SERVICES_DRAFT,
      ...parsed.draft,
      requestSource: normalizeRequestSource(parsed.draft.requestSource),
      requestNotes: parsed.draft.requestNotes ?? "",
    };
    const maxIndex = WIZARD_STEPS.length - 1;
    const stepIndex = Math.min(typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0, maxIndex);
    return { draft, stepIndex };
  } catch {
    return null;
  }
}

export function BookServicesWizard({ initialCustomer = null }: Props) {
  const qc = useQueryClient();
  const reactivateCustomer = useUpdateCustomer();
  const saved = useMemo(() => (initialCustomer ? null : loadSavedDraft()), [initialCustomer]);
  const [stepIndex, setStepIndex] = useState(() => saved?.stepIndex ?? (initialCustomer ? 1 : 0));
  const [draft, setDraft] = useState<BookServicesDraft>(() => saved?.draft ?? {
    ...EMPTY_BOOK_SERVICES_DRAFT,
    customer: initialCustomer,
    requestSource: "walk_in",
  });
  const [restoredNotice, setRestoredNotice] = useState(!!saved?.draft?.customer);
  const [stepError, setStepError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [contractResult, setContractResult] = useState<ServiceContractResult | null>(null);
  const [billingResult, setBillingResult] = useState<ContractBillingResult | null>(null);

  useEffect(() => {
    if (contractResult) return;
    try {
      if (draft.customer) {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ draft, stepIndex }));
      } else {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      // storage unavailable — autosave is best-effort
    }
  }, [draft, stepIndex, contractResult]);

  useEffect(() => {
    if (!draft.customer || contractResult) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draft.customer, contractResult]);

  const catalogServiceId = draft.service?.kind === "service"
    ? draft.service.catalogServiceId ?? draft.service.id
    : undefined;
  const { data: addonList = [] } = useCatalogAddons(catalogServiceId);

  const isSolarAsset = draft.asset?.assetType === "solar_site";
  const { data: solarAssetDetail } = useQuery({
    queryKey: ["asset-detail", draft.asset?.id],
    queryFn: () => getAsset(draft.asset!.id),
    enabled: isSolarAsset && draft.asset?.id != null,
  });

  useEffect(() => {
    if (!isSolarAsset) {
      if (draft.solarPanelCount != null || draft.solarPricingStatus !== "idle") {
        setDraft(prev => ({
          ...prev,
          solarPanelCount: null,
          solarPricingStatus: "idle",
          solarQuotedSubtotal: null,
          solarPricePerPanel: null,
          solarMinimumBilling: null,
          solarManualAmount: "",
          solarCallbackLeadId: null,
        }));
      }
      return;
    }
    // Prefer list row panelCount (fast), then detail fetch
    const fromList = draft.asset?.panelCount;
    const fromDetail = Number((solarAssetDetail?.solarSite as { panelCount?: number } | null | undefined)?.panelCount);
    const panels = (fromList != null && fromList > 0)
      ? fromList
      : (Number.isFinite(fromDetail) && fromDetail > 0 ? fromDetail : null);
    if (panels != null && panels !== draft.solarPanelCount) {
      setDraft(prev => ({ ...prev, solarPanelCount: panels }));
    }
  }, [isSolarAsset, draft.asset?.panelCount, solarAssetDetail, draft.solarPanelCount, draft.solarPricingStatus]);

  const solarQuoteEnabled = isSolarAsset
    && draft.service != null
    && draft.solarPanelCount != null
    && draft.solarPanelCount > 0
    && !draft.solarManualAmount.trim();

  const { data: solarQuote, isFetching: solarQuoteLoading } = useCatalogPricingQuote({
    serviceId: draft.service?.kind === "service" ? catalogServiceId : undefined,
    packageId: draft.service?.kind === "package" ? draft.service.id : undefined,
    panelCount: draft.solarPanelCount ?? undefined,
    term: draft.service?.solarTerm,
    enabled: solarQuoteEnabled,
  });

  useEffect(() => {
    if (!isSolarAsset || !draft.service) return;
    if (draft.solarManualAmount.trim()) return;
    if (solarQuoteLoading) {
      setDraft(prev => (prev.solarPricingStatus === "loading" ? prev : { ...prev, solarPricingStatus: "loading" }));
      return;
    }
    if (!solarQuote) return;

    const subtotal = solarQuote.breakdown?.baseAmount
      ?? solarQuote.solar?.amount
      ?? null;

    if (solarQuote.status === "needs_site_visit") {
      setDraft(prev => {
        if (prev.solarPricingStatus === "needs_site_visit") return prev;
        return {
          ...prev,
          solarPricingStatus: "needs_site_visit",
          solarQuotedSubtotal: null,
          solarPricePerPanel: solarQuote.solar?.pricePerPanel ?? null,
          solarMinimumBilling: solarQuote.solar?.minimumBilling ?? null,
          service: prev.service ? { ...prev.service, price: 0 } : prev.service,
        };
      });
      return;
    }

    if (solarQuote.status === "priced" && subtotal != null) {
      setDraft(prev => {
        if (
          prev.solarPricingStatus === "priced"
          && prev.solarQuotedSubtotal === subtotal
          && prev.service?.price === subtotal
        ) return prev;
        return {
          ...prev,
          solarPricingStatus: "priced",
          solarQuotedSubtotal: subtotal,
          solarPricePerPanel: solarQuote.solar?.pricePerPanel ?? null,
          solarMinimumBilling: solarQuote.solar?.minimumBilling ?? null,
          service: prev.service ? { ...prev.service, price: subtotal } : prev.service,
        };
      });
      return;
    }

    if (solarQuote.status === "no_slab") {
      setDraft(prev => {
        if (prev.solarPricingStatus === "no_slab") return prev;
        return {
          ...prev,
          solarPricingStatus: "no_slab",
          solarQuotedSubtotal: null,
          service: prev.service ? { ...prev.service, price: 0 } : prev.service,
        };
      });
    }
  }, [isSolarAsset, draft.service?.id, draft.service?.kind, draft.solarManualAmount, solarQuote, solarQuoteLoading]);

  const currentStep = WIZARD_STEPS[stepIndex]!;
  const isReview = currentStep.id === "review";
  const isLastNavigable = stepIndex === WIZARD_STEPS.length - 1;

  const patchDraft = useCallback((patch: Partial<BookServicesDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    setStepError(null);
  }, []);

  useEffect(() => {
    if (initialCustomer) {
      setDraft(prev => ({
        ...prev,
        customer: initialCustomer,
      }));
      setStepIndex(prev => (prev === 0 ? 1 : prev));
    }
  }, [initialCustomer?.id, initialCustomer?.name, initialCustomer?.phone]);

  const handleCustomerChange = useCallback((customer: CustomerSearchValue | null) => {
    setDraft(prev => ({
      ...EMPTY_BOOK_SERVICES_DRAFT,
      customer,
      requestSource: prev.requestSource,
      requestNotes: customer ? prev.requestNotes : "",
      paymentTerms: prev.paymentTerms,
      partialAdvancePercent: prev.partialAdvancePercent,
    }));
    setStepError(null);
  }, []);

  const handleAssetChange = useCallback((asset: AssetListRow | null) => {
    setDraft(prev => ({
      ...prev,
      asset,
      // Clear location unless it still matches the asset's registered site.
      location: asset?.serviceLocationId && prev.location?.id === asset.serviceLocationId
        ? prev.location
        : null,
      service: null,
      addonIds: [],
    }));
    setStepError(null);
  }, []);

  const handleLocationChange = useCallback((location: CustomerServiceLocationRow | null) => {
    setDraft(prev => ({
      ...prev,
      location,
      // Keep asset; location is where we perform service, not necessarily asset registration site.
    }));
    setStepError(null);
  }, []);

  const handleServiceChange = useCallback((service: SelectedBookService | null) => {
    setDraft(prev => ({
      ...prev,
      service,
      addonIds: [],
    }));
    setStepError(null);
  }, []);

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= WIZARD_STEPS.length) return;
    if (!canProceedToStep(index, draft)) {
      setStepError("Complete earlier steps before jumping ahead.");
      return;
    }
    setStepIndex(index);
    setStepError(null);
  }, [draft]);

  const goNext = useCallback(() => {
    const err = validateStep(currentStep.id, draft);
    if (err) {
      setStepError(err);
      return;
    }
    if (stepIndex < WIZARD_STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      setStepError(null);
    }
  }, [currentStep.id, draft, stepIndex]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      setStepError(null);
    }
  }, [stepIndex]);

  const handleCreateContract = useCallback(async () => {
    for (const step of WIZARD_STEPS) {
      const err = validateStep(step.id, draft);
      if (err) {
        setCreateError(err);
        return;
      }
    }
    setCreating(true);
    setCreateError(null);
    try {
      if (draft.customer?.id) {
        const res = await fetch(`/api/customers/${draft.customer.id}`, { credentials: "include" });
        if (res.ok) {
          const row = await res.json() as { status?: string };
          if (row.status === "inactive") {
            await reactivateCustomer.mutateAsync({
              id: draft.customer.id,
              data: { status: "active" } as { status: "active" },
            });
          }
        }
      }
      const result = await createServiceContract(draft, addonList);
      const billing = await createContractBilling(result.registryId, draft.billingAction);
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
      setContractResult(result);
      setBillingResult(billing);
      if (draft.customer?.id) {
        qc.invalidateQueries({ queryKey: ["customer", draft.customer.id, "services-hub"] });
        qc.invalidateQueries({ queryKey: ["customer", draft.customer.id, "contracts"] });
      }
      qc.invalidateQueries({ queryKey: ["quotations"] });
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
    } catch (e) {
      setCreateError(getApiErrorMessage(e, "Failed to create service request"));
    } finally {
      setCreating(false);
    }
  }, [draft, addonList, qc, reactivateCustomer]);

  const resetWizard = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setDraft({
      ...EMPTY_BOOK_SERVICES_DRAFT,
      customer: initialCustomer,
      requestSource: "walk_in",
    });
    setStepIndex(initialCustomer ? 1 : 0);
    setContractResult(null);
    setBillingResult(null);
    setCreateError(null);
    setStepError(null);
    setRestoredNotice(false);
  }, [initialCustomer]);

  const discardSavedDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setDraft({
      ...EMPTY_BOOK_SERVICES_DRAFT,
      customer: initialCustomer,
      requestSource: "walk_in",
    });
    setStepIndex(initialCustomer ? 1 : 0);
    setStepError(null);
    setRestoredNotice(false);
  }, [initialCustomer]);

  const stepContent = useMemo(() => {
    switch (currentStep.id) {
      case "customer":
        return (
          <CustomerSelect
            value={draft.customer}
            requestSource={draft.requestSource}
            requestNotes={draft.requestNotes}
            onChange={handleCustomerChange}
            onMetaChange={patch => patchDraft(patch)}
          />
        );
      case "asset":
        return (
          <AssetSelect
            customerId={draft.customer?.id ?? null}
            value={draft.asset}
            onChange={handleAssetChange}
          />
        );
      case "location":
        return (
          <LocationSelect
            customerId={draft.customer?.id ?? null}
            preferredLocationId={draft.asset?.serviceLocationId ?? null}
            value={draft.location}
            onChange={handleLocationChange}
          />
        );
      case "service":
        return (
          <ServiceSelect
            asset={draft.asset}
            value={draft.service}
            onChange={handleServiceChange}
          />
        );
      case "pricing":
        return (
          <PricingStep
            draft={draft}
            onChange={patchDraft}
          />
        );
      case "review":
        return (
          <ReviewSummaryStep
            draft={draft}
            creating={creating}
            createError={createError}
            onCreate={handleCreateContract}
            onBillingActionChange={action => patchDraft({ billingAction: action })}
          />
        );
      default:
        return null;
    }
  }, [
    currentStep.id,
    draft,
    handleAssetChange,
    handleCustomerChange,
    handleLocationChange,
    handleServiceChange,
    patchDraft,
    creating,
    createError,
    handleCreateContract,
  ]);

  if (contractResult) {
    return (
      <ContractCreatedStep
        draft={draft}
        result={contractResult}
        billing={billingResult}
        onBookAnother={resetWizard}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="book-services-wizard">
      {restoredNotice && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-3 text-sm">
            <span>Resumed your in-progress service request for {draft.customer?.name ?? "this customer"}.</span>
            <Button type="button" variant="ghost" size="sm" onClick={discardSavedDraft} className="h-7 shrink-0">
              Start fresh instead
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        Step {stepIndex + 1} of {WIZARD_STEPS.length}: {currentStep.label}
      </p>
      <nav aria-label="Service request steps" className="overflow-x-auto">
        <ol className="flex gap-1 min-w-max pb-1">
          {WIZARD_STEPS.map((step, i) => {
            const reachable = canProceedToStep(i, draft);
            const active = i === stepIndex;
            const done = i < stepIndex && !validateStep(step.id, draft);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!reachable && !active}
                  onClick={() => goToStep(i)}
                  data-testid={`book-wizard-step-${step.id}`}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap min-h-9",
                    active && "bg-primary text-primary-foreground",
                    !active && done && "bg-muted text-foreground hover:bg-muted/80",
                    !active && !done && reachable && "text-muted-foreground hover:bg-muted/60",
                    !active && !done && !reachable && "text-muted-foreground/50 cursor-not-allowed",
                  )}
                >
                  <span className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] border",
                    active ? "border-primary-foreground/40" : "border-border",
                  )}>
                    {step.short}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-h-[280px]">
        <h2 className="font-display font-semibold text-lg mb-1">{currentStep.question}</h2>
        <p className="text-sm text-muted-foreground mb-4 sr-only">{currentStep.label}</p>
        {stepContent}
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={stepIndex === 0}
          data-testid="book-wizard-back"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {!isReview && (
          <Button
            type="button"
            onClick={goNext}
            disabled={isLastNavigable}
            data-testid="book-wizard-next"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
        {isReview && (
          <p className="text-sm text-muted-foreground text-right flex-1">
            Creates the service request and {draft.billingAction === "invoice" ? "an invoice" : "a quotation"}.
          </p>
        )}
      </div>
    </div>
  );
}
