import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import {
  canSaveCustomerLocation,
  composeSavedAddress,
  hasFiniteCoordinates,
  parseComposedAddress,
} from "@workspace/address-model";

export type CustomerServiceAddressValue = {
  serviceLocationLabel: string;
  houseNumber: string;
  buildingName: string;
  area: string;
  landmark: string;
  pincode: string;
  city: string;
  latitude: string;
  longitude: string;
  placeId: string;
  formattedAddress?: string;
  googleComponents?: LocationValue["googleComponents"];
};

export function emptyAddressValue(label = "Home"): CustomerServiceAddressValue {
  return {
    serviceLocationLabel: label,
    houseNumber: "",
    buildingName: "",
    area: "",
    landmark: "",
    pincode: "",
    city: "",
    latitude: "",
    longitude: "",
    placeId: "",
    formattedAddress: "",
    googleComponents: undefined,
  };
}

export function savedLocationToForm(loc: SavedLocation): CustomerServiceAddressValue {
  const parsed = parseComposedAddress(loc.address);
  return {
    serviceLocationLabel: loc.label || "Home",
    houseNumber: loc.houseNumber ?? parsed.houseNumber,
    buildingName: loc.buildingName ?? parsed.buildingName,
    area: loc.area ?? parsed.area,
    landmark: loc.landmark ?? parsed.landmark,
    pincode: loc.pincode ?? parsed.pincode,
    city: loc.cityName ?? parsed.city,
    latitude: loc.latitude != null ? String(loc.latitude) : "",
    longitude: loc.longitude != null ? String(loc.longitude) : "",
    placeId: loc.placeId ?? "",
    formattedAddress: loc.formattedAddress ?? "",
    googleComponents: loc.googleComponents ?? undefined,
  };
}

export function locationToAddressForm(loc: LocationValue | null, label: string): CustomerServiceAddressValue {
  if (!loc) return emptyAddressValue(label);
  const parts = parseComposedAddress(loc.address);
  return {
    serviceLocationLabel: loc.savedLocationId ? label : label,
    houseNumber: loc.houseNumber ?? parts.houseNumber,
    buildingName: loc.buildingName ?? parts.buildingName,
    area: loc.area ?? parts.area,
    landmark: loc.landmark ?? parts.landmark,
    pincode: loc.pincode ?? parts.pincode,
    city: loc.cityName ?? parts.city,
    latitude: Number.isFinite(loc.latitude) && loc.latitude !== 0 ? String(loc.latitude) : "",
    longitude: Number.isFinite(loc.longitude) && loc.longitude !== 0 ? String(loc.longitude) : "",
    placeId: loc.placeId ?? "",
    formattedAddress: loc.formattedAddress ?? "",
    googleComponents: loc.googleComponents,
  };
}

export function addressFormToLocation(form: CustomerServiceAddressValue): LocationValue | null {
  const lat = parseFloat(form.latitude);
  const lng = parseFloat(form.longitude);
  const hasPin = hasFiniteCoordinates(lat, lng);
  if (!canSaveCustomerLocation(form, {
    hasCoordinates: hasPin,
    mapsUnavailable: !hasPin,
  })) return null;

  return {
    address: composeSavedAddress(form) || form.formattedAddress || "",
    latitude: hasPin ? lat : 0,
    longitude: hasPin ? lng : 0,
    placeId: form.placeId.trim() || undefined,
    houseNumber: form.houseNumber,
    buildingName: form.buildingName,
    area: form.area,
    landmark: form.landmark,
    cityName: form.city,
    pincode: form.pincode,
    formattedAddress: form.formattedAddress || undefined,
    googleComponents: form.googleComponents,
  };
}

export function savedLocationToLocationValue(loc: SavedLocation): LocationValue {
  return {
    address: loc.address,
    latitude: loc.latitude ?? 0,
    longitude: loc.longitude ?? 0,
    placeId: loc.placeId ?? undefined,
    houseNumber: loc.houseNumber ?? undefined,
    buildingName: loc.buildingName ?? undefined,
    area: loc.area ?? undefined,
    landmark: loc.landmark ?? undefined,
    cityName: loc.cityName ?? undefined,
    cityId: loc.cityId ?? undefined,
    pincode: loc.pincode ?? undefined,
    formattedAddress: loc.formattedAddress ?? undefined,
    savedLocationId: loc.id,
    googleComponents: loc.googleComponents ?? undefined,
  };
}

export function formToWritePayload(
  form: CustomerServiceAddressValue,
  customerId: number,
  isDefault?: boolean,
) {
  const loc = addressFormToLocation(form);
  const lat = parseFloat(form.latitude);
  const lng = parseFloat(form.longitude);
  return {
    customerId,
    label: form.serviceLocationLabel.trim() || "Home",
    address: loc?.address ?? composeSavedAddress(form),
    houseNumber: form.houseNumber.trim(),
    buildingName: form.buildingName.trim() || undefined,
    area: form.area.trim() || undefined,
    landmark: form.landmark.trim() || undefined,
    cityName: form.city.trim() || undefined,
    pincode: form.pincode.trim() || undefined,
    latitude: hasFiniteCoordinates(lat, lng) ? lat : null,
    longitude: hasFiniteCoordinates(lat, lng) ? lng : null,
    placeId: form.placeId.trim() || undefined,
    formattedAddress: form.formattedAddress?.trim() || undefined,
    googleComponents: form.googleComponents,
    isDefault,
  };
}
