/** Domain entities — repositories return these, not raw DB rows. */

export type StateEntity = {
  name: string;
  code: string;
};

export type CityEntity = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  state: StateEntity;
};

export type ServiceAreaEntity = {
  id: number;
  name: string;
  isActive: boolean;
  cityId: number;
};

export type PinResolutionEntity = {
  pincode: string;
  id: number;
  isActive: boolean;
  serviceArea: ServiceAreaEntity;
  city: CityEntity;
};

export function toCitySummary(entity: CityEntity) {
  return {
    id: entity.id,
    name: entity.name,
    slug: entity.slug,
    stateName: entity.state.name,
  };
}
