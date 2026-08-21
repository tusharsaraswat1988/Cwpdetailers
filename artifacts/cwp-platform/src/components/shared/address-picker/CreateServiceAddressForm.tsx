import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleMapPicker } from "@/components/shared/GoogleMapPicker";
import { CitySearchSelect } from "@/features/master-data/components/CitySearchSelect";
import type { LocationValue } from "@/features/master-data/api";
import { isGoogleMapsConfigured } from "@/lib/maps";
import type { ResolvedPlace } from "@/lib/maps/places";
import { cn } from "@/lib/utils";
import {
  canSaveCustomerLocation,
  composeSavedAddress,
  hasFiniteCoordinates,
  mergeGooglePrefill,
} from "@workspace/address-model";
import { MapPin } from "lucide-react";
import { useState } from "react";
import type { CustomerServiceAddressValue } from "./addressForm";

const SITE_PRESETS = ["Home", "Work", "Other"] as const;

type Props = {
  value: CustomerServiceAddressValue;
  onChange: (patch: Partial<CustomerServiceAddressValue>) => void;
  idPrefix?: string;
  /** When true, skip the search-first step (admin embedded form). */
  embedded?: boolean;
  ctaLabel?: string;
  onSubmit?: () => void;
  submitting?: boolean;
  mapsForcedUnavailable?: boolean;
};

export function CreateServiceAddressForm({
  value,
  onChange,
  idPrefix = "service-address",
  embedded,
  ctaLabel = "Save address",
  onSubmit,
  submitting,
  mapsForcedUnavailable,
}: Props) {
  const mapsConfigured = isGoogleMapsConfigured() && !mapsForcedUnavailable;
  const [mapsFailed, setMapsFailed] = useState(!isGoogleMapsConfigured() || Boolean(mapsForcedUnavailable));
  const mapsEnabled = mapsConfigured && !mapsFailed;
  const hasPin = hasFiniteCoordinates(parseFloat(value.latitude), parseFloat(value.longitude));
  const hasPlace = hasPin || Boolean(value.formattedAddress?.trim());
  const [showMap, setShowMap] = useState(Boolean(embedded));
  const [customLabel, setCustomLabel] = useState(
    SITE_PRESETS.includes(value.serviceLocationLabel as typeof SITE_PRESETS[number])
      ? ""
      : value.serviceLocationLabel,
  );

  const preset = SITE_PRESETS.includes(value.serviceLocationLabel as typeof SITE_PRESETS[number])
    ? value.serviceLocationLabel
    : "Other";

  const applyResolved = (loc: LocationValue, resolved?: ResolvedPlace) => {
    const mapped = resolved?.parts ?? {};
    const merged = mergeGooglePrefill(value, {
      houseNumber: mapped.houseNumber,
      buildingName: mapped.buildingName,
      area: mapped.area,
      pincode: mapped.pincode,
      city: mapped.city,
      landmark: value.landmark,
    });
    onChange({
      houseNumber: merged.houseNumber ?? value.houseNumber,
      buildingName: merged.buildingName ?? value.buildingName,
      area: merged.area || loc.address,
      pincode: merged.pincode ?? value.pincode,
      city: merged.city ?? value.city,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      placeId: loc.placeId ?? "",
      formattedAddress: resolved?.formattedAddress ?? loc.formattedAddress ?? loc.address,
      googleComponents: resolved?.googleComponents ?? loc.googleComponents,
    });
  };

  const mapValue: LocationValue | null = hasPin
    ? {
        address: value.formattedAddress || composeSavedAddress(value),
        latitude: parseFloat(value.latitude),
        longitude: parseFloat(value.longitude),
        placeId: value.placeId || undefined,
        formattedAddress: value.formattedAddress,
      }
    : null;

  const saveReady = canSaveCustomerLocation(
    { ...value, formattedAddress: value.formattedAddress },
    { hasCoordinates: hasPin, mapsUnavailable: !mapsEnabled },
  );

  const showDetails = embedded || hasPlace || !mapsEnabled;
  const showCityPincode = !mapsEnabled || !value.city.trim() || !value.pincode.trim();

  return (
    <div className="space-y-5" data-testid={`${idPrefix}-create`}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold leading-tight">Where should we come?</h2>
        <p className="text-sm text-muted-foreground">Search a place, then add the details our team needs.</p>
      </div>

      {mapsConfigured && !mapsFailed && (!hasPlace || showMap) && (
        <GoogleMapPicker
          value={mapValue}
          onChange={applyResolved}
          layout={embedded ? "embedded" : "search-first"}
          showMap={embedded || showMap}
          mapHeightClass={embedded ? "h-44 sm:h-52" : "h-40 sm:h-48"}
          searchPlaceholder="Search your address, building or landmark"
          autoFocusSearch={!embedded && !hasPlace}
          onUnavailable={() => setMapsFailed(true)}
        />
      )}

      {!mapsEnabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3" data-testid={`${idPrefix}-map-unavailable`}>
          <p className="text-sm font-medium">Map unavailable</p>
          <p className="text-xs text-muted-foreground mt-0.5">You can still enter your address manually.</p>
        </div>
      )}

      {mapsEnabled && hasPlace && !showMap && (
        <div className="rounded-xl border bg-card p-3 space-y-2" data-testid={`${idPrefix}-location-selected`}>
          <p className="text-xs font-medium text-muted-foreground">Location selected</p>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
            <p className="text-sm leading-snug">{value.formattedAddress || value.area || "Selected place"}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2"
            onClick={() => setShowMap(true)}
            data-testid={`${idPrefix}-adjust-location`}
          >
            Adjust location
          </Button>
        </div>
      )}

      {mapsEnabled && hasPlace && showMap && !embedded && (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowMap(false)}>
          Done adjusting
        </Button>
      )}

      {showDetails && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Help our team find you</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Only the extras the map cannot see.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${idPrefix}-house`} className="text-xs">
                Flat / House no. <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${idPrefix}-house`}
                data-testid={`${idPrefix}-house`}
                value={value.houseNumber}
                onChange={e => onChange({ houseNumber: e.target.value })}
                className="mt-1 h-11"
                placeholder="e.g. 12B, H-204"
                autoComplete="address-line2"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-building`} className="text-xs">
                Building / Society
              </Label>
              <Input
                id={`${idPrefix}-building`}
                data-testid={`${idPrefix}-building`}
                value={value.buildingName}
                onChange={e => onChange({ buildingName: e.target.value })}
                className="mt-1 h-11"
                placeholder="e.g. Green Valley Apartments"
              />
            </div>
            {(!value.area.trim() || !mapsEnabled) && (
              <div className="sm:col-span-2">
                <Label htmlFor={`${idPrefix}-area`} className="text-xs">
                  Area / locality {!mapsEnabled && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id={`${idPrefix}-area`}
                  data-testid={`${idPrefix}-area`}
                  value={value.area}
                  onChange={e => onChange({ area: e.target.value })}
                  className="mt-1 h-11"
                  placeholder="e.g. Lanka, Sigra"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label htmlFor={`${idPrefix}-landmark`} className="text-xs">Landmark</Label>
              <Input
                id={`${idPrefix}-landmark`}
                data-testid={`${idPrefix}-landmark`}
                value={value.landmark}
                onChange={e => onChange({ landmark: e.target.value })}
                className="mt-1 h-11"
                placeholder="e.g. Near BHU Main Gate"
              />
            </div>
            {showCityPincode && (
              <>
                <CitySearchSelect
                  id={`${idPrefix}-city`}
                  testId={`${idPrefix}-city`}
                  label={mapsEnabled ? "City" : "City *"}
                  placeholder="Search city…"
                  value={value.city}
                  onChange={city => onChange({ city })}
                />
                <div>
                  <Label htmlFor={`${idPrefix}-pincode`} className="text-xs">Pincode</Label>
                  <Input
                    id={`${idPrefix}-pincode`}
                    data-testid={`${idPrefix}-pincode`}
                    value={value.pincode}
                    onChange={e => onChange({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    className="mt-1 h-11 font-mono"
                    placeholder="221005"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showDetails && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Save this place as</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Save this place as">
            {SITE_PRESETS.map(site => (
              <button
                key={site}
                type="button"
                onClick={() => {
                  if (site === "Other") {
                    onChange({ serviceLocationLabel: customLabel.trim() || "Other" });
                    return;
                  }
                  onChange({ serviceLocationLabel: site });
                }}
                data-testid={`${idPrefix}-site-${site.toLowerCase()}`}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                  preset === site
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/40",
                )}
              >
                {site}
              </button>
            ))}
          </div>
          {preset === "Other" && (
            <Input
              value={customLabel}
              onChange={e => {
                setCustomLabel(e.target.value);
                onChange({ serviceLocationLabel: e.target.value.trim() || "Other" });
              }}
              placeholder="Give this place a name"
              className="h-11"
              data-testid={`${idPrefix}-site-custom`}
            />
          )}
          <p className="text-[11px] text-muted-foreground">Examples: Parents&apos; Home, Shop, Office 2</p>
        </div>
      )}

      {onSubmit && showDetails && (
        <Button
          type="button"
          className="w-full h-12 sticky bottom-0"
          disabled={!saveReady || submitting}
          onClick={onSubmit}
          data-testid="btn-save-address"
        >
          {submitting ? "Saving…" : ctaLabel}
        </Button>
      )}
    </div>
  );
}
