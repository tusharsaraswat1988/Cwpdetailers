import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalogAddons } from "@/features/service-catalog/api";
import type { CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import type { CustomerServiceLocationRow } from "@/features/service-locations/api";
import type { AssetListRow } from "@/features/assets/api";
import {
  EMPTY_BOOK_SERVICES_DRAFT,
  WIZARD_STEPS,
  type BookServicesDraft,
  type SelectedBookService,
  validateStep,
  canProceedToStep,
} from "../types";
import { createServiceContract, createContractBilling, type ServiceContractResult, type ContractBillingResult } from "../api";
import { CustomerSelect } from "./CustomerSelect";
import { LocationSelect } from "./LocationSelect";
import { AssetSelect } from "./AssetSelect";
import { ServiceSelect } from "./ServiceSelect";
import { AddOnSelect } from "./AddOnSelect";
import { DiscountStep } from "./DiscountStep";
import { PaymentTermsStep } from "./PaymentTermsStep";
import { ReviewSummaryStep } from "./ReviewSummaryStep";
import { ContractCreatedStep } from "./ContractCreatedStep";

type Props = {
  initialCustomer?: CustomerSearchValue | null;
};

export function BookServicesWizard({ initialCustomer = null }: Props) {
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<BookServicesDraft>(() => ({
    ...EMPTY_BOOK_SERVICES_DRAFT,
    customer: initialCustomer,
  }));
  const [stepError, setStepError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [contractResult, setContractResult] = useState<ServiceContractResult | null>(null);
  const [billingResult, setBillingResult] = useState<ContractBillingResult | null>(null);

  const catalogServiceId = draft.service?.kind === "service"
    ? draft.service.catalogServiceId ?? draft.service.id
    : undefined;
  const { data: addonList = [] } = useCatalogAddons(catalogServiceId);

  const currentStep = WIZARD_STEPS[stepIndex]!;
  const isReview = currentStep.id === "review";
  const isLastNavigable = stepIndex === WIZARD_STEPS.length - 1;

  const patchDraft = useCallback((patch: Partial<BookServicesDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    setStepError(null);
  }, []);

  const handleCustomerChange = useCallback((customer: CustomerSearchValue | null) => {
    setDraft(prev => ({
      ...EMPTY_BOOK_SERVICES_DRAFT,
      customer,
      paymentTerms: prev.paymentTerms,
      partialAdvancePercent: prev.partialAdvancePercent,
    }));
    setStepError(null);
  }, []);

  const handleLocationChange = useCallback((location: CustomerServiceLocationRow | null) => {
    setDraft(prev => ({
      ...prev,
      location,
      asset: null,
      service: null,
      addonIds: [],
    }));
    setStepError(null);
  }, []);

  const handleAssetChange = useCallback((asset: AssetListRow | null) => {
    setDraft(prev => ({
      ...prev,
      asset,
      service: null,
      addonIds: [],
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
      const result = await createServiceContract(draft, addonList);
      const billing = await createContractBilling(result.registryId, draft.billingAction);
      setContractResult(result);
      setBillingResult(billing);
      if (draft.customer?.id) {
        qc.invalidateQueries({ queryKey: ["customer", draft.customer.id, "services-hub"] });
        qc.invalidateQueries({ queryKey: ["customer", draft.customer.id, "contracts"] });
      }
      qc.invalidateQueries({ queryKey: ["quotations"] });
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create contract");
    } finally {
      setCreating(false);
    }
  }, [draft, addonList, qc]);

  const resetWizard = useCallback(() => {
    setDraft({
      ...EMPTY_BOOK_SERVICES_DRAFT,
      customer: initialCustomer,
    });
    setStepIndex(0);
    setContractResult(null);
    setBillingResult(null);
    setCreateError(null);
    setStepError(null);
  }, [initialCustomer]);

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

  const stepContent = useMemo(() => {
    switch (currentStep.id) {
      case "customer":
        return <CustomerSelect value={draft.customer} onChange={handleCustomerChange} />;
      case "location":
        return (
          <LocationSelect
            customerId={draft.customer?.id ?? null}
            value={draft.location}
            onChange={handleLocationChange}
          />
        );
      case "asset":
        return (
          <AssetSelect
            customerId={draft.customer?.id ?? null}
            serviceLocationId={draft.location?.id ?? null}
            value={draft.asset}
            onChange={handleAssetChange}
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
      case "addons":
        return (
          <AddOnSelect
            service={draft.service}
            selectedIds={draft.addonIds}
            onChange={ids => patchDraft({ addonIds: ids })}
          />
        );
      case "discount":
        return (
          <DiscountStep
            discountType={draft.discountType}
            discountValue={draft.discountValue}
            onChange={patch => patchDraft(patch)}
          />
        );
      case "payment":
        return (
          <PaymentTermsStep
            paymentTerms={draft.paymentTerms}
            partialAdvancePercent={draft.partialAdvancePercent}
            onChange={patch => patchDraft(patch)}
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

  return (
    <div className="space-y-6" data-testid="book-services-wizard">
      <nav aria-label="Booking steps" className="overflow-x-auto">
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
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
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
        <h2 className="font-display font-semibold text-lg mb-4">{currentStep.label}</h2>
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
            Creates contract, then {draft.billingAction === "invoice" ? "invoice" : "quotation"}.
          </p>
        )}
      </div>
    </div>
  );
}
