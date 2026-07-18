export type BookingSearchCriteria = {
  customerId?: number;
  bookingId?: number;
  vehicleId?: number;
  addressIdentityId?: number;
  postalCode?: string;
  cityId?: number;
  serviceId?: number;
  serviceType?: string;
  status?: string;
  scheduledDate?: string;
  branchId?: number;
  franchiseeId?: number;
  contractRegistryId?: number;
  limit?: number;
  offset?: number;
};

export type BookingSearchResult = {
  bookingId: number;
  customerId: number;
  serviceType: string;
  status: string;
  scheduledDate: string;
  addressIdentityId?: number | null;
  contractRegistryId?: number | null;
  score?: number;
};

export interface BookingSearchProvider {
  readonly providerId: string;
  search(criteria: BookingSearchCriteria): Promise<{ results: BookingSearchResult[]; total: number }>;
}

export const bookingSearchRegistry: { repository?: BookingSearchProvider } = {};
