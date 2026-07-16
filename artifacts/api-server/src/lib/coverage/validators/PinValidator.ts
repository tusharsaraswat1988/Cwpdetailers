import { coverageRepository } from "../repositories/CoverageRepository";
import type { CoverageValidator } from "./types";
import { cont, halt } from "./types";

export const pinValidator: CoverageValidator = {
  name: "PinValidator",

  async validate(state) {
    const pincode = state.parsedAddress.postalCode ?? state.pincode ?? null;
    if (!pincode) {
      return cont({ ...state, pincode: null, pinRecord: null });
    }

    const pinRecord = await coverageRepository.pins.findByPincode(pincode);
    if (!pinRecord) {
      return halt("SERVICE_AREA_NOT_SUPPORTED");
    }

    return cont({
      ...state,
      pincode,
      pinRecord,
      cityResolutionSource: "pin",
      usedCityFallback: false,
    });
  },
};
