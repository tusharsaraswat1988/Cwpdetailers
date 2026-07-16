import { db } from "@workspace/db";
import { addressesTable, addressIdentitiesTable } from "@workspace/db";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { AddressSearchCriteria, AddressSearchProvider, AddressSearchResult } from "./types";

/**
 * Repository-backed search provider — default V1 implementation.
 * Future modules must use AddressSearchProvider, not AddressRepository directly.
 */
export class RepositoryAddressSearchProvider implements AddressSearchProvider {
  readonly providerId = "repository-v1";

  async search(criteria: AddressSearchCriteria): Promise<AddressSearchResult[]> {
    const conditions = [eq(addressesTable.isCurrent, true)];

    if (criteria.customerId != null) {
      conditions.push(eq(addressesTable.customerId, criteria.customerId));
    }
    if (criteria.identityId != null) {
      conditions.push(eq(addressesTable.identityId, criteria.identityId));
    }
    if (!criteria.includeDeleted) conditions.push(isNull(addressesTable.deletedAt));
    if (!criteria.includeArchived) conditions.push(isNull(addressesTable.archivedAt));

    if (criteria.nickname) {
      conditions.push(ilike(addressesTable.nickname, `%${criteria.nickname}%`));
    }
    if (criteria.postalCode) {
      conditions.push(eq(addressesTable.postalCode, criteria.postalCode));
    }
    if (criteria.placeId) {
      conditions.push(eq(addressesTable.placeId, criteria.placeId));
    }
    if (criteria.addressType) {
      conditions.push(eq(addressesTable.addressType, criteria.addressType as never));
    }
    if (criteria.normalizedAddress) {
      conditions.push(ilike(addressesTable.normalizedAddress, `%${criteria.normalizedAddress.toLowerCase()}%`));
    }

    const textFilter = criteria.landmark ?? criteria.area ?? criteria.street ?? criteria.locality ?? criteria.buildingName ?? criteria.houseNumber;
    if (textFilter) {
      conditions.push(or(
        ilike(addressesTable.landmark, `%${textFilter}%`),
        ilike(addressesTable.area, `%${textFilter}%`),
        ilike(addressesTable.street, `%${textFilter}%`),
        ilike(addressesTable.locality, `%${textFilter}%`),
        ilike(addressesTable.buildingName, `%${textFilter}%`),
        ilike(addressesTable.houseNumber, `%${textFilter}%`),
        ilike(addressesTable.formattedAddress, `%${textFilter}%`),
      )!);
    }

    if (criteria.latitude != null && criteria.longitude != null && criteria.radiusMeters) {
      conditions.push(sql`
        (6371000 * acos(
          cos(radians(${criteria.latitude})) * cos(radians(${addressesTable.latitude}))
          * cos(radians(${addressesTable.longitude}) - radians(${criteria.longitude}))
          + sin(radians(${criteria.latitude})) * sin(radians(${addressesTable.latitude}))
        )) <= ${criteria.radiusMeters}
      `);
    }

    const limit = Math.min(criteria.limit ?? 50, 100);
    const offset = criteria.offset ?? 0;

    const rows = await db
      .select({
        addressId: addressesTable.id,
        identityId: addressesTable.identityId,
        customerId: addressesTable.customerId,
        nickname: addressesTable.nickname,
        formattedAddress: addressesTable.formattedAddress,
        postalCode: addressesTable.postalCode,
        addressType: addressesTable.addressType,
        isDefault: addressesTable.isDefault,
      })
      .from(addressesTable)
      .innerJoin(addressIdentitiesTable, eq(addressesTable.identityId, addressIdentitiesTable.id))
      .where(and(...conditions))
      .orderBy(sql`${addressesTable.isDefault} DESC`, sql`${addressesTable.updatedAt} DESC`)
      .limit(limit)
      .offset(offset);

    return rows.map(r => ({
      addressId: r.addressId,
      identityId: r.identityId,
      customerId: r.customerId,
      nickname: r.nickname,
      formattedAddress: r.formattedAddress,
      postalCode: r.postalCode,
      addressType: r.addressType,
      isDefault: r.isDefault,
    }));
  }
}

export const repositoryAddressSearchProvider = new RepositoryAddressSearchProvider();
