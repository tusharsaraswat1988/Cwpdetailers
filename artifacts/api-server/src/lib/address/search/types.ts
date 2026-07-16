/** Address Search architecture — interfaces only (no Elasticsearch). */

export type AddressSearchCriteria = {
  customerId?: number;
  identityId?: number;
  nickname?: string;
  area?: string;
  landmark?: string;
  postalCode?: string;
  buildingName?: string;
  street?: string;
  locality?: string;
  houseNumber?: string;
  addressType?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  normalizedAddress?: string;
  includeDeleted?: boolean;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
};

export type AddressSearchResult = {
  addressId: number;
  identityId: number;
  customerId: number;
  nickname?: string | null;
  formattedAddress?: string | null;
  postalCode?: string | null;
  addressType: string;
  isDefault: boolean;
  score?: number;
};

export interface AddressSearchProvider {
  readonly providerId: string;
  search(criteria: AddressSearchCriteria): Promise<AddressSearchResult[]>;
}

export type AddressSearchRegistry = {
  repository?: AddressSearchProvider;
};

export const addressSearchRegistry: AddressSearchRegistry = {};
