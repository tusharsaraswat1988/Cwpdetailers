import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search,
  MapPin,
  Crosshair,
  Maximize2,
  Sliders,
  Loader2,
  X,
  RotateCcw,
  Navigation,
  Radio,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Known Indian operating and expansion city center coordinates
export const CITY_COORDINATES: Record<string, [number, number]> = {
  noida: [28.5355, 77.3910],
  "greater noida": [28.4744, 77.5040],
  varanasi: [25.3176, 82.9739],
  ghaziabad: [28.6692, 77.4538],
  gurugram: [28.4595, 77.0266],
  gurgaon: [28.4595, 77.0266],
  delhi: [28.6139, 77.2090],
  "new delhi": [28.6139, 77.2090],
  lucknow: [26.8467, 80.9462],
  kanpur: [26.4499, 80.3319],
  prayagraj: [25.4358, 81.8463],
  allahabad: [25.4358, 81.8463],
  agra: [27.1767, 78.0081],
  meerut: [28.9845, 77.7064],
  faridabad: [28.4089, 77.3178],
};

export function getCityCenterCoordinates(cityName?: string): [number, number] {
  if (!cityName) return CITY_COORDINATES.noida;
  const key = cityName.trim().toLowerCase();

  // Exact match first
  if (CITY_COORDINATES[key]) {
    return CITY_COORDINATES[key];
  }

  // Longest key match first so e.g. "greater noida" matches before "noida"
  const sortedKeys = Object.keys(CITY_COORDINATES).sort((a, b) => b.length - a.length);
  for (const cityKey of sortedKeys) {
    if (key.includes(cityKey) || cityKey.includes(key)) {
      return CITY_COORDINATES[cityKey];
    }
  }
  return CITY_COORDINATES.noida;
}

export type ZoneMapLocation = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  suggestedName?: string;
  suggestedDescription?: string;
};

export type ZoneMapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  cityName?: string;
  onChange: (location: ZoneMapLocation) => void;
  className?: string;
  heightClass?: string;
};

type SearchResultItem = {
  id: string;
  displayName: string;
  primary: string;
  secondary: string;
  lat: number;
  lng: number;
};

// Custom SVG high-visibility marker icon with pulsing radar beacon
const createZoneCenterIcon = () =>
  L.divIcon({
    className: "custom-zone-marker",
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; transform: translate(-2px, -6px);">
        <!-- Pulsing radar ring -->
        <span style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: rgba(37, 99, 235, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <!-- Outer pin drop shadow -->
        <div style="position: relative; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.45); border: 2.5px solid white;">
          <!-- Inner white dot -->
          <div style="width: 10px; height: 10px; border-radius: 50%; background: white; transform: rotate(45deg); box-shadow: inset 0 1px 2px rgba(0,0,0,0.25);"></div>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 40],
    popupAnchor: [0, -36],
  });

export function ZoneMapPicker({
  latitude,
  longitude,
  radiusMeters = 5000,
  cityName,
  onChange,
  className,
  heightClass = "h-[300px] sm:h-[340px]",
}: ZoneMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const isDraggingRef = useRef(false);

  // Active coordinates
  const defaultCityCoords = getCityCenterCoordinates(cityName);
  const activeLat = latitude && Number.isFinite(latitude) && latitude !== 0 ? latitude : defaultCityCoords[0];
  const activeLng = longitude && Number.isFinite(longitude) && longitude !== 0 ? longitude : defaultCityCoords[1];
  const activeRadius = radiusMeters && Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 5000;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [reverseGeocodedAddress, setReverseGeocodedAddress] = useState<string | null>(null);

  // Manual inputs local state
  const [localLat, setLocalLat] = useState(String(activeLat));
  const [localLng, setLocalLng] = useState(String(activeLng));
  const [localRadius, setLocalRadius] = useState(String(activeRadius));

  // Keep local inputs in sync when props change
  useEffect(() => {
    setLocalLat(String(activeLat));
    setLocalLng(String(activeLng));
    setLocalRadius(String(activeRadius));
  }, [activeLat, activeLng, activeRadius]);

  // Radius preset options
  const radiusPresets = [
    { label: "1 km", value: 1000 },
    { label: "2 km", value: 2000 },
    { label: "3 km", value: 3000 },
    { label: "5 km (Standard)", value: 5000 },
    { label: "8 km", value: 8000 },
    { label: "10 km", value: 10000 },
    { label: "15 km", value: 15000 },
  ];

  // Calculate approximate covered surface area in sq km: π * r²
  const areaSqKm = (Math.PI * Math.pow(activeRadius / 1000, 2)).toFixed(1);

  // Reverse geocode coordinates to get address / landmark
  const fetchReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
        const res = await fetch(url, {
          headers: { "User-Agent": "CWP-Detailers-Platform/1.0" },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.display_name) {
          const parts: string[] = [];
          if (data.address?.suburb) parts.push(data.address.suburb);
          else if (data.address?.neighbourhood) parts.push(data.address.neighbourhood);
          else if (data.address?.road) parts.push(data.address.road);

          if (data.address?.city) parts.push(data.address.city);
          else if (data.address?.town) parts.push(data.address.town);
          else if (data.address?.state_district) parts.push(data.address.state_district);

          const summary = parts.length > 0 ? parts.join(", ") : data.display_name.split(",").slice(0, 3).join(", ");
          setReverseGeocodedAddress(summary);
          return { displayName: data.display_name, summary };
        }
      } catch (err) {
        console.warn("Reverse geocode failed:", err);
      }
      return null;
    },
    []
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [activeLat, activeLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Create Center Pin Marker
      const marker = L.marker([activeLat, activeLng], {
        icon: createZoneCenterIcon(),
        draggable: true,
        title: "Drag to set Zone Center",
      }).addTo(map);

      marker.bindTooltip(`Zone Center<br/>${activeLat.toFixed(4)}, ${activeLng.toFixed(4)}`, {
        direction: "top",
        offset: [0, -28],
        opacity: 0.9,
      });

      // Create Geofence Circle
      const circle = L.circle([activeLat, activeLng], {
        radius: activeRadius,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.14,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(map);

      circle.bindTooltip(`Service Radius: ${(activeRadius / 1000).toFixed(1)} km`, {
        sticky: true,
        opacity: 0.85,
      });

      // Handle marker drag
      marker.on("dragstart", () => {
        isDraggingRef.current = true;
      });

      marker.on("drag", () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
      });

      marker.on("dragend", async () => {
        isDraggingRef.current = false;
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        marker.setTooltipContent(`Zone Center<br/>${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);

        const geo = await fetchReverseGeocode(pos.lat, pos.lng);
        onChange({
          latitude: Number(pos.lat.toFixed(6)),
          longitude: Number(pos.lng.toFixed(6)),
          radiusMeters: activeRadius,
          suggestedDescription: geo?.summary ? `Covers ${geo.summary} and surroundings` : undefined,
        });
      });

      // Handle map click to reposition center
      map.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        marker.setTooltipContent(`Zone Center<br/>${lat.toFixed(4)}, ${lng.toFixed(4)}`);

        const geo = await fetchReverseGeocode(lat, lng);
        onChange({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          radiusMeters: activeRadius,
          suggestedDescription: geo?.summary ? `Covers ${geo.summary} and surroundings` : undefined,
        });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      // Invalidate size once rendered (especially within Radix dialogs)
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 250);

      return () => {
        clearTimeout(timer);
      };
    } catch (err) {
      console.error("Leaflet initialization failed in ZoneMapPicker:", err);
    }
  }, []);

  // Update map pin & circle when props change externally
  useEffect(() => {
    if (!mapInstanceRef.current || isDraggingRef.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([activeLat, activeLng]);
      markerRef.current.setTooltipContent(`Zone Center<br/>${activeLat.toFixed(4)}, ${activeLng.toFixed(4)}`);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([activeLat, activeLng]);
      circleRef.current.setRadius(activeRadius);
      circleRef.current.setTooltipContent(`Service Radius: ${(activeRadius / 1000).toFixed(1)} km`);
    }
  }, [activeLat, activeLng, activeRadius]);

  // When city changes and no custom coordinates exist, auto-center on the city
  useEffect(() => {
    if (!mapInstanceRef.current || !cityName) return;
    if (latitude && longitude && latitude !== 0 && longitude !== 0) return;

    const coords = getCityCenterCoordinates(cityName);
    mapInstanceRef.current.setView(coords, 13);
    if (markerRef.current) markerRef.current.setLatLng(coords);
    if (circleRef.current) circleRef.current.setLatLng(coords);

    onChange({
      latitude: coords[0],
      longitude: coords[1],
      radiusMeters: activeRadius,
    });
  }, [cityName]);

  // Handle container resizing (e.g. Radix dialog open / maximize)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, []);

  // Place search via Nominatim
  const handleSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      // Append city name if not already in query for higher relevance
      let fullQuery = q;
      if (cityName && !q.toLowerCase().includes(cityName.toLowerCase())) {
        fullQuery = `${q}, ${cityName}`;
      }

      const encoded = encodeURIComponent(fullQuery);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=in&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "CWP-Detailers-Platform/1.0" },
      });

      if (!res.ok) throw new Error("Search request failed");
      const items = await res.json();

      if (Array.isArray(items) && items.length > 0) {
        const parsed: SearchResultItem[] = items.map((item: any) => {
          const parts = (item.display_name || "").split(",");
          const primary = parts[0]?.trim() || item.name || q;
          const secondary = parts.slice(1, 4).join(",").trim();

          return {
            id: String(item.place_id || item.osm_id),
            displayName: item.display_name,
            primary,
            secondary,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          };
        });
        setSearchResults(parsed);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.warn("Location search error:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search on typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Select place from search results
  const selectSearchResult = (item: SearchResultItem) => {
    setSearchQuery(item.primary);
    setShowSearchResults(false);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lng], 14, {
        animate: true,
        duration: 1.2,
      });
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([item.lat, item.lng]);
      markerRef.current.setTooltipContent(`Zone Center<br/>${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([item.lat, item.lng]);
    }

    const suggestedDesc = `Covers ${item.primary}${item.secondary ? `, ${item.secondary}` : ""} and surrounding societies`;
    setReverseGeocodedAddress(item.primary);

    onChange({
      latitude: Number(item.lat.toFixed(6)),
      longitude: Number(item.lng.toFixed(6)),
      radiusMeters: activeRadius,
      suggestedName: item.primary.length <= 30 ? `${item.primary} Zone` : undefined,
      suggestedDescription: suggestedDesc,
    });
  };

  // Fit view to circular boundary
  const fitCircleBounds = () => {
    if (!mapInstanceRef.current || !circleRef.current) return;
    const bounds = circleRef.current.getBounds();
    mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
  };

  // Jump to user's current GPS location
  const locateCurrentPosition = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 14, { animate: true, duration: 1 });
        }

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          markerRef.current.setTooltipContent(`Zone Center<br/>${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }

        if (circleRef.current) {
          circleRef.current.setLatLng([lat, lng]);
        }

        const geo = await fetchReverseGeocode(lat, lng);
        onChange({
          latitude: lat,
          longitude: lng,
          radiusMeters: activeRadius,
          suggestedDescription: geo?.summary ? `Covers ${geo.summary} and surroundings` : undefined,
        });
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation lookup error:", err.message);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Re-center on city
  const centerOnCity = () => {
    const coords = getCityCenterCoordinates(cityName);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(coords, 13, { animate: true, duration: 0.8 });
    }
    if (markerRef.current) markerRef.current.setLatLng(coords);
    if (circleRef.current) circleRef.current.setLatLng(coords);

    onChange({
      latitude: coords[0],
      longitude: coords[1],
      radiusMeters: activeRadius,
    });
  };

  // Update radius
  const handleRadiusChange = (newRadius: number) => {
    if (circleRef.current) {
      circleRef.current.setRadius(newRadius);
      circleRef.current.setTooltipContent(`Service Radius: ${(newRadius / 1000).toFixed(1)} km`);
    }
    onChange({
      latitude: activeLat,
      longitude: activeLng,
      radiusMeters: newRadius,
    });
  };

  // Handle manual input apply
  const handleApplyManualInputs = () => {
    const lat = parseFloat(localLat);
    const lng = parseFloat(localLng);
    const rad = parseInt(localRadius, 10);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 14);
      }
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
        if (Number.isFinite(rad) && rad > 0) {
          circleRef.current.setRadius(rad);
        }
      }
      onChange({
        latitude: lat,
        longitude: lng,
        radiusMeters: Number.isFinite(rad) && rad > 0 ? rad : activeRadius,
      });
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search Bar & Map Controls Header */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              placeholder={`Search area, sector, landmark in ${cityName || "city"} (e.g. Sector 137, Sigra)…`}
              className="pl-9 pr-9 h-9.5 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-2.5 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={locateCurrentPosition}
            disabled={isLocating}
            className="h-9.5 px-3 shrink-0 text-xs gap-1.5"
            title="Locate my position on map"
          >
            {isLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5 text-primary" />}
            <span className="hidden sm:inline">My Location</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={centerOnCity}
            className="h-9.5 px-2.5 shrink-0 text-xs gap-1"
            title={`Center on ${cityName || "City"}`}
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">{cityName || "City"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fitCircleBounds}
            className="h-9.5 px-2.5 shrink-0 text-xs gap-1"
            title="Fit whole zone boundary in view"
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Fit Zone</span>
          </Button>
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-[1000] left-0 right-0 top-11 bg-popover border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSearchResult(item)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-accent/60 transition-colors border-b last:border-b-0 flex items-start gap-2.5"
              >
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground truncate">{item.primary}</div>
                  {item.secondary && (
                    <div className="text-[11px] text-muted-foreground truncate">{item.secondary}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Leaflet Map Viewport */}
      <div className="relative rounded-xl border overflow-hidden shadow-xs bg-muted/20">
        <div ref={mapContainerRef} className={cn("w-full z-0", heightClass)} />

        {/* Live Map Guidance Badge Overlay */}
        <div className="absolute top-2.5 left-2.5 z-[400] pointer-events-none">
          <Badge
            variant="secondary"
            className="bg-background/90 backdrop-blur-xs text-[11px] font-medium shadow-xs border text-foreground/90 gap-1.5 py-1 px-2.5"
          >
            <Crosshair className="h-3 w-3 text-primary animate-pulse" />
            <span>Click map or drag blue pin to set center</span>
          </Badge>
        </div>

        {/* Current Center & Landmark Overlay */}
        {reverseGeocodedAddress && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[400] pointer-events-none">
            <div className="bg-background/95 backdrop-blur-xs rounded-lg border p-2 shadow-xs text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground shrink-0">Selected Area:</span>
                <span className="text-muted-foreground truncate">{reverseGeocodedAddress}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {activeLat.toFixed(4)}, {activeLng.toFixed(4)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Radius Geofence Controller */}
      <div className="rounded-xl border bg-card/60 p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Operational Service Radius</span>
            <Badge variant="outline" className="text-[11px] font-mono font-semibold bg-primary/5 text-primary border-primary/20">
              {(activeRadius / 1000).toFixed(1)} km ({activeRadius.toLocaleString()}m)
            </Badge>
          </div>

          <div className="text-[11px] text-muted-foreground">
            Coverage Area: <span className="font-semibold text-foreground">~{areaSqKm} km²</span>
          </div>
        </div>

        {/* Radius Slider */}
        <div className="space-y-1.5 pt-1">
          <Slider
            value={[activeRadius]}
            min={500}
            max={20000}
            step={250}
            onValueChange={([val]) => handleRadiusChange(val)}
            className="w-full cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-0.5">
            <span>500m</span>
            <span>5 km</span>
            <span>10 km</span>
            <span>15 km</span>
            <span>20 km</span>
          </div>
        </div>

        {/* Quick Radius Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
          {radiusPresets.map((preset) => {
            const isSelected = activeRadius === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleRadiusChange(preset.value)}
                className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-md border transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                    : "bg-background hover:bg-muted text-muted-foreground border-border"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Precision Coordinates Fine-Tuning */}
      <div className="rounded-xl border border-border/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManualInputs((prev) => !prev)}
          className="w-full px-3.5 py-2 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between text-xs font-medium text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <Sliders className="h-3.5 w-3.5 text-primary" />
            <span>GPS Coordinates & Manual Fine-Tuning</span>
            <span className="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border">
              {activeLat.toFixed(5)}, {activeLng.toFixed(5)}
            </span>
          </div>
          {showManualInputs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showManualInputs && (
          <div className="p-3.5 space-y-3 bg-card border-t">
            <p className="text-[11px] text-muted-foreground">
              Directly enter surveyor or GPS coordinates if you have exact decimal values. Coordinates update the map pin automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px]">Center Latitude</Label>
                <Input
                  value={localLat}
                  onChange={(e) => setLocalLat(e.target.value)}
                  placeholder="28.5355"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Center Longitude</Label>
                <Input
                  value={localLng}
                  onChange={(e) => setLocalLng(e.target.value)}
                  placeholder="77.3910"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Radius (Meters)</Label>
                <Input
                  value={localRadius}
                  onChange={(e) => setLocalRadius(e.target.value)}
                  placeholder="5000"
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleApplyManualInputs}
                className="h-7.5 text-xs px-3"
              >
                Apply Coordinates to Map
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
