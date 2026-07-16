import type { AddressVerificationStatus, AddressSource } from "@workspace/db";
import type { PreparedAddress } from "../domain/AddressPreparation";

export type AddressConfidenceInput = {
  verificationStatus: AddressVerificationStatus;
  source: AddressSource;
  hasGoogleComponents: boolean;
  hasGps: boolean;
  hasParsedFields: boolean;
  isLegacyMigrated?: boolean;
};

/** Address-domain confidence — separate from Location Intelligence confidence. */
export function calculateAddressConfidence(input: AddressConfidenceInput): number {
  const verified = input.verificationStatus === "GOOGLE_VERIFIED"
    || input.verificationStatus === "GPS_VERIFIED"
    || input.verificationStatus === "ADMIN_VERIFIED";

  if (input.hasGoogleComponents && input.hasGps && input.hasParsedFields && verified) return 100;
  if (input.verificationStatus === "GOOGLE_VERIFIED" || (input.hasGoogleComponents && input.hasGps)) return 90;
  if (input.source === "MANUAL" || input.verificationStatus === "USER_ENTERED") return 70;
  if (input.source === "IMPORTED") return input.isLegacyMigrated ? 25 : 50;
  if (input.isLegacyMigrated) return 25;
  if (input.verificationStatus === "GPS_VERIFIED") return 90;
  return 0;
}

export function calculateAddressConfidenceFromPrepared(
  prep: PreparedAddress,
  opts?: { isLegacyMigrated?: boolean },
): number {
  const hasParsed = Boolean(
    prep.normalized.houseNumber
    || prep.normalized.street
    || prep.normalized.locality
    || prep.normalized.postalCode,
  );
  return calculateAddressConfidence({
    verificationStatus: prep.verification,
    source: prep.source,
    hasGoogleComponents: Boolean(prep.merged.addressComponents?.length),
    hasGps: prep.merged.latitude != null && prep.merged.longitude != null,
    hasParsedFields: hasParsed,
    isLegacyMigrated: opts?.isLegacyMigrated,
  });
}
