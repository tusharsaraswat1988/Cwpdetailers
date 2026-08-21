import { mapGoogleAddressComponents } from "@workspace/address-model";
import type { CwpServiceAddressParts, GoogleAddressComponent } from "@workspace/address-model";
import {
  loadGoogleMaps,
  type GoogleMapsNamespace,
  type GoogleAutocompletePrediction,
  type GoogleGeocoderResult,
} from "./loadGoogleMaps";

export type ResolvedPlace = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  googleComponents: GoogleAddressComponent[];
  parts: Partial<CwpServiceAddressParts>;
};

export type PlaceSuggestion = {
  id: string;
  primary: string;
  secondary: string;
};

const PLACE_DETAIL_FIELDS = [
  "formatted_address",
  "geometry",
  "place_id",
  "address_components",
  "name",
];

function toParts(components: GoogleAddressComponent[], formatted?: string): Partial<CwpServiceAddressParts> {
  return mapGoogleAddressComponents(components, formatted);
}

function fromGeocoder(result: GoogleGeocoderResult, lat: number, lng: number): ResolvedPlace {
  const components = result.address_components ?? [];
  const formatted = result.formatted_address ?? "";
  return {
    formattedAddress: formatted,
    latitude: lat,
    longitude: lng,
    placeId: result.place_id,
    googleComponents: components,
    parts: toParts(components, formatted),
  };
}

let geocodeGeneration = 0;

export function nextGeocodeGeneration(): number {
  geocodeGeneration += 1;
  return geocodeGeneration;
}

export function currentGeocodeGeneration(): number {
  return geocodeGeneration;
}

export async function searchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const maps = await loadGoogleMaps();
  if (!maps) return [];

  const modern = maps.places.AutocompleteSuggestion;
  if (modern?.fetchAutocompleteSuggestions) {
    try {
      const { suggestions } = await modern.fetchAutocompleteSuggestions({
        input: trimmed,
        includedRegionCodes: ["in"],
      });
      return suggestions
        .map(s => {
          const pred = s.placePrediction;
          if (!pred?.placeId) return null;
          return {
            id: pred.placeId,
            primary: pred.mainText?.text ?? pred.text?.text ?? trimmed,
            secondary: pred.secondaryText?.text ?? "",
          };
        })
        .filter((s): s is PlaceSuggestion => Boolean(s));
    } catch {
      // Fall through to AutocompleteService.
    }
  }

  const AutocompleteService = maps.places.AutocompleteService;
  if (!AutocompleteService) return [];

  return new Promise(resolve => {
    const service = new AutocompleteService();
    service.getPlacePredictions(
      { input: trimmed, componentRestrictions: { country: "in" } },
      (predictions, status) => {
        if (status !== "OK" || !predictions) {
          resolve([]);
          return;
        }
        resolve(predictions.map((p: GoogleAutocompletePrediction) => ({
          id: p.place_id,
          primary: p.structured_formatting?.main_text ?? p.description,
          secondary: p.structured_formatting?.secondary_text ?? "",
        })));
      },
    );
  });
}

export async function resolvePlaceById(placeId: string): Promise<ResolvedPlace | null> {
  const maps = await loadGoogleMaps();
  if (!maps) return null;

  const modern = maps.places.AutocompleteSuggestion;
  if (modern?.fetchAutocompleteSuggestions) {
    try {
      const { suggestions } = await modern.fetchAutocompleteSuggestions({
        input: placeId,
        includedRegionCodes: ["in"],
      });
      const pred = suggestions[0]?.placePrediction;
      if (pred?.toPlace) {
        const place = pred.toPlace();
        await place.fetchFields({
          fields: ["formattedAddress", "location", "id", "addressComponents"],
        });
        const loc = place.location;
        if (loc) {
          const components: GoogleAddressComponent[] = (place.addressComponents ?? []).map(c => ({
            long_name: c.longText ?? "",
            short_name: c.shortText ?? "",
            types: c.types ?? [],
          }));
          const formatted = place.formattedAddress ?? "";
          return {
            formattedAddress: formatted,
            latitude: loc.lat(),
            longitude: loc.lng(),
            placeId: place.id ?? placeId,
            googleComponents: components,
            parts: toParts(components, formatted),
          };
        }
      }
    } catch {
      // Fall through to PlacesService.
    }
  }

  const PlacesService = maps.places.PlacesService;
  if (!PlacesService) return null;

  return new Promise(resolve => {
    const attr = document.createElement("div");
    const service = new PlacesService(attr);
    service.getDetails(
      { placeId, fields: PLACE_DETAIL_FIELDS },
      (place, status) => {
        const loc = place?.geometry?.location;
        if (status !== "OK" || !place || !loc) {
          resolve(null);
          return;
        }
        const components = place.address_components ?? [];
        const formatted = place.formatted_address ?? place.name ?? "";
        resolve({
          formattedAddress: formatted,
          latitude: loc.lat(),
          longitude: loc.lng(),
          placeId: place.place_id ?? placeId,
          googleComponents: components,
          parts: toParts(components, formatted),
        });
      },
    );
  });
}

export async function reverseGeocodePlace(lat: number, lng: number, generation?: number): Promise<ResolvedPlace | null> {
  const maps = await loadGoogleMaps();
  if (!maps) return null;
  if (generation != null && generation !== currentGeocodeGeneration()) return null;

  return new Promise(resolve => {
    const geocoder = new maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (generation != null && generation !== currentGeocodeGeneration()) {
        resolve(null);
        return;
      }
      const top = status === "OK" ? results?.[0] : null;
      if (!top) {
        resolve(null);
        return;
      }
      resolve(fromGeocoder(top, lat, lng));
    });
  });
}

export async function ensureMaps(mapsRef?: { current: GoogleMapsNamespace | null }): Promise<GoogleMapsNamespace | null> {
  const maps = mapsRef?.current ?? await loadGoogleMaps();
  if (maps && mapsRef) mapsRef.current = maps;
  return maps;
}
