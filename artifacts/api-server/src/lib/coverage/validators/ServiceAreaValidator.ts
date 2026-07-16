import type { CoverageValidator } from "./types";
import { cont, halt } from "./types";

export const serviceAreaValidator: CoverageValidator = {
  name: "ServiceAreaValidator",

  async validate(state) {
    if (!state.pinRecord) return cont(state);

    const pin = state.pinRecord;
    if (!pin.pincodeActive || !pin.serviceAreaActive) {
      return halt("SERVICE_AREA_NOT_SUPPORTED");
    }

    return cont({
      ...state,
      city: {
        id: pin.cityId,
        name: pin.cityName,
        slug: pin.citySlug,
        isActive: pin.cityActive,
        stateName: pin.stateName,
      },
    });
  },
};
