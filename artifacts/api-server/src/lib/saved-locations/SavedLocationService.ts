import { db, savedLocationsTable, citiesTable, bookingsTable } from "@workspace/db";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { isDuplicateSavedLocation } from "@workspace/address-model";
import type { SavedLocation } from "@workspace/db";
import {
  composeFromParts,
  hydrateSavedLocation,
  isSavedLocationServiceError,
  normalizeWrite,
  validateSavedLocationWrite,
  type SavedLocationWriteInput,
  type SavedLocationServiceError,
} from "./validation";

export type { SavedLocationWriteInput, SavedLocationServiceError };
export { hydrateSavedLocation, validateSavedLocationWrite, isSavedLocationServiceError };

async function resolveCityId(cityId: number | null | undefined, cityName: string | null | undefined): Promise<{
  cityId: number | null;
  cityName: string | null;
}> {
  if (cityId != null) {
    const [city] = await db.select({ id: citiesTable.id, name: citiesTable.name })
      .from(citiesTable)
      .where(eq(citiesTable.id, cityId))
      .limit(1);
    if (city) return { cityId: city.id, cityName: cityName?.trim() || city.name };
  }
  const name = cityName?.trim();
  if (!name) return { cityId: cityId ?? null, cityName: name || null };
  const [city] = await db.select({ id: citiesTable.id, name: citiesTable.name })
    .from(citiesTable)
    .where(ilike(citiesTable.name, name))
    .limit(1);
  return { cityId: city?.id ?? cityId ?? null, cityName: city?.name ?? name };
}

async function clearDefault(customerId: number, exceptId?: number) {
  await db.update(savedLocationsTable)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      exceptId != null
        ? and(eq(savedLocationsTable.customerId, customerId), sql`${savedLocationsTable.id} <> ${exceptId}`)
        : eq(savedLocationsTable.customerId, customerId),
    );
}

async function promoteAnotherDefault(customerId: number) {
  const [next] = await db.select().from(savedLocationsTable)
    .where(eq(savedLocationsTable.customerId, customerId))
    .orderBy(desc(savedLocationsTable.updatedAt))
    .limit(1);
  if (next) {
    await db.update(savedLocationsTable)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(savedLocationsTable.id, next.id));
  }
}

export class SavedLocationService {
  async list(customerId: number): Promise<SavedLocation[]> {
    const rows = await db.select().from(savedLocationsTable)
      .where(eq(savedLocationsTable.customerId, customerId))
      .orderBy(sql`${savedLocationsTable.isDefault} DESC`, sql`${savedLocationsTable.label} ASC`);
    return rows.map(hydrateSavedLocation);
  }

  async getOwned(id: number, customerId: number): Promise<SavedLocation | null> {
    const [row] = await db.select().from(savedLocationsTable)
      .where(and(eq(savedLocationsTable.id, id), eq(savedLocationsTable.customerId, customerId)))
      .limit(1);
    return row ? hydrateSavedLocation(row) : null;
  }

  async create(raw: SavedLocationWriteInput): Promise<{ location: SavedLocation; reused: boolean }> {
    const input = normalizeWrite(raw);
    const validation = validateSavedLocationWrite(input);
    if (validation) throw validation;

    const existing = await this.list(input.customerId);
    const duplicate = existing.find(row => isDuplicateSavedLocation(input, {
      placeId: row.placeId,
      houseNumber: row.houseNumber,
      buildingName: row.buildingName,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
    }));
    if (duplicate) {
      return { location: duplicate, reused: true };
    }

    const city = await resolveCityId(input.cityId, input.cityName);
    const address = composeFromParts(input);
    const makeDefault = input.isDefault === true || existing.length === 0;
    if (makeDefault) await clearDefault(input.customerId);

    const [loc] = await db.insert(savedLocationsTable).values({
      customerId: input.customerId,
      label: input.label,
      address,
      houseNumber: input.houseNumber,
      buildingName: input.buildingName,
      area: input.area,
      landmark: input.landmark,
      cityId: city.cityId,
      cityName: city.cityName,
      pincode: input.pincode,
      latitude: input.latitude,
      longitude: input.longitude,
      placeId: input.placeId,
      formattedAddress: input.formattedAddress ?? address,
      googleComponents: input.googleComponents ?? null,
      isDefault: makeDefault,
    }).returning();

    return { location: loc!, reused: false };
  }

  async update(id: number, customerId: number, raw: Partial<SavedLocationWriteInput>): Promise<SavedLocation> {
    const existing = await this.getOwned(id, customerId);
    if (!existing) throw { status: 404, error: "Address not found" } satisfies SavedLocationServiceError;

    const merged: SavedLocationWriteInput = normalizeWrite({
      customerId,
      label: raw.label ?? existing.label,
      address: raw.address ?? existing.address,
      houseNumber: raw.houseNumber !== undefined ? raw.houseNumber : existing.houseNumber,
      buildingName: raw.buildingName !== undefined ? raw.buildingName : existing.buildingName,
      area: raw.area !== undefined ? raw.area : existing.area,
      landmark: raw.landmark !== undefined ? raw.landmark : existing.landmark,
      cityId: raw.cityId !== undefined ? raw.cityId : existing.cityId,
      cityName: raw.cityName !== undefined ? raw.cityName : existing.cityName,
      pincode: raw.pincode !== undefined ? raw.pincode : existing.pincode,
      latitude: raw.latitude !== undefined ? raw.latitude : existing.latitude,
      longitude: raw.longitude !== undefined ? raw.longitude : existing.longitude,
      placeId: raw.placeId !== undefined ? raw.placeId : existing.placeId,
      formattedAddress: raw.formattedAddress !== undefined ? raw.formattedAddress : existing.formattedAddress,
      googleComponents: raw.googleComponents !== undefined ? raw.googleComponents : existing.googleComponents,
      isDefault: raw.isDefault ?? existing.isDefault,
    });

    const validation = validateSavedLocationWrite(merged);
    if (validation) throw validation;

    const city = await resolveCityId(merged.cityId, merged.cityName);
    if (merged.isDefault) await clearDefault(customerId, id);

    const [loc] = await db.update(savedLocationsTable).set({
      label: merged.label,
      address: composeFromParts(merged, existing.address),
      houseNumber: merged.houseNumber,
      buildingName: merged.buildingName,
      area: merged.area,
      landmark: merged.landmark,
      cityId: city.cityId,
      cityName: city.cityName,
      pincode: merged.pincode,
      latitude: merged.latitude,
      longitude: merged.longitude,
      placeId: merged.placeId,
      formattedAddress: merged.formattedAddress,
      googleComponents: merged.googleComponents ?? null,
      isDefault: merged.isDefault ?? existing.isDefault,
      updatedAt: new Date(),
    }).where(eq(savedLocationsTable.id, id)).returning();

    return loc!;
  }

  async setDefault(id: number, customerId: number): Promise<SavedLocation> {
    const existing = await this.getOwned(id, customerId);
    if (!existing) throw { status: 404, error: "Address not found" } satisfies SavedLocationServiceError;
    await clearDefault(customerId);
    const [loc] = await db.update(savedLocationsTable)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(savedLocationsTable.id, id))
      .returning();
    return loc!;
  }

  async remove(id: number, customerId: number): Promise<void> {
    const existing = await this.getOwned(id, customerId);
    if (!existing) throw { status: 404, error: "Address not found" } satisfies SavedLocationServiceError;

    const [active] = await db.select({ id: bookingsTable.id }).from(bookingsTable)
      .where(and(
        eq(bookingsTable.savedLocationId, id),
        sql`${bookingsTable.status} IN ('draft','scheduled','confirmed','waiting_assignment','rescheduled')`,
      ))
      .limit(1);
    // Upcoming bookings keep their snapshot columns; deleting the nickname is allowed.
    void active;

    await db.delete(savedLocationsTable).where(eq(savedLocationsTable.id, id));
    if (existing.isDefault) await promoteAnotherDefault(customerId);
  }
}

export const savedLocationService = new SavedLocationService();
