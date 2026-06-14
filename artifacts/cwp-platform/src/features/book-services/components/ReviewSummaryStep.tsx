import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useCatalogAddons } from "@/features/service-catalog/api";
import { ASSET_TYPE_LABELS } from "@/features/assets/api";
import { cn } from "@/lib/utils";
import {
  type BookServicesDraft,
  type BillingActionChoice,
  computeDraftTotals,
  paymentTermsLabel,
  billingActionLabel,
} from "../types";
import { resolveFulfillmentHint, fulfillmentLabel } from "../api";

type Props = {
  draft: BookServicesDraft;
  creating?: boolean;
  createError?: string | null;
  onCreate?: () => void;
  onBillingActionChange?: (action: BillingActionChoice) => void;
};

const BILLING_OPTIONS: BillingActionChoice[] = ["quotation", "invoice"];

export function ReviewSummaryStep({
  draft,
  creating,
  createError,
  onCreate,
  onBillingActionChange,
}: Props) {
  const catalogServiceId = draft.service?.kind === "service"
    ? draft.service.catalogServiceId ?? draft.service.id
    : undefined;

  const { data: addons } = useCatalogAddons(catalogServiceId);
  const addonList = addons ?? [];
  const selectedAddons = addonList.filter(a => draft.addonIds.includes(a.id));
  const totals = computeDraftTotals(draft, addonList);
  const fulfillment = resolveFulfillmentHint(draft);

  const discountLabel = draft.discountType === "none"
    ? "None"
    : draft.discountType === "percent"
      ? `${draft.discountValue}% off`
      : `₹${parseFloat(draft.discountValue || "0").toLocaleString("en-IN")} off`;

  return (
    <div className="space-y-4" data-testid="book-step-review">
      <div>
        <h2 className="font-display font-semibold text-lg">Review and complete sale</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Creates the service contract first, then generates your chosen billing document. GST is calculated from service configuration — not hardcoded.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <SummaryRow label="Customer" value={draft.customer ? `${draft.customer.name} · ${draft.customer.phone}` : "—"} />
          <SummaryRow
            label="Service location"
            value={draft.location
              ? `${draft.location.label}${draft.location.isDefault ? " (Primary)" : ""}${draft.location.city ? ` · ${draft.location.city}` : ""}`
              : "—"}
          />
          {draft.location?.address && (
            <p className="text-xs text-muted-foreground -mt-2 pl-0">{draft.location.address}</p>
          )}
          <SummaryRow
            label="Asset"
            value={draft.asset
              ? `${draft.asset.label} (${ASSET_TYPE_LABELS[draft.asset.assetType]})`
              : "—"}
          />
          <SummaryRow
            label="Service"
            value={draft.service
              ? `${draft.service.name} — ₹${draft.service.price.toLocaleString("en-IN")}`
              : "—"}
          />
          {selectedAddons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Add-ons</p>
              <ul className="space-y-1">
                {selectedAddons.map(a => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>{a.name}</span>
                    <span>₹{parseFloat(a.basePrice).toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SummaryRow label="Plan type" value={fulfillmentLabel(fulfillment.mode)} />
          <SummaryRow label="Discount" value={discountLabel} />
          <SummaryRow label="Payment terms" value={paymentTermsLabel(draft.paymentTerms)} />
          {draft.paymentTerms === "partial_advance" && (
            <SummaryRow label="Advance" value={`${draft.partialAdvancePercent}% before service`} />
          )}

          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Estimated subtotal (pre-GST split)</span>
              <span>₹{totals.estimatedTotal.toLocaleString("en-IN")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Final GST breakdown appears after contract and billing document creation.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label>Billing document</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {BILLING_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onBillingActionChange?.(opt)}
              data-testid={`book-billing-${opt}`}
              className={cn(
                "text-left border rounded-lg px-4 py-3 text-sm transition-colors",
                draft.billingAction === opt
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border hover:border-primary/40",
              )}
            >
              {billingActionLabel(opt)}
            </button>
          ))}
        </div>
      </div>

      {createError && (
        <p className="text-sm text-destructive" data-testid="book-create-error">{createError}</p>
      )}

      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          data-testid="book-create-contract"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 w-full sm:w-auto"
        >
          {creating
            ? "Creating…"
            : draft.billingAction === "invoice"
              ? "Create Contract & Invoice"
              : "Create Contract & Quotation"}
        </button>
      )}

      <Badge variant="outline" className="text-xs">
        Contract → billing → pending assignment (no staff dispatch in this sprint)
      </Badge>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right sm:text-left">{value}</span>
    </div>
  );
}
