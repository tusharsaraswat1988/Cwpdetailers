import { cityRepository } from "./CityRepository";
import { pinRepository } from "./PinRepository";
import { serviceAvailabilityRepository } from "./ServiceAvailabilityRepository";

/** Facade for coverage data access — business logic must use repositories, not raw DB. */
export class CoverageRepository {
  readonly cities = cityRepository;
  readonly pins = pinRepository;
  readonly serviceAvailability = serviceAvailabilityRepository;
}

export const coverageRepository = new CoverageRepository();

export { cityRepository, pinRepository, serviceAvailabilityRepository };
