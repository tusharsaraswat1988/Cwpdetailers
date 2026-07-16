import type { CityEntity, PinResolutionEntity, ServiceAreaEntity } from "./entities";

export function cityRecordToEntity(record: {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  stateName: string;
}): CityEntity {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    isActive: record.isActive,
    state: { name: record.stateName, code: undefined },
  };
}

export function pinRecordToEntity(record: {
  pincode: string;
  pincodeId: number;
  pincodeActive: boolean;
  serviceAreaId: number;
  serviceAreaName: string;
  serviceAreaActive: boolean;
  cityId: number;
  cityName: string;
  citySlug: string;
  cityActive: boolean;
  stateName: string;
  stateCode: string;
}): PinResolutionEntity {
  const city: CityEntity = {
    id: record.cityId,
    name: record.cityName,
    slug: record.citySlug,
    isActive: record.cityActive,
    state: { name: record.stateName, code: record.stateCode },
  };
  const serviceArea: ServiceAreaEntity = {
    id: record.serviceAreaId,
    name: record.serviceAreaName,
    isActive: record.serviceAreaActive,
    cityId: record.cityId,
  };
  return {
    pincode: record.pincode,
    id: record.pincodeId,
    isActive: record.pincodeActive,
    serviceArea,
    city,
  };
}
