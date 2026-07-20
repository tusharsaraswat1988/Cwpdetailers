import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useAdminServices, useCatalogPricingQuote } from "@/features/service-catalog/api";
import type { SolarAssetFormValues } from "./AssetForms";

type LocationOption = {
  id: number;
  label: string;
  address?: string | null;
  city?: string | null;
};

type Props = {
  values: SolarAssetFormValues;
  onChange: (v: SolarAssetFormValues) => void;
  serviceLocations: LocationOption[];
  /** When false, hide address picker (parent already locked it). */
  showServiceLocation?: boolean;
  /** Offer inline “add address” when parent can create one. */
  onAddAddress?: () => void;
};

/**
 * Solar site registration — panel count is the pricing key (rate card).
 * Capacity (kW) is optional metadata only.
 */
export function SolarSiteForm({
  values,
  onChange,
  serviceLocations,
  showServiceLocation = true,
  onAddAddress,
}: Props) {
  const set = (patch: Partial<SolarAssetFormValues>) => onChange({ ...values, ...patch });
  const { data: services } = useAdminServices();
  const solarServiceId = useMemo(
    () => (services ?? []).find(s =>
      s.pricingModel === "solar_slab" || s.category === "solar_cleaning",
    )?.id,
    [services],
  );

  const panelCount = parseInt(values.panelCount, 10);
  const panelsOk = Number.isFinite(panelCount) && panelCount >= 1;

  const { data: quote, isFetching } = useCatalogPricingQuote({
    serviceId: solarServiceId,
    panelCount: panelsOk ? panelCount : undefined,
    term: "one_time",
    enabled: panelsOk && solarServiceId != null,
  });

  return (
    <div className="space-y-4">
      {showServiceLocation && (
        <div className="space-y-2">
          <Label>Service address *</Label>
          {serviceLocations.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-3 space-y-2">
              <p className="text-sm text-muted-foreground">No addresses on file for this customer yet.</p>
              {onAddAddress && (
                <Button type="button" size="sm" variant="outline" onClick={onAddAddress}>
                  <Plus size={14} className="mr-1" /> Add address with a name
                </Button>
              )}
            </div>
          ) : (
            <>
              <Select
                value={values.serviceLocationId || "none"}
                onValueChange={v => set({ serviceLocationId: v === "none" ? "" : v })}
              >
                <SelectTrigger className="mt-1" data-testid="solar-service-location">
                  <SelectValue placeholder="Select an address" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select an address</SelectItem>
                  {serviceLocations.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onAddAddress && (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-0 text-xs" onClick={onAddAddress}>
                  <Plus size={12} className="mr-1" /> Add another address
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <Label>Site name *</Label>
        <Input
          className="mt-1"
          value={values.siteName}
          onChange={e => set({ siteName: e.target.value })}
          placeholder="e.g. Rooftop – House"
          data-testid="solar-site-name"
        />
      </div>

      <div>
        <Label>Panel count *</Label>
        <Input
          type="number"
          min={1}
          className="mt-1"
          value={values.panelCount}
          onChange={e => set({ panelCount: e.target.value })}
          placeholder="How many panels?"
          data-testid="solar-panel-count"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Cleaning price is quoted from the solar rate card using this count (GST extra). Large sites may need a site visit.
        </p>
      </div>

      {panelsOk && (
        <div className="rounded-md border border-border bg-background/80 px-3 py-2.5 space-y-1.5" data-testid="solar-quote-preview">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium">One-time cleaning estimate</p>
            {isFetching && <Badge variant="outline" className="text-[10px]">…</Badge>}
            {quote?.status === "needs_site_visit" && <Badge variant="outline" className="text-[10px]">Site visit</Badge>}
            {quote?.status === "priced" && <Badge variant="secondary" className="text-[10px]">Rate card</Badge>}
          </div>
          {quote?.status === "priced" && (
            <p className="text-sm">
              <span className="font-semibold tabular-nums">
                ₹{(quote.breakdown?.baseAmount ?? quote.solar?.amount ?? 0).toLocaleString("en-IN")}
              </span>
              <span className="text-muted-foreground text-xs ml-1">
                + GST
                {quote.solar?.pricePerPanel != null
                  ? ` · ₹${quote.solar.pricePerPanel}/panel`
                  : ""}
                {quote.solar?.minimumBilling != null
                  ? ` · min ₹${quote.solar.minimumBilling}`
                  : ""}
              </span>
            </p>
          )}
          {quote?.status === "needs_site_visit" && (
            <p className="text-xs text-muted-foreground">
              This panel count needs a callback and site visit. After visit, advisor finalizes the amount and books normally.
            </p>
          )}
          {quote?.status === "no_slab" && (
            <p className="text-xs text-muted-foreground">
              No rate-card row matches yet — configure slabs under Products → Solar, or enter a manual amount at Pricing.
            </p>
          )}
          {!quote && !isFetching && (
            <p className="text-xs text-muted-foreground">Enter panel count to preview the rate-card quote.</p>
          )}
        </div>
      )}

      <div>
        <Label>Capacity (kW)</Label>
        <Input
          className="mt-1"
          value={values.panelCapacityKw}
          onChange={e => set({ panelCapacityKw: e.target.value })}
          placeholder="Optional"
          data-testid="solar-capacity"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Optional — not used for pricing.</p>
      </div>

      <div>
        <Label>Notes</Label>
        <Input className="mt-1" value={values.notes} onChange={e => set({ notes: e.target.value })} />
      </div>
    </div>
  );
}
