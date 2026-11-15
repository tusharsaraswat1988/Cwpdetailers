import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Shield, Pencil, Radio, Globe, Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCityCenterCoordinates } from "./ZoneMapPicker";

export type OperationalZone = {
  id: number;
  cityId: number;
  branchId: number | null;
  name: string;
  code: string;
  description: string | null;
  centerLatitude: string | null;
  centerLongitude: string | null;
  radiusMeters: number | null;
  status: "active" | "inactive" | "maintenance";
  createdAt: string;
};

type City = { id: number; name: string };
type Branch = { id: number; name: string; cityId?: number };

export type ZonesOverviewMapProps = {
  zones: OperationalZone[];
  cities: City[];
  branches: Branch[];
  activeCityName?: string;
  onEditZone: (zone: OperationalZone) => void;
  onManageRules: (zone: OperationalZone) => void;
  heightClass?: string;
};

// Create a custom marker icon for overview zones
const createOverviewZoneIcon = (code: string, status: string) => {
  const bgColor = status === "active" ? "#10B981" : status === "maintenance" ? "#F59E0B" : "#6B7280";
  return L.divIcon({
    className: "custom-overview-zone-pin",
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        <div style="background-color: ${bgColor}; color: white; font-weight: 700; font-size: 10px; font-family: monospace; padding: 2px 6px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1.5px solid white; white-space: nowrap;">
          ${code}
        </div>
        <div style="width: 2px; height: 6px; background-color: ${bgColor};"></div>
        <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${bgColor}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  });
};

export function ZonesOverviewMap({
  zones,
  cities,
  branches,
  activeCityName,
  onEditZone,
  onManageRules,
  heightClass = "h-[540px]",
}: ZonesOverviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const defaultCenter = getCityCenterCoordinates(activeCityName);
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      layersGroupRef.current = layersGroup;

      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 250);

      return () => {
        clearTimeout(timer);
      };
    } catch (err) {
      console.error("Failed to initialize ZonesOverviewMap:", err);
    }
  }, []);

  // Update Zone Markers and Circles on the map
  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;

    const group = layersGroupRef.current;
    group.clearLayers();

    const validZones = zones.filter(
      (z) => z.centerLatitude && z.centerLongitude && Number(z.centerLatitude) !== 0 && Number(z.centerLongitude) !== 0
    );

    const boundsPoints: [number, number][] = [];

    validZones.forEach((z) => {
      const lat = Number(z.centerLatitude);
      const lng = Number(z.centerLongitude);
      const radius = z.radiusMeters || 5000;
      const statusColor = z.status === "active" ? "#10B981" : z.status === "maintenance" ? "#F59E0B" : "#6B7280";

      boundsPoints.push([lat, lng]);

      // Draw coverage boundary circle
      const circle = L.circle([lat, lng], {
        radius,
        color: statusColor,
        fillColor: statusColor,
        fillOpacity: z.status === "active" ? 0.16 : 0.1,
        weight: 2,
        dashArray: z.status === "maintenance" ? "6, 6" : undefined,
      });

      // Draw center pin
      const marker = L.marker([lat, lng], {
        icon: createOverviewZoneIcon(z.code, z.status),
      });

      const cityName = cities.find((c) => c.id === z.cityId)?.name || `City #${z.cityId}`;
      const branchName = branches.find((b) => b.id === z.branchId)?.name || "Unassigned Branch";

      const popupContent = document.createElement("div");
      popupContent.className = "p-1 space-y-2 min-w-[210px]";
      popupContent.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
          <div>
            <span style="font-family: monospace; font-size: 10px; font-weight: 700; background: ${statusColor}1A; color: ${statusColor}; padding: 1px 6px; border-radius: 4px;">
              ${z.code}
            </span>
            <div style="font-weight: 700; font-size: 13px; color: #111827; margin-top: 4px;">${z.name}</div>
          </div>
          <span style="font-size: 10px; text-transform: uppercase; font-weight: 600; padding: 2px 6px; border-radius: 9999px; background: ${statusColor}22; color: ${statusColor};">
            ${z.status}
          </span>
        </div>
        ${z.description ? `<p style="font-size: 11px; color: #6B7280; margin: 4px 0;">${z.description}</p>` : ""}
        <div style="font-size: 11px; color: #4B5563; border-top: 1px solid #E5E7EB; padding-top: 6px; display: flex; flex-direction: column; gap: 3px;">
          <div><strong>City:</strong> ${cityName}</div>
          <div><strong>Branch:</strong> ${branchName}</div>
          <div><strong>Radius:</strong> ${(radius / 1000).toFixed(1)} km</div>
        </div>
        <div style="display: flex; gap: 6px; padding-top: 6px; border-top: 1px solid #E5E7EB;">
          <button id="btn-popup-rules-${z.id}" style="flex: 1; padding: 4px 8px; font-size: 11px; font-weight: 600; background: #2563EB; color: white; border-radius: 6px; border: none; cursor: pointer;">
            Rules
          </button>
          <button id="btn-popup-edit-${z.id}" style="padding: 4px 8px; font-size: 11px; font-weight: 600; background: #F3F4F6; color: #1F2937; border-radius: 6px; border: 1px solid #D1D5DB; cursor: pointer;">
            Edit
          </button>
        </div>
      `;

      // Attach event listeners after popup opens
      marker.bindPopup(popupContent);
      circle.bindPopup(popupContent);

      marker.on("popupopen", () => {
        const rulesBtn = document.getElementById(`btn-popup-rules-${z.id}`);
        const editBtn = document.getElementById(`btn-popup-edit-${z.id}`);
        if (rulesBtn) rulesBtn.onclick = () => onManageRules(z);
        if (editBtn) editBtn.onclick = () => onEditZone(z);
      });

      circle.on("popupopen", () => {
        const rulesBtn = document.getElementById(`btn-popup-rules-${z.id}`);
        const editBtn = document.getElementById(`btn-popup-edit-${z.id}`);
        if (rulesBtn) rulesBtn.onclick = () => onManageRules(z);
        if (editBtn) editBtn.onclick = () => onEditZone(z);
      });

      group.addLayer(circle);
      group.addLayer(marker);
    });

    // Auto-fit map bounds to encompass all plotted zones
    if (boundsPoints.length > 1) {
      const bounds = L.latLngBounds(boundsPoints);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else if (boundsPoints.length === 1) {
      mapInstanceRef.current.setView(boundsPoints[0], 13);
    } else if (activeCityName) {
      mapInstanceRef.current.setView(getCityCenterCoordinates(activeCityName), 12);
    }
  }, [zones, cities, branches, activeCityName]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layersGroupRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative rounded-2xl border overflow-hidden shadow-xs bg-muted/20">
      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0`} />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[400] bg-background/95 backdrop-blur-xs p-2.5 rounded-xl border shadow-sm text-xs space-y-1.5">
        <div className="font-semibold text-foreground text-[11px] mb-1">Coverage Status</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span className="text-[11px] text-muted-foreground">Active Zone</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span className="text-[11px] text-muted-foreground">Maintenance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />
          <span className="text-[11px] text-muted-foreground">Inactive</span>
        </div>
      </div>

      {/* Zone count overlay */}
      <div className="absolute top-4 right-4 z-[400]">
        <Badge variant="secondary" className="bg-background/90 backdrop-blur-xs shadow-xs border text-xs gap-1.5 py-1 px-3">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span>{zones.length} Zones in View</span>
        </Badge>
      </div>
    </div>
  );
}
