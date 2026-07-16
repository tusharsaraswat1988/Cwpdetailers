import type { BookingContext } from "../BookingContext";

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
  platformStatus?: string;
  scheduledDate?: string;
  staffId?: number;
  branchId?: number;
  franchiseeId?: number;
  limit?: number;
  offset?: number;
};

export type BookingSearchResult = {
  bookingId: number;
  customerId: number;
  serviceType: string;
  status: string;
  platformStatus?: string;
  scheduledDate: string;
  staffId?: number | null;
  addressIdentityId?: number | null;
  score?: number;
};

export interface BookingSearchProvider {
  readonly providerId: string;
  search(criteria: BookingSearchCriteria): Promise<{ results: BookingSearchResult[]; total: number }>;
}

export const bookingSearchRegistry: { repository?: BookingSearchProvider } = {};
