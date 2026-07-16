import { coverageRepository } from "../repositories/CoverageRepository";
import type { CoverageValidator } from "./types";
import { cont, halt } from "./types";

export const serviceValidator: CoverageValidator = {
  name: "ServiceValidator",

  async validate(state) {
    if (!state.city) return cont(state);

    const catalog = await coverageRepository.serviceAvailability.getCityServiceCatalog(state.city.id);

    if (state.request.serviceId) {
      const available = await coverageRepository.serviceAvailability.isServiceAvailableInCity(
        state.request.serviceId,
        state.city.id,
      );
      if (!available) {
        return halt("SERVICE_UNAVAILABLE");
      }
    }

    return cont({
      ...state,
      serviceCatalog: catalog,
    });
  },
};
