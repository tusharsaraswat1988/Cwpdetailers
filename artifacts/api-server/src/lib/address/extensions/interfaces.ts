/** Extension interfaces — prepared for Phase 3+ modules. Not implemented in freeze. */

import type { AddressContext } from "../AddressContext";
import type { AddressSearchCriteria, AddressSearchResult } from "../search/types";

export interface AddressFormatter {
  readonly formatterId: string;
  format(context: AddressContext): string;
}

export interface AddressExporter {
  readonly exporterId: string;
  export(context: AddressContext): Promise<Record<string, unknown>>;
}

export interface AddressImporter {
  readonly importerId: string;
  import(data: Record<string, unknown>, customerId: number): Promise<AddressContext>;
}

export interface AddressVerifier {
  readonly verifierId: string;
  verify(context: AddressContext): Promise<{ verified: boolean; status: string }>;
}

export interface AddressRankingProvider {
  readonly providerId: string;
  rank(results: AddressSearchResult[], context?: AddressContext): Promise<AddressSearchResult[]>;
}

export interface AddressRecommendationProvider {
  readonly providerId: string;
  recommend(customerId: number): Promise<AddressSearchResult[]>;
}

export interface AddressAutocompleteProvider {
  readonly providerId: string;
  autocomplete(query: string, customerId?: number): Promise<Array<{ label: string; placeId?: string }>>;
}

export type AddressExtensionRegistry = {
  formatter?: AddressFormatter;
  exporter?: AddressExporter;
  importer?: AddressImporter;
  verifier?: AddressVerifier;
  ranking?: AddressRankingProvider;
  recommendation?: AddressRecommendationProvider;
  autocomplete?: AddressAutocompleteProvider;
};

export const addressExtensionRegistry: AddressExtensionRegistry = {};

export type { AddressSearchProvider } from "../search/types";
