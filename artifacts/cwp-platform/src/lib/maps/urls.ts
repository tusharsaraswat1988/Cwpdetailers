/** Google Maps deep-link helpers (no API key required). */

export function mapsViewUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function buildMapsUrl(lat: number, lng: number, address?: string) {
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(address ?? "")}`;
}

export function buildNavigateUrl(job: {
  locationLat?: number | null;
  locationLng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  area?: string | null;
}) {
  const lat = job.locationLat ?? job.latitude;
  const lng = job.locationLng ?? job.longitude;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return buildMapsUrl(lat, lng);
  }
  const full = [job.area, job.address].filter(Boolean).join(", ");
  return `https://maps.google.com/?q=${encodeURIComponent(full)}`;
}

export function canNavigateTo(job: {
  locationLat?: number | null;
  locationLng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  area?: string | null;
}) {
  const lat = job.locationLat ?? job.latitude;
  const lng = job.locationLng ?? job.longitude;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) return true;
  return Boolean(job.address || job.area);
}
