import { db } from "@workspace/db";
import {
  citiesTable,
  pincodesTable,
  serviceAreasTable,
  statesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { cacheKey, coverageCache } from "../CoverageCache";
import type { PinResolutionEntity } from "../../location-intelligence/domain/entities";
import { pinRecordToEntity } from "../../location-intelligence/domain/entityMappers";

export type PinRecord = {
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
};

export function toPinResolutionEntity(record: PinRecord): PinResolutionEntity {
  return pinRecordToEntity(record);
}

export class PinRepository {
  async findByPincode(pincode: string): Promise<PinRecord | null> {
    const key = cacheKey("pin", pincode);
    const cached = coverageCache.get<PinRecord>(key);
    if (cached) return cached;

    const [row] = await db
      .select({
        pincode: pincodesTable.pincode,
        pincodeId: pincodesTable.id,
        pincodeActive: pincodesTable.isActive,
        serviceAreaId: serviceAreasTable.id,
        serviceAreaName: serviceAreasTable.name,
        serviceAreaActive: serviceAreasTable.isActive,
        cityId: citiesTable.id,
        cityName: citiesTable.name,
        citySlug: citiesTable.slug,
        cityActive: citiesTable.isActive,
        stateName: statesTable.name,
        stateCode: statesTable.code,
      })
      .from(pincodesTable)
      .innerJoin(serviceAreasTable, eq(pincodesTable.serviceAreaId, serviceAreasTable.id))
      .innerJoin(citiesTable, eq(serviceAreasTable.cityId, citiesTable.id))
      .innerJoin(statesTable, eq(citiesTable.stateId, statesTable.id))
      .where(eq(pincodesTable.pincode, pincode))
      .limit(1);

    if (!row) return null;
    coverageCache.set(key, row);
    return row;
  }

  async findEntityByPincode(pincode: string): Promise<PinResolutionEntity | null> {
    const record = await this.findByPincode(pincode);
    return record ? toPinResolutionEntity(record) : null;
  }
}

export const pinRepository = new PinRepository();
