import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useCatalogAddons } from "@/features/service-catalog/api";
import { cn } from "@/lib/utils";
import {
  type BookServicesDraft,
  type BillingActionChoice,
  computeDraftTotals,
  paymentTermsLabel,
  billingActionLabel,
  requestSourceLabel,
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
    ? null
    : draft.discountType === "percent"
      ? `${draft.discountValue}%`
      : `₹${parseFloat(draft.discountValue || "0").toLocaleString("en-IN")}`;

  return (
    <div className="space-y-5" data-testid="book-step-review">
      <div>
        <h2 className="font-display font-semibold text-lg">Ready to create this service request?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review like an invoice. Creating the request opens quotation/billing and the assignment queue.
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Service request preview</p>
            <p className="text-sm font-medium">{draft.service?.name ?? "—"}</p>
          </div>
          <Badge variant="outline">{fulfillmentLabel(fulfillment.mode)}</Badge>
        </div>

        <div className="divide-y divide-border text-sm">
          <Section title="Customer">
            <p className="font-medium">{draft.customer?.name ?? "—"}</p>
            <p className="text-muted-foreground">{draft.customer?.phone}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Source: {requestSourceLabel(draft.requestSource)}
            </p>
            {draft.requestNotes.trim() && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{draft.requestNotes}</p>
            )}
          </Section>

          <Section title="Asset">
            <p className="font-medium">{draft.asset?.label ?? "—"}</p>
            <p className="text-muted-foreground">
              {draft.asset?.assetType === "solar_site" ? "Solar site" : "Vehicle"}
            </p>
          </Section>

          <Section title="Location">
            <p className="font-medium">{draft.location?.label ?? "—"}</p>
            {draft.location?.address && (
              <p className="text-muted-foreground text-xs mt-0.5">{draft.location.address}</p>
            )}
            {draft.location?.city && (
              <p className="text-muted-foreground text-xs">{draft.location.city}</p>
            )}
          </Section>

          <Section title="Service">
            <p className="font-medium">{draft.service?.name ?? "—"}</p>
            {selectedAddons.length > 0 && (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {selectedAddons.map(a => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>+ {a.name}</span>
                    <span className="tabular-nums">₹{parseFloat(a.basePrice).toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Pricing">
            <div className="space-y-1">
              <Line label="Service" value={`₹${(draft.service?.price ?? 0).toLocaleString("en-IN")}`} />
              {selectedAddons.length > 0 && (
                <Line
                  label="Add-ons"
                  value={`₹${selectedAddons.reduce((s, a) => s + (parseFloat(a.basePrice) || 0), 0).toLocaleString("en-IN")}`}
                />
              )}
              {discountLabel && <Line label="Discount" value={`− ${discountLabel}`} />}
              <Line label="Estimated subtotal" value={`₹${totals.estimatedTotal.toLocaleString("en-IN")}`} strong />
              <p className="text-xs text-muted-foreground pt-1">GST calculated on create.</p>
            </div>
          </Section>

          <Section title="Payment">
            <p>{paymentTermsLabel(draft.paymentTerms)}</p>
            {draft.paymentTerms === "partial_advance" && (
              <p className="text-muted-foreground text-xs mt-0.5">
                {draft.partialAdvancePercent}% advance before service
              </p>
            )}
          </Section>

          <Section title="Assignment preview">
            <p className="text-muted-foreground">
              After create, this request enters the Assign Service queue for dispatch.
              Staff assignment happens in the next operational step — not here.
            </p>
          </Section>
        </div>
      </div>

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
                "text-left border rounded-lg px-4 py-3 text-sm transition-colors min-h-11",
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
        <p className="text-sm text-destructive" data-testid="book-create-error" role="alert">{createError}</p>
      )}

      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          data-testid="book-create-booking"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 w-full min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {creating
            ? "Creating service request…"
            : draft.billingAction === "invoice"
              ? "Create Service Request & Invoice"
              : "Create Service Request"}
        </button>
      )}

      <Badge variant="outline" className="text-xs">
        Request → quotation/invoice → Assign Service queue
      </Badge>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 grid sm:grid-cols-[7rem_1fr] gap-1 sm:gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-0.5">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "font-semibold pt-1 border-t border-border/60")}>
      <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
