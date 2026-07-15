/** Loads the Google Maps JavaScript API (Maps + Places) once per page. */

const MAPS_SCRIPT_ID = "cwp-google-maps-js";

/** Minimal Maps surface used by our picker (avoids @types/google.maps dependency). */
export type GoogleMapsNamespace = {
  Map: new (el: HTMLElement, opts?: Record<string, unknown>) => GoogleMap;
  Marker: new (opts?: Record<string, unknown>) => GoogleMarker;
  LatLng: new (lat: number, lng: number) => { lat: () => number; lng: () => number };
  Geocoder: new () => {
    geocode: (
      req: Record<string, unknown>,
      cb: (results: Array<{ formatted_address?: string; place_id?: string }> | null, status: string) => void,
    ) => void;
  };
  event: {
    addListener: (instance: unknown, event: string, handler: (...args: unknown[]) => void) => { remove: () => void };
    clearInstanceListeners?: (instance: unknown) => void;
  };
  places: {
    Autocomplete: new (
      input: HTMLInputElement,
      opts?: Record<string, unknown>,
    ) => {
      getPlace: () => {
        formatted_address?: string;
        place_id?: string;
        geometry?: { location?: { lat: () => number; lng: () => number } };
      };
      addListener: (event: string, handler: () => void) => void;
    };
  };
};

type GoogleMap = {
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  panTo: (c: { lat: number; lng: number }) => void;
};

type GoogleMarker = {
  setPosition: (c: { lat: number; lng: number }) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null | undefined;
  setMap: (map: GoogleMap | null) => void;
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    __cwpGoogleMapsInit?: () => void;
  }
}

let loadPromise: Promise<GoogleMapsNamespace | null> | null = null;

export function getGoogleMapsApiKey(): string | null {
  const key =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  return key || null;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export function loadGoogleMaps(): Promise<GoogleMapsNamespace | null> {
  const key = getGoogleMapsApiKey();
  if (!key) return Promise.resolve(null);

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<GoogleMapsNamespace | null>((resolve, reject) => {
    const finish = () => {
      if (window.google?.maps?.places) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps failed to initialize"));
      }
    };

    const existing = document.getElementById(MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.maps?.places) {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps")),
        { once: true },
      );
      return;
    }

    window.__cwpGoogleMapsInit = finish;

    const script = document.createElement("script");
    script.id = MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=places&callback=__cwpGoogleMapsInit&v=weekly`;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  }).catch(err => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

/** Varanasi — default map center for CWP Detailers. */
export const DEFAULT_MAP_CENTER = { lat: 25.3176, lng: 82.9739 };
