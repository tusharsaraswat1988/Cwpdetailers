import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, Phone, MapPin, Clock, AlertTriangle, RefreshCw, Radio } from "lucide-react";
import { CustomerCard } from "@/features/customer-ds";

export type LiveTrackingData = {
  trackingActive: boolean;
  isEnRoute: boolean;
  status: string;
  technicianName?: string | null;
  technicianPhone?: string | null;
  enRouteAt?: string | null;
  etaMinutes?: number | null;
  estimatedArrivalAt?: string | null;
  lastLocationUpdateAt?: string | null;
  technicianLatitude?: number | null;
  technicianLongitude?: number | null;
  destLatitude?: number | null;
  destLongitude?: number | null;
  destAddress?: string | null;
  routePolyline?: [number, number][] | null;
  isStale?: boolean;
  fallbackMessage?: string | null;
  message?: string | null;
};

export type CustomerLiveTrackingMapProps = {
  tracking: LiveTrackingData;
  onRefresh?: () => void;
};

// Custom SVG Icons using L.divIcon
const createTechIcon = () =>
  L.divIcon({
    className: "custom-tech-pin",
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: rgba(16, 185, 129, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; background-color: #059669; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); border: 2px solid white;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.2V16c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

const createDestIcon = () =>
  L.divIcon({
    className: "custom-dest-pin",
    html: `
      <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #2563eb; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); border: 2px solid white;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

export const CustomerLiveTrackingMap: React.FC<CustomerLiveTrackingMapProps> = ({
  tracking,
  onRefresh,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ tech?: L.Marker; dest?: L.Marker; polyline?: L.Polyline }>({});
  const [mapError, setMapError] = useState<string | null>(null);

  const hasTechCoords =
    tracking.technicianLatitude != null &&
    tracking.technicianLongitude != null &&
    tracking.technicianLatitude !== 0 &&
    tracking.technicianLongitude !== 0;

  const hasDestCoords =
    tracking.destLatitude != null &&
    tracking.destLongitude != null &&
    tracking.destLatitude !== 0 &&
    tracking.destLongitude !== 0;

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!hasTechCoords && !hasDestCoords) return;

    try {
      // Initialize Leaflet map if not already created
      if (!mapInstanceRef.current) {
        const initialCenter: [number, number] = hasTechCoords
          ? [tracking.technicianLatitude!, tracking.technicianLongitude!]
          : [tracking.destLatitude!, tracking.destLongitude!];

        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Update Destination Marker
      if (hasDestCoords) {
        const destLatLng: [number, number] = [tracking.destLatitude!, tracking.destLongitude!];
        if (markersRef.current.dest) {
          markersRef.current.dest.setLatLng(destLatLng);
        } else {
          markersRef.current.dest = L.marker(destLatLng, { icon: createDestIcon() })
            .bindPopup(tracking.destAddress ?? "Service Location")
            .addTo(map);
        }
      } else if (markersRef.current.dest) {
        map.removeLayer(markersRef.current.dest);
        delete markersRef.current.dest;
      }

      // Update Technician Marker
      if (hasTechCoords) {
        const techLatLng: [number, number] = [tracking.technicianLatitude!, tracking.technicianLongitude!] as [number, number];
        if (markersRef.current.tech) {
          markersRef.current.tech.setLatLng(techLatLng);
        } else {
          markersRef.current.tech = L.marker(techLatLng, { icon: createTechIcon() })
            .bindPopup(tracking.technicianName ? `${tracking.technicianName} (En Route)` : "Technician")
            .addTo(map);
        }
      } else if (markersRef.current.tech) {
        map.removeLayer(markersRef.current.tech);
        delete markersRef.current.tech;
      }

      // Update Route Polyline
      if (hasTechCoords && hasDestCoords) {
        const polylineCoords: [number, number][] = [
          [tracking.technicianLatitude!, tracking.technicianLongitude!],
          [tracking.destLatitude!, tracking.destLongitude!],
        ];

        if (markersRef.current.polyline) {
          markersRef.current.polyline.setLatLngs(polylineCoords);
        } else {
          markersRef.current.polyline = L.polyline(polylineCoords, {
            color: "#059669",
            weight: 3.5,
            dashArray: "6, 8",
            opacity: 0.85,
          }).addTo(map);
        }

        const bounds = L.latLngBounds(polylineCoords);
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
      } else if (markersRef.current.polyline) {
        map.removeLayer(markersRef.current.polyline);
        delete markersRef.current.polyline;
      } else if (hasTechCoords) {
        map.setView([tracking.technicianLatitude!, tracking.technicianLongitude!], 15);
      } else if (hasDestCoords) {
        map.setView([tracking.destLatitude!, tracking.destLongitude!], 15);
      }
    } catch (err: any) {
      console.error("Leaflet map initialization error:", err);
      setMapError("Unable to render interactive map");
    }

    return () => {
      // We keep the map instance alive while mounted
    };
  }, [
    tracking.technicianLatitude,
    tracking.technicianLongitude,
    tracking.destLatitude,
    tracking.destLongitude,
    hasTechCoords,
    hasDestCoords,
  ]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <CustomerCard className="border-emerald-500/30 bg-emerald-500/5 overflow-hidden p-0">
      {/* Header Info */}
      <div className="p-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="relative flex h-3 w-3 mt-1 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Navigation size={14} className="text-emerald-600 dark:text-emerald-400" />
                {tracking.technicianName ? `${tracking.technicianName} is on the way` : "Technician is on the way"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tracking.etaMinutes
                  ? `Estimated arrival: ~${tracking.etaMinutes} mins (${new Date(tracking.estimatedArrivalAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
                  : tracking.fallbackMessage ?? "Technician is on the way. Tracking details will update upon arrival."}
              </p>
            </div>
          </div>
          {tracking.technicianPhone && (
            <a
              href={`tel:${tracking.technicianPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shrink-0 shadow-sm"
              data-testid="btn-call-en-route"
            >
              <Phone size={12} /> Call
            </a>
          )}
        </div>

        {/* Stale location warning if no ping in > 3 minutes */}
        {tracking.isStale && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
            <AlertTriangle size={12} className="shrink-0" />
            <span>GPS update delayed ({">"} 3 mins). Signal may be weak or technician is in transit.</span>
          </div>
        )}
      </div>

      {/* Interactive Map View */}
      {(hasTechCoords || hasDestCoords) && !mapError ? (
        <div className="relative w-full h-[220px] bg-muted border-t border-border/50">
          <div
            ref={mapContainerRef}
            className="w-full h-full z-0"
            data-testid="customer-live-tracking-map"
          />

          {/* Quick Legend & Refresh Floating Bar */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none z-[400]">
            <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-muted-foreground shadow pointer-events-auto">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Technician
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> Destination
              </span>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="bg-background/90 backdrop-blur-sm p-1.5 rounded-full text-muted-foreground hover:text-foreground shadow pointer-events-auto transition-colors"
                title="Refresh location"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Fallback when GPS coords are unavailable */
        <div className="px-3.5 py-3 border-t border-border/50 bg-background/50 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-emerald-500 animate-pulse" />
            <span>Live GPS map coordinates temporarily unavailable. Signal syncing.</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-primary hover:underline text-xs flex items-center gap-1"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          )}
        </div>
      )}

      {/* Footer Timestamp */}
      {tracking.lastLocationUpdateAt && (
        <div className="px-3.5 py-1.5 bg-muted/30 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            Updated {new Date(tracking.lastLocationUpdateAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          {tracking.destAddress && (
            <span className="truncate max-w-[180px] flex items-center gap-1">
              <MapPin size={10} /> {tracking.destAddress}
            </span>
          )}
        </div>
      )}
    </CustomerCard>
  );
};
