import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPinOff, Navigation } from "lucide-react";
import {
  DEFAULT_MAP_CENTER,
  loadGoogleMaps,
  type GoogleMapsNamespace,
} from "@/lib/maps/loadGoogleMaps";
import {
  nextGeocodeGeneration,
  resolvePlaceById,
  reverseGeocodePlace,
  searchPlaceSuggestions,
  type PlaceSuggestion,
  type ResolvedPlace,
} from "@/lib/maps/places";
import type { LocationValue } from "@/features/master-data/api";
import { isGoogleMapsConfigured } from "@/lib/maps";

type Props = {
  value: LocationValue | null;
  onChange: (loc: LocationValue, resolved?: ResolvedPlace) => void;
  className?: string;
  /** Tailwind height class for the map canvas. Default h-56; use h-40 in sheets. */
  mapHeightClass?: string;
  /** search-first hides the map until a place is chosen (customer UX). */
  layout?: "search-first" | "embedded";
  showMap?: boolean;
  searchPlaceholder?: string;
  autoFocusSearch?: boolean;
  onUnavailable?: () => void;
};

function toLocationValue(resolved: ResolvedPlace): LocationValue {
  return {
    address: resolved.formattedAddress,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    placeId: resolved.placeId,
    houseNumber: resolved.parts.houseNumber,
    buildingName: resolved.parts.buildingName,
    area: resolved.parts.area,
    cityName: resolved.parts.city,
    pincode: resolved.parts.pincode,
    googleComponents: resolved.googleComponents,
    formattedAddress: resolved.formattedAddress,
  };
}

export function GoogleMapPicker({
  value,
  onChange,
  className,
  mapHeightClass = "h-56",
  layout = "embedded",
  showMap = true,
  searchPlaceholder = "Search your address, building or landmark",
  autoFocusSearch,
  onUnavailable,
}: Props) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const mapRef = useRef<{
    setCenter: (c: { lat: number; lng: number }) => void;
    setZoom: (z: number) => void;
    panTo: (c: { lat: number; lng: number }) => void;
  } | null>(null);
  const markerRef = useRef<{
    setPosition: (c: { lat: number; lng: number }) => void;
    getPosition: () => { lat: () => number; lng: () => number } | null | undefined;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const draggingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const configured = isGoogleMapsConfigured();

  useEffect(() => {
    if (value?.formattedAddress) setSearchText(value.formattedAddress);
    else if (value?.address) setSearchText(value.address.replace(/\n/g, ", "));
  }, [value?.formattedAddress, value?.address]);

  useEffect(() => {
    if (!configured) {
      setError("not_configured");
      onUnavailable?.();
      return;
    }

    let cancelled = false;

    const emitResolved = (resolved: ResolvedPlace) => {
      onChangeRef.current(toLocationValue(resolved), resolved);
      setSearchText(resolved.formattedAddress);
    };

    (async () => {
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !maps || !mapElRef.current) {
          if (!cancelled && !maps) {
            setError("not_configured");
            onUnavailable?.();
          }
          return;
        }
        mapsRef.current = maps;

        const start = value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && (value.latitude !== 0 || value.longitude !== 0)
          ? { lat: value.latitude, lng: value.longitude }
          : DEFAULT_MAP_CENTER;

        const map = new maps.Map(mapElRef.current, {
          center: start,
          zoom: value ? 16 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;

        const marker = new maps.Marker({
          map,
          position: start,
          draggable: true,
          title: "Service location",
        });
        markerRef.current = marker;

        maps.event.addListener(marker, "dragstart", () => {
          draggingRef.current = true;
        });
        maps.event.addListener(marker, "dragend", async () => {
          draggingRef.current = false;
          const pos = marker.getPosition();
          if (!pos) return;
          const generation = nextGeocodeGeneration();
          const resolved = await reverseGeocodePlace(pos.lat(), pos.lng(), generation);
          if (resolved) emitResolved(resolved);
        });

        maps.event.addListener(map, "click", async (...args: unknown[]) => {
          const event = args[0] as { latLng?: { lat: () => number; lng: () => number } } | undefined;
          const latLng = event?.latLng;
          if (!latLng) return;
          const lat = latLng.lat();
          const lng = latLng.lng();
          marker.setPosition({ lat, lng });
          const generation = nextGeocodeGeneration();
          const resolved = await reverseGeocodePlace(lat, lng, generation);
          if (resolved) emitResolved(resolved);
        });

        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "failed");
          onUnavailable?.();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Initialize once; subsequent value sync is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  useEffect(() => {
    if (!ready || !value || !mapRef.current || !markerRef.current || draggingRef.current) return;
    if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return;
    if (value.latitude === 0 && value.longitude === 0) return;
    const pos = { lat: value.latitude, lng: value.longitude };
    markerRef.current.setPosition(pos);
    mapRef.current.panTo(pos);
  }, [ready, value?.latitude, value?.longitude]);

  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    if (value?.formattedAddress && q === value.formattedAddress) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const next = await searchPlaceSuggestions(q);
        if (!cancelled) {
          setSuggestions(next);
          setHighlight(0);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchText, value?.formattedAddress]);

  const applyResolved = (resolved: ResolvedPlace) => {
    setSuggestions([]);
    setSearchText(resolved.formattedAddress);
    mapRef.current?.panTo({ lat: resolved.latitude, lng: resolved.longitude });
    mapRef.current?.setZoom(17);
    markerRef.current?.setPosition({ lat: resolved.latitude, lng: resolved.longitude });
    onChange(toLocationValue(resolved), resolved);
  };

  const pickSuggestion = async (suggestion: PlaceSuggestion) => {
    const resolved = await resolvePlaceById(suggestion.id);
    if (resolved) applyResolved(resolved);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(17);
        markerRef.current?.setPosition({ lat, lng });
        const generation = nextGeocodeGeneration();
        const resolved = await reverseGeocodePlace(lat, lng, generation);
        if (resolved) applyResolved(resolved);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  if (error) {
    const devHint = !configured
      ? "Set VITE_GOOGLE_MAPS_API_KEY in the environment to enable maps."
      : error === "not_configured"
        ? "Maps API key is missing."
        : error;
    return (
      <div className={`space-y-2 ${className ?? ""}`} data-testid="google-map-unavailable">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <MapPinOff className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">Map unavailable</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You can still enter your address manually.
              </p>
              {import.meta.env.DEV && (
                <p className="text-[11px] text-amber-800 mt-1 font-mono" data-testid="maps-dev-error">
                  {devHint}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div ref={searchWrapRef} className="relative">
        <Input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder={searchPlaceholder}
          data-testid="input-map-search"
          autoComplete="off"
          autoFocus={autoFocusSearch}
          aria-label="Search your address, building or landmark"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          onKeyDown={e => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight(h => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight(h => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && suggestions[highlight]) {
              e.preventDefault();
              void pickSuggestion(suggestions[highlight]!);
            } else if (e.key === "Escape") {
              setSuggestions([]);
            }
          }}
        />
        {searching && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-background shadow-lg max-h-56 overflow-y-auto"
            data-testid="place-suggestions"
          >
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={`w-full text-left px-3 py-2.5 min-h-11 ${i === highlight ? "bg-primary/10" : "hover:bg-muted"}`}
                  onMouseDown={e => {
                    e.preventDefault();
                    void pickSuggestion(s);
                  }}
                >
                  <p className="text-sm font-medium truncate">{s.primary}</p>
                  {s.secondary && <p className="text-xs text-muted-foreground truncate">{s.secondary}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        ref={mapElRef}
        className={`${(layout === "embedded" || showMap) ? mapHeightClass : "h-px"} w-full rounded-xl border border-border overflow-hidden bg-muted ${(layout === "embedded" || showMap) ? "" : "opacity-0 pointer-events-none"}`}
        data-testid="google-map-picker"
        aria-hidden={!(layout === "embedded" || showMap)}
      />

      {!ready && !error && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Loading map…
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={useCurrentLocation}
        disabled={locating || !ready}
        className="gap-1.5 min-h-10"
        data-testid="btn-use-current-location"
      >
        {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
        Use my current location
      </Button>
    </div>
  );
}
