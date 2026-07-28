import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleMapPicker } from "@/components/shared/GoogleMapPicker";
import { FormattedAddressDisplay } from "@/components/shared/FormattedAddressDisplay";
import { CitySearchSelect } from "@/features/master-data/components/CitySearchSelect";
import type { LocationValue } from "@/features/master-data/api";
import { isGoogleMapsConfigured } from "@/lib/maps";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, MapPin, Navigation2 } from "lucide-react";
import {
  composeSavedAddress,
  hasRequiredAddressParts,
  prefillAddressFromGeocode,
} from "../lib/serviceAddress";

export type CustomerServiceAddressValue = {
  serviceLocationLabel: string;
  houseNumber: string;
  buildingName: string;
  area: string;
  landmark: string;
  pincode: string;
  city: string;
  latitude: string;
  longitude: string;
  placeId: string;
};

export { composeSavedAddress } from "../lib/serviceAddress";

const SITE_PRESETS = ["Home", "Office", "Factory", "Other"] as const;

function FieldLabel({
  htmlFor,
  children,
  required,
  optional,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-xs">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
      {optional && <span className="text-muted-foreground font-normal ml-1">(optional)</span>}
    </Label>
  );
}

type Props = {
  value: CustomerServiceAddressValue;
  onChange: (patch: Partial<CustomerServiceAddressValue>) => void;
  idPrefix?: string;
};

export function CustomerServiceAddressSection({
  value,
  onChange,
  idPrefix = "customer-address",
}: Props) {
  const mapsEnabled = isGoogleMapsConfigured();
  const [mapOpen, setMapOpen] = useState(true);
  const [customSiteLabel, setCustomSiteLabel] = useState(
    SITE_PRESETS.includes(value.serviceLocationLabel as typeof SITE_PRESETS[number])
      ? ""
      : value.serviceLocationLabel,
  );

  const hasPin = Boolean(
    value.latitude.trim()
    && value.longitude.trim()
    && !Number.isNaN(parseFloat(value.latitude))
    && !Number.isNaN(parseFloat(value.longitude)),
  );

  const presetSite = SITE_PRESETS.includes(value.serviceLocationLabel as typeof SITE_PRESETS[number])
    ? value.serviceLocationLabel
    : "Other";

  const savedAddress = composeSavedAddress(value);
  const dispatchReady = hasRequiredAddressParts(value) && (hasPin || !mapsEnabled);

  const mapValue: LocationValue | null = hasPin
    ? {
        address: savedAddress || `${value.latitude}, ${value.longitude}`,
        latitude: parseFloat(value.latitude),
        longitude: parseFloat(value.longitude),
        placeId: value.placeId || undefined,
      }
    : null;

  useEffect(() => {
    const empty = !value.houseNumber && !value.area && !value.latitude && !value.landmark;
    if (empty) setMapOpen(true);
  }, [value.houseNumber, value.area, value.latitude, value.landmark]);

  const handleMapChange = (loc: LocationValue) => {
    const prefill = prefillAddressFromGeocode(loc.address);
    onChange({
      houseNumber: value.houseNumber.trim() || prefill.houseNumber || "",
      buildingName: value.buildingName.trim() || prefill.buildingName || "",
      area: value.area.trim() || prefill.area || loc.address,
      pincode: value.pincode.trim() || prefill.pincode || "",
      city: value.city.trim() || prefill.city || "",
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      placeId: loc.placeId ?? "",
    });
    setMapOpen(false);
  };

  const selectSite = (site: string) => {
    if (site === "Other") {
      onChange({ serviceLocationLabel: customSiteLabel.trim() || "Other" });
      return;
    }
    onChange({ serviceLocationLabel: site });
  };

  return (
    <section
      className="rounded-xl border border-border bg-muted/20 overflow-hidden"
      data-testid={`${idPrefix}-section`}
    >
      <div className="px-4 py-3 border-b border-border/80 bg-background/80">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
          <div>
            <h3 className="text-sm font-medium leading-none">Service address</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Search on the map, then fill in the address lines staff will follow.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Site name</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Site name">
            {SITE_PRESETS.map(site => {
              const selected = presetSite === site;
              return (
                <button
                  key={site}
                  type="button"
                  onClick={() => selectSite(site)}
                  data-testid={`${idPrefix}-site-${site.toLowerCase()}`}
                  className={cn(
                    "min-h-9 rounded-full border px-3.5 text-xs font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  {site}
                </button>
              );
            })}
          </div>
          {presetSite === "Other" && (
            <Input
              value={customSiteLabel}
              onChange={e => {
                setCustomSiteLabel(e.target.value);
                onChange({ serviceLocationLabel: e.target.value.trim() || "Other" });
              }}
              placeholder="Custom site name"
              className="h-9"
              data-testid={`${idPrefix}-site-custom`}
            />
          )}
        </div>

        {mapsEnabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Find on map *</Label>
              {hasPin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMapOpen(v => !v)}
                  data-testid={`${idPrefix}-toggle-map`}
                >
                  {mapOpen ? (
                    <>Hide map <ChevronUp className="ml-1 h-3.5 w-3.5" /></>
                  ) : (
                    <>Adjust pin <ChevronDown className="ml-1 h-3.5 w-3.5" /></>
                  )}
                </Button>
              )}
            </div>

            {hasPin && !mapOpen && (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="w-full rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
                data-testid={`${idPrefix}-pin-summary`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Navigation2 className="h-4 w-4 text-primary shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">Location pinned</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {parseFloat(value.latitude).toFixed(5)}, {parseFloat(value.longitude).toFixed(5)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">GPS ready</Badge>
                </div>
              </button>
            )}

            {mapOpen && (
              <GoogleMapPicker
                value={mapValue}
                onChange={handleMapChange}
                mapHeightClass="h-44 sm:h-48"
              />
            )}
          </div>
        )}

        {!mapsEnabled && (
          <p className="text-xs text-amber-800 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            Maps API key missing — fill the address lines below. Add coordinates later from the customer profile.
          </p>
        )}

        <div className="space-y-3 rounded-lg border border-border/80 bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">Address details</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={`${idPrefix}-house`} required>
                Flat / House no.
              </FieldLabel>
              <Input
                id={`${idPrefix}-house`}
                data-testid={`${idPrefix}-house`}
                value={value.houseNumber}
                onChange={e => onChange({ houseNumber: e.target.value })}
                className="mt-1 h-9"
                placeholder="e.g. 12B, H-204"
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${idPrefix}-building`} optional>
                Building / Society
              </FieldLabel>
              <Input
                id={`${idPrefix}-building`}
                data-testid={`${idPrefix}-building`}
                value={value.buildingName}
                onChange={e => onChange({ buildingName: e.target.value })}
                className="mt-1 h-9"
                placeholder="e.g. Green Valley Apartments"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor={`${idPrefix}-area`} required>
                Area / Street / Locality
              </FieldLabel>
              <Input
                id={`${idPrefix}-area`}
                data-testid={`${idPrefix}-area`}
                value={value.area}
                onChange={e => onChange({ area: e.target.value })}
                className="mt-1 h-9"
                placeholder="e.g. Shastri Nagar, Lanka"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor={`${idPrefix}-landmark`} optional>
                Landmark
              </FieldLabel>
              <Input
                id={`${idPrefix}-landmark`}
                data-testid={`${idPrefix}-landmark`}
                value={value.landmark}
                onChange={e => onChange({ landmark: e.target.value })}
                className="mt-1 h-9"
                placeholder="e.g. Near BHU main gate, blue building"
              />
            </div>
            <CitySearchSelect
              id={`${idPrefix}-city`}
              testId={`${idPrefix}-city`}
              label="City *"
              placeholder="Search city…"
              value={value.city}
              onChange={city => onChange({ city })}
            />
            <div>
              <FieldLabel htmlFor={`${idPrefix}-pincode`} optional>
                Pincode
              </FieldLabel>
              <Input
                id={`${idPrefix}-pincode`}
                data-testid={`${idPrefix}-pincode`}
                value={value.pincode}
                onChange={e => onChange({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                className="mt-1 h-9 font-mono"
                placeholder="221005"
                inputMode="numeric"
                maxLength={6}
              />
            </div>
          </div>
        </div>

        {dispatchReady && (
          <div
            className="rounded-lg border border-border bg-background px-3 py-2.5"
            data-testid={`${idPrefix}-dispatch-preview`}
          >
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Staff will see</p>
            <FormattedAddressDisplay
              value={savedAddress}
              siteLabel={value.serviceLocationLabel}
              city={value.city}
            />
            {hasPin && (
              <p className="text-[11px] text-muted-foreground mt-2">
                GPS: {parseFloat(value.latitude).toFixed(5)}, {parseFloat(value.longitude).toFixed(5)}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
