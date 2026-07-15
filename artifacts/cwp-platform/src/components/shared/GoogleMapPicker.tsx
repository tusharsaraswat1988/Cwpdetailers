import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation } from "lucide-react";
import {
  DEFAULT_MAP_CENTER,
  loadGoogleMaps,
  type GoogleMapsNamespace,
} from "@/lib/maps/loadGoogleMaps";
import type { LocationValue } from "@/features/master-data/api";

type Props = {
  value: LocationValue | null;
  onChange: (loc: LocationValue) => void;
  className?: string;
  /** Tailwind height class for the map canvas. Default h-56; use h-40 in sheets. */
  mapHeightClass?: string;
};

export function GoogleMapPicker({ value, onChange, className, mapHeightClass = "h-56" }: Props) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState(value?.address ?? "");

  useEffect(() => {
    if (value?.address) setSearchText(value.address);
  }, [value?.address]);

  useEffect(() => {
    let cancelled = false;

    const reverseGeocode = (
      maps: GoogleMapsNamespace,
      lat: number,
      lng: number,
      placeId?: string,
    ) => {
      const geocoder = new maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (cancelled) return;
        const top = status === "OK" ? results?.[0] : null;
        const address = top?.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSearchText(address);
        onChangeRef.current({
          address,
          latitude: lat,
          longitude: lng,
          placeId: placeId ?? top?.place_id,
        });
      });
    };

    const emitCoords = (lat: number, lng: number, address?: string, placeId?: string) => {
      if (address) {
        setSearchText(address);
        onChangeRef.current({ address, latitude: lat, longitude: lng, placeId });
        return;
      }
      const maps = mapsRef.current;
      if (maps) reverseGeocode(maps, lat, lng, placeId);
      else {
        const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSearchText(fallback);
        onChangeRef.current({ address: fallback, latitude: lat, longitude: lng, placeId });
      }
    };

    (async () => {
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !maps || !mapElRef.current) {
          if (!cancelled && !maps) setError("Google Maps is not configured");
          return;
        }
        mapsRef.current = maps;

        const start = value
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

        maps.event.addListener(marker, "dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          emitCoords(pos.lat(), pos.lng());
        });

        maps.event.addListener(map, "click", (...args: unknown[]) => {
          const event = args[0] as { latLng?: { lat: () => number; lng: () => number } } | undefined;
          const latLng = event?.latLng;
          if (!latLng) return;
          const lat = latLng.lat();
          const lng = latLng.lng();
          marker.setPosition({ lat, lng });
          emitCoords(lat, lng);
        });

        if (searchRef.current) {
          const autocomplete = new maps.places.Autocomplete(searchRef.current, {
            fields: ["formatted_address", "geometry", "place_id"],
            componentRestrictions: { country: "in" },
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const loc = place.geometry?.location;
            if (!loc) return;
            const lat = loc.lat();
            const lng = loc.lng();
            map.panTo({ lat, lng });
            map.setZoom(17);
            marker.setPosition({ lat, lng });
            emitCoords(lat, lng, place.formatted_address, place.place_id);
          });
        }

        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load map");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Initialize once; subsequent value sync is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !value || !mapRef.current || !markerRef.current) return;
    const pos = { lat: value.latitude, lng: value.longitude };
    markerRef.current.setPosition(pos);
    mapRef.current.panTo(pos);
  }, [ready, value?.latitude, value?.longitude]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(17);
        markerRef.current?.setPosition({ lat, lng });
        const maps = mapsRef.current;
        if (maps) {
          const geocoder = new maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            const top = status === "OK" ? results?.[0] : null;
            const address = top?.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setSearchText(address);
            onChange({ address, latitude: lat, longitude: lng, placeId: top?.place_id });
            setLocating(false);
          });
        } else {
          const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setSearchText(address);
          onChange({ address, latitude: lat, longitude: lng });
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Input
        ref={searchRef}
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        placeholder="Search address or landmark"
        data-testid="input-map-search"
        autoComplete="off"
      />
      <div
        ref={mapElRef}
        className={`${mapHeightClass} w-full rounded-xl border border-border overflow-hidden bg-muted`}
        data-testid="google-map-picker"
      />
      {!ready && !error && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Loading map…
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        Search, tap the map, or drag the pin to set the exact service location.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={useCurrentLocation}
        disabled={locating || !ready}
        className="gap-1.5"
      >
        {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
        Use current location
      </Button>
    </div>
  );
}
