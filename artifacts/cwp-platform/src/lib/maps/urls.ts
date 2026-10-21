/** Google Maps deep-link helpers (no API key required). */

export function mapsViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function isValidMapCoordinate(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function buildMapsUrl(lat: number, lng: number, address?: string | null): string | null {
  if (isValidMapCoordinate(lat, lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const cleanAddr = address?.trim();
  if (cleanAddr) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddr)}`;
  }
  return null;
}

export function buildNavigateUrl(job: {
  locationLat?: number | null;
  locationLng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  area?: string | null;
}): string | null {
  const lat = job.locationLat ?? job.latitude;
  const lng = job.locationLng ?? job.longitude;
  if (isValidMapCoordinate(lat, lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const full = [job.area, job.address].filter(Boolean).map(s => s?.trim()).filter(Boolean).join(", ").trim();
  if (full) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(full)}`;
  }
  return null;
}

export function canNavigateTo(job: {
  locationLat?: number | null;
  locationLng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  area?: string | null;
}): boolean {
  const lat = job.locationLat ?? job.latitude;
  const lng = job.locationLng ?? job.longitude;
  if (isValidMapCoordinate(lat, lng)) return true;
  return Boolean((job.address && job.address.trim()) || (job.area && job.area.trim()));
}
