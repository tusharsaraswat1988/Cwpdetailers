import { db } from "@workspace/db";
import { citiesTable, statesTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { cacheKey, coverageCache } from "../CoverageCache";
import type { CityEntity } from "../../location-intelligence/domain/entities";
import { cityRecordToEntity } from "../../location-intelligence/domain/entityMappers";

export type CityRecord = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  stateName: string;
};

export function toCityEntity(record: CityRecord): CityEntity {
  return cityRecordToEntity(record);
}

export class CityRepository {
  async findById(cityId: number): Promise<CityRecord | null> {
    const key = cacheKey("city", "id", cityId);
    const cached = coverageCache.get<CityRecord>(key);
    if (cached) return cached;

    const [row] = await db
      .select({
        id: citiesTable.id,
        name: citiesTable.name,
        slug: citiesTable.slug,
        isActive: citiesTable.isActive,
        stateName: statesTable.name,
      })
      .from(citiesTable)
      .innerJoin(statesTable, eq(citiesTable.stateId, statesTable.id))
      .where(eq(citiesTable.id, cityId))
      .limit(1);

    if (!row) return null;
    coverageCache.set(key, row);
    coverageCache.set(cacheKey("city", "slug", row.slug), row);
    return row;
  }

  async findBySlug(slug: string): Promise<CityRecord | null> {
    const normalized = slug.trim().toLowerCase();
    const key = cacheKey("city", "slug", normalized);
    const cached = coverageCache.get<CityRecord>(key);
    if (cached) return cached;

    const [row] = await db
      .select({
        id: citiesTable.id,
        name: citiesTable.name,
        slug: citiesTable.slug,
        isActive: citiesTable.isActive,
        stateName: statesTable.name,
      })
      .from(citiesTable)
      .where(eq(citiesTable.slug, normalized))
      .limit(1);

    if (!row) return null;
    coverageCache.set(key, row);
    coverageCache.set(cacheKey("city", "id", row.id), row);
    return row;
  }

  async findByName(name: string): Promise<CityRecord | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const key = cacheKey("city", "name", trimmed.toLowerCase());
    const cached = coverageCache.get<CityRecord>(key);
    if (cached) return cached;

    const [row] = await db
      .select({
        id: citiesTable.id,
        name: citiesTable.name,
        slug: citiesTable.slug,
        isActive: citiesTable.isActive,
        stateName: statesTable.name,
      })
      .from(citiesTable)
      .where(or(
        ilike(citiesTable.name, trimmed),
        ilike(citiesTable.slug, trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
      ))
      .limit(1);

    if (!row) return null;
    coverageCache.set(key, row);
    coverageCache.set(cacheKey("city", "id", row.id), row);
    coverageCache.set(cacheKey("city", "slug", row.slug), row);
    return row;
  }

  async findEntityById(cityId: number): Promise<CityEntity | null> {
    const record = await this.findById(cityId);
    return record ? toCityEntity(record) : null;
  }

  async findEntityBySlug(slug: string): Promise<CityEntity | null> {
    const record = await this.findBySlug(slug);
    return record ? toCityEntity(record) : null;
  }

  async findEntityByName(name: string): Promise<CityEntity | null> {
    const record = await this.findByName(name);
    return record ? toCityEntity(record) : null;
  }
}

export const cityRepository = new CityRepository();
