/** Loads the Google Maps JavaScript API (Maps + Places) once per page. */

const MAPS_SCRIPT_ID = "cwp-google-maps-js";

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GoogleGeocoderResult = {
  formatted_address?: string;
  place_id?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

export type GooglePlaceResult = {
  formatted_address?: string;
  place_id?: string;
  name?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

export type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

/** Minimal Maps surface used by our picker (avoids @types/google.maps dependency). */
export type GoogleMapsNamespace = {
  Map: new (el: HTMLElement, opts?: Record<string, unknown>) => GoogleMap;
  Marker: new (opts?: Record<string, unknown>) => GoogleMarker;
  LatLng: new (lat: number, lng: number) => { lat: () => number; lng: () => number };
  Geocoder: new () => {
    geocode: (
      req: Record<string, unknown>,
      cb: (results: GoogleGeocoderResult[] | null, status: string) => void,
    ) => void;
  };
  event: {
    addListener: (instance: unknown, event: string, handler: (...args: unknown[]) => void) => { remove: () => void };
    clearInstanceListeners?: (instance: unknown) => void;
  };
  places: {
    Autocomplete?: new (
      input: HTMLInputElement,
      opts?: Record<string, unknown>,
    ) => {
      getPlace: () => GooglePlaceResult & { geometry?: { location?: { lat: () => number; lng: () => number } } };
      addListener: (event: string, handler: () => void) => void;
    };
    AutocompleteService?: new () => {
      getPlacePredictions: (
        req: Record<string, unknown>,
        cb: (predictions: GoogleAutocompletePrediction[] | null, status: string) => void,
      ) => void;
    };
    PlacesService?: new (attrContainer: HTMLDivElement | GoogleMap) => {
      getDetails: (
        req: Record<string, unknown>,
        cb: (place: GooglePlaceResult | null, status: string) => void,
      ) => void;
    };
    AutocompleteSuggestion?: {
      fetchAutocompleteSuggestions: (req: Record<string, unknown>) => Promise<{
        suggestions: Array<{
          placePrediction?: {
            text?: { text?: string };
            placeId?: string;
            mainText?: { text?: string };
            secondaryText?: { text?: string };
            toPlace?: () => {
              fetchFields: (req: { fields: string[] }) => Promise<void>;
              formattedAddress?: string;
              id?: string;
              location?: { lat: () => number; lng: () => number };
              addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
            };
          };
        }>;
      }>;
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

let loadPromise: Promise<GoogleMapsNamespace | null> | null = null;
let lastFailure: string | null = null;

type GoogleHost = {
  google?: { maps?: GoogleMapsNamespace };
  __cwpGoogleMapsInit?: () => void;
};

function googleHost(): GoogleHost {
  return window as unknown as GoogleHost;
}

export function getGoogleMapsApiKey(): string | null {
  const key =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  return key || null;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export function getGoogleMapsLoadError(): string | null {
  return lastFailure;
}

export function loadGoogleMaps(): Promise<GoogleMapsNamespace | null> {
  const key = getGoogleMapsApiKey();
  if (!key) {
    lastFailure = "not_configured";
    return Promise.resolve(null);
  }

  if (googleHost().google?.maps?.places) {
    lastFailure = null;
    return Promise.resolve(googleHost().google!.maps!);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<GoogleMapsNamespace | null>((resolve, reject) => {
    const finish = () => {
      if (googleHost().google?.maps?.places) {
        lastFailure = null;
        resolve(googleHost().google!.maps!);
      } else {
        lastFailure = "Google Maps failed to initialize";
        reject(new Error(lastFailure));
      }
    };

    const existing = document.getElementById(MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (googleHost().google?.maps?.places) {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => {
          lastFailure = "Failed to load Google Maps";
          reject(new Error(lastFailure));
        },
        { once: true },
      );
      return;
    }

    googleHost().__cwpGoogleMapsInit = finish;

    const script = document.createElement("script");
    script.id = MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=places&callback=__cwpGoogleMapsInit&v=weekly`;
    script.onerror = () => {
      loadPromise = null;
      lastFailure = "Failed to load Google Maps";
      reject(new Error(lastFailure));
    };
    document.head.appendChild(script);
  }).catch(err => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

/** Default map center — used only when the customer has not chosen a place yet. */
export const DEFAULT_MAP_CENTER = { lat: 25.3176, lng: 82.9739 };
