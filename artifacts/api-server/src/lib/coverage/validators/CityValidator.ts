import { coverageRepository } from "../repositories/CoverageRepository";
import type { CityRecord } from "../repositories/CityRepository";
import type { CoverageValidator, CityResolutionSource } from "./types";
import { cont, halt } from "./types";

function hasValidCoordinates(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function resolveCityByPriority(state: import("./types").PipelineState): Promise<{
  city: CityRecord | null;
  source?: CityResolutionSource;
}> {
  if (state.city) {
    return { city: state.city, source: state.cityResolutionSource ?? "pin" };
  }

  const { request, parsedAddress } = state;
  const gpsPresent = hasValidCoordinates(request.locationLat, request.locationLng);

  if (parsedAddress.city?.trim()) {
    const city = await coverageRepository.cities.findByName(parsedAddress.city);
    if (city) return { city, source: "google_city" };
  }

  if (request.cityId != null) {
    const city = await coverageRepository.cities.findById(request.cityId);
    if (city) return { city, source: "city_id" };
  }

  if (request.cityName?.trim()) {
    const city = await coverageRepository.cities.findByName(request.cityName);
    if (city) return { city, source: "city_name" };
  }

  // citySlug is client-supplied and easy to spoof. Only use it when GPS is absent
  // (manual fallback / maps unavailable).
  if (!gpsPresent && request.citySlug?.trim()) {
    const city = await coverageRepository.cities.findBySlug(request.citySlug);
    if (city) return { city, source: "city_slug" };
  }

  return { city: null };
}

export const cityValidator: CoverageValidator = {
  name: "CityValidator",

  async validate(state) {
    const { city, source } = await resolveCityByPriority(state);

    if (!city) {
      if (state.pincode) {
        return halt("SERVICE_AREA_NOT_SUPPORTED");
      }
      return halt("PIN_NOT_FOUND", "We could not determine a valid PIN code from the service address. Please include a 6-digit PIN code or select a supported city.");
    }

    if (!city.isActive) {
      return halt("CITY_DISABLED");
    }

    const usedCityFallback = source !== "pin";

    return cont({
      ...state,
      city,
      cityResolutionSource: source,
      usedCityFallback,
    });
  },
};
