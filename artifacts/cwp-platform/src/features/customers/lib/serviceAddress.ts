/** Re-export CWP master address format from shared package. */
export {
  type CwpServiceAddressParts as ServiceAddressParts,
  type CwpServiceAddressInput as ServiceAddressInput,
  composeSavedAddress,
  hasRequiredAddressParts,
  canSaveCustomerLocation,
  mapGoogleAddressComponents,
  prefillAddressFromGeocode,
  guessCityFromAddress,
  parseComposedAddress,
  formatAddressLines,
  formatAddressSingleLine,
  formatStaffAddressLine,
} from "@workspace/address-model";
