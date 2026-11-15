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
import { AlertCircle, Building, Building2, CheckCircle2, Home, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { CustomerServiceAddressValue, PropertyTypeOption } from "./addressForm";

const SITE_PRESETS = ["Home", "Work", "Other"] as const;

const PROPERTY_TYPES: Array<{
  value: PropertyTypeOption;
  label: string;
  icon: typeof Home;
  description: string;
}> = [
  { value: "GATED_SOCIETY", label: "Gated Society", icon: Building2, description: "Apartment complex with towers and security" },
  { value: "INDIVIDUAL_HOME", label: "House / Villa", icon: Home, description: "Independent house, bungalow or villa" },
  { value: "APARTMENT", label: "Apartment", icon: Building, description: "Standalone building or builder floor" },
  { value: "COMMERCIAL_PROPERTY", label: "Office", icon: Building2, description: "Commercial space or office park" },
];

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
  const [resolving, setResolving] = useState(false);
  const [resolutionResult, setResolutionResult] = useState<{
    serviceable: boolean;
    status: string;
    rejectionReason?: string;
    zoneName?: string;
    branchName?: string;
  } | null>(null);

  const [customLabel, setCustomLabel] = useState(
    SITE_PRESETS.includes(value.serviceLocationLabel as typeof SITE_PRESETS[number])
      ? ""
      : value.serviceLocationLabel,
  );

  const preset = SITE_PRESETS.includes(value.serviceLocationLabel as typeof SITE_PRESETS[number])
    ? value.serviceLocationLabel
    : "Other";

  const selectedPropertyType = value.propertyType || "INDIVIDUAL_HOME";

  // Real-time location resolution & serviceability evaluation
  useEffect(() => {
    const lat = parseFloat(value.latitude);
    const lng = parseFloat(value.longitude);
    const hasCoords = hasFiniteCoordinates(lat, lng);
    if (!hasCoords && !value.city.trim() && !value.area.trim()) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setResolving(true);
      try {
        const res = await fetch("/api/location/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: hasCoords ? lat : undefined,
            longitude: hasCoords ? lng : undefined,
            city: value.city || undefined,
            locality: value.area || undefined,
            societyName: value.buildingName || undefined,
            propertyType: selectedPropertyType,
            placeId: value.placeId || undefined,
            pincode: value.pincode || undefined,
          }),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          const isServiceable = data.serviceability?.serviceable ?? false;
          setResolutionResult({
            serviceable: isServiceable,
            status: data.resolutionStatus,
            rejectionReason: data.serviceability?.rejectionReason,
            zoneName: data.zone?.name,
            branchName: data.branch?.name,
          });
          onChange({
            zoneId: data.zone?.id ?? null,
            branchId: data.branch?.id ?? null,
            localityId: data.locality?.id ?? null,
            societyId: data.society?.id ?? null,
            serviceabilityStatus: isServiceable ? "serviceable" : (data.serviceability?.status ?? "not_serviceable"),
            resolutionStatus: data.resolutionStatus,
          });
        }
      } catch {
        // Ignore background resolution network failures
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value.latitude, value.longitude, value.city, value.area, value.buildingName, selectedPropertyType]);

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
        <div className="space-y-4">
          {/* Property Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Property Type</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Property Type">
              {PROPERTY_TYPES.map(pt => {
                const Icon = pt.icon;
                const isSelected = selectedPropertyType === pt.value;
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => onChange({ propertyType: pt.value })}
                    data-testid={`${idPrefix}-prop-${pt.value.toLowerCase()}`}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-xs"
                        : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 mb-1 shrink-0" />
                    <span className="text-xs font-semibold leading-tight">{pt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contextual Progressive Address Fields */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Help our team find you</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedPropertyType === "GATED_SOCIETY"
                  ? "Enter your society, tower, and flat number."
                  : selectedPropertyType === "INDIVIDUAL_HOME"
                    ? "Enter your house/plot number and area details."
                    : "Add building and unit information."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* If Gated Society or Apartment, show Tower */}
              {selectedPropertyType === "GATED_SOCIETY" ? (
                <>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`${idPrefix}-building`} className="text-xs">
                      Gated Society / Complex Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`${idPrefix}-building`}
                      data-testid={`${idPrefix}-building`}
                      value={value.buildingName}
                      onChange={e => onChange({ buildingName: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. ATS Knightsbridge, Supertech Capetown"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${idPrefix}-tower`} className="text-xs">
                      Tower / Block / Wing
                    </Label>
                    <Input
                      id={`${idPrefix}-tower`}
                      data-testid={`${idPrefix}-tower`}
                      value={value.tower || ""}
                      onChange={e => onChange({ tower: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. Tower 4, Block B"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${idPrefix}-house`} className="text-xs">
                      Flat / Unit No. <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`${idPrefix}-house`}
                      data-testid={`${idPrefix}-house`}
                      value={value.houseNumber}
                      onChange={e => onChange({ houseNumber: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. Flat 1102, C-304"
                      autoComplete="address-line2"
                    />
                  </div>
                </>
              ) : selectedPropertyType === "APARTMENT" ? (
                <>
                  <div>
                    <Label htmlFor={`${idPrefix}-building`} className="text-xs">
                      Building / Apartment Name
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
                  <div>
                    <Label htmlFor={`${idPrefix}-house`} className="text-xs">
                      Flat / Floor No. <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`${idPrefix}-house`}
                      data-testid={`${idPrefix}-house`}
                      value={value.houseNumber}
                      onChange={e => onChange({ houseNumber: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. 2nd Floor, Flat 2B"
                    />
                  </div>
                </>
              ) : selectedPropertyType === "COMMERCIAL_PROPERTY" ? (
                <>
                  <div>
                    <Label htmlFor={`${idPrefix}-building`} className="text-xs">
                      Office / Complex Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`${idPrefix}-building`}
                      data-testid={`${idPrefix}-building`}
                      value={value.buildingName}
                      onChange={e => onChange({ buildingName: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. Candor TechSpace, Logix Cyber Park"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${idPrefix}-house`} className="text-xs">
                      Floor / Suite / Unit <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`${idPrefix}-house`}
                      data-testid={`${idPrefix}-house`}
                      value={value.houseNumber}
                      onChange={e => onChange({ houseNumber: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. Ground Floor, Bay 12"
                    />
                  </div>
                </>
              ) : (
                /* Individual Home */
                <>
                  <div>
                    <Label htmlFor={`${idPrefix}-house`} className="text-xs">
                      House / Villa / Plot No. <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`${idPrefix}-house`}
                      data-testid={`${idPrefix}-house`}
                      value={value.houseNumber}
                      onChange={e => onChange({ houseNumber: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. House No. 42, Plot 15"
                      autoComplete="address-line2"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${idPrefix}-building`} className="text-xs">
                      Kothi / Bungalow / Estate Name (optional)
                    </Label>
                    <Input
                      id={`${idPrefix}-building`}
                      data-testid={`${idPrefix}-building`}
                      value={value.buildingName}
                      onChange={e => onChange({ buildingName: e.target.value })}
                      className="mt-1 h-11"
                      placeholder="e.g. Shanti Niwas"
                    />
                  </div>
                </>
              )}

              {/* Area / Locality */}
              {(!value.area.trim() || !mapsEnabled) && (
                <div className="sm:col-span-2">
                  <Label htmlFor={`${idPrefix}-area`} className="text-xs">
                    Sector / Area / Locality {!mapsEnabled && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id={`${idPrefix}-area`}
                    data-testid={`${idPrefix}-area`}
                    value={value.area}
                    onChange={e => onChange({ area: e.target.value })}
                    className="mt-1 h-11"
                    placeholder="e.g. Sector 50, Gomti Nagar, Lanka"
                  />
                </div>
              )}

              {/* Landmark */}
              <div className="sm:col-span-2">
                <Label htmlFor={`${idPrefix}-landmark`} className="text-xs">Landmark</Label>
                <Input
                  id={`${idPrefix}-landmark`}
                  data-testid={`${idPrefix}-landmark`}
                  value={value.landmark}
                  onChange={e => onChange({ landmark: e.target.value })}
                  className="mt-1 h-11"
                  placeholder="e.g. Near Community Park or Main Gate"
                />
              </div>

              {/* City & Pincode when not detected */}
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
                      placeholder="201301"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Live Serviceability & Zone Coverage Status */}
          <div className="pt-1">
            {resolving ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Checking CWP doorstep serviceability in this location…</span>
              </div>
            ) : resolutionResult ? (
              resolutionResult.serviceable ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-950 dark:text-emerald-200"
                  data-testid={`${idPrefix}-serviceable-badge`}
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                      Serviceable by CWP Detailers
                    </p>
                    <p className="text-emerald-800/80 dark:text-emerald-300/80">
                      Doorstep Detailing & Daily Cleaning are active in your area
                      {resolutionResult.zoneName ? ` (${resolutionResult.zoneName})` : ""}.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-950 dark:text-amber-200"
                  data-testid={`${idPrefix}-waitlist-badge`}
                >
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-amber-900 dark:text-amber-300">
                      Expanding to this area soon
                    </p>
                    <p className="text-amber-800/80 dark:text-amber-300/80">
                      {resolutionResult.rejectionReason || "Regular doorstep slots are not yet active for this specific property type/zone."}{" "}
                      Save this address to join our priority waitlist and get first access!
                    </p>
                  </div>
                </div>
              )
            ) : null}
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
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 px-5 py-3.5 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-20">
          <Button
            type="button"
            className="w-full h-12 text-sm font-semibold rounded-xl shadow-xs"
            disabled={!saveReady || submitting}
            onClick={onSubmit}
            data-testid="btn-save-address"
          >
            {submitting ? "Saving…" : ctaLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
