import { Label } from "@/components/ui/label";
import { useCatalogAddons } from "@/features/service-catalog/api";
import { AddOnSelect } from "./AddOnSelect";
import { DiscountStep } from "./DiscountStep";
import { PaymentTermsStep } from "./PaymentTermsStep";
import { SolarQuotePanel } from "./SolarQuotePanel";
import {
  computeDraftTotals,
  resolveSolarServicePrice,
  type BookServicesDraft,
  type PaymentTermsChoice,
} from "../types";

type Props = {
  draft: BookServicesDraft;
  onChange: (patch: Partial<BookServicesDraft>) => void;
};

export function PricingStep({ draft, onChange }: Props) {
  const catalogServiceId = draft.service?.kind === "service"
    ? draft.service.catalogServiceId ?? draft.service.id
    : undefined;
  const { data: addons = [] } = useCatalogAddons(catalogServiceId);
  const totals = computeDraftTotals(draft, addons);
  const isSolar = draft.asset?.assetType === "solar_site";
  const serviceDisplayPrice = isSolar ? resolveSolarServicePrice(draft) : (draft.service?.price ?? 0);

  return (
    <div className="space-y-8" data-testid="book-step-pricing">
      <div>
        <Label className="text-base">What are we selling?</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Confirm extras, discount, and payment terms. Solar prices come from the rate card; GST is applied on create.
        </p>
      </div>

      {isSolar && <SolarQuotePanel draft={draft} onChange={onChange} />}

      <section aria-labelledby="pricing-service-heading" className="rounded-lg border border-border p-4 space-y-2">
        <h3 id="pricing-service-heading" className="text-sm font-medium">Service</h3>
        <div className="flex justify-between gap-3 text-sm">
          <span>{draft.service?.name ?? "—"}</span>
          <span className="font-semibold tabular-nums">
            ₹{serviceDisplayPrice.toLocaleString("en-IN")}
          </span>
        </div>
      </section>

      <section aria-labelledby="pricing-addons-heading">
        <h3 id="pricing-addons-heading" className="sr-only">Add-ons</h3>
        <AddOnSelect
          service={draft.service}
          selectedIds={draft.addonIds}
          onChange={ids => onChange({ addonIds: ids })}
        />
      </section>

      <section aria-labelledby="pricing-discount-heading">
        <h3 id="pricing-discount-heading" className="sr-only">Discount</h3>
        <DiscountStep
          discountType={draft.discountType}
          discountValue={draft.discountValue}
          onChange={patch => onChange(patch)}
        />
      </section>

      <section aria-labelledby="pricing-payment-heading">
        <h3 id="pricing-payment-heading" className="sr-only">Payment terms</h3>
        <PaymentTermsStep
          paymentTerms={draft.paymentTerms}
          partialAdvancePercent={draft.partialAdvancePercent}
          onChange={(patch: { paymentTerms: PaymentTermsChoice; partialAdvancePercent?: string }) =>
            onChange(patch)}
        />
      </section>

      <section
        aria-labelledby="pricing-estimate-heading"
        className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2"
      >
        <h3 id="pricing-estimate-heading" className="text-sm font-medium">Estimated total</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">₹{totals.subtotal.toLocaleString("en-IN")}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="tabular-nums">−₹{totals.discountAmount.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1 border-t border-border/60">
            <span>Estimated (pre-GST)</span>
            <span className="tabular-nums">₹{totals.estimatedTotal.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tax (CGST/SGST/IGST) is calculated from the catalog when the service request is created.
            Coupon / plan eligibility can plug into this step later.
          </p>
        </div>
      </section>
    </div>
  );
}
