/** Extension interfaces — prepared for Phase 3+ modules. Not implemented in freeze. */

import type { LocationContext } from "../LocationContext";

export interface BranchResolver {
  readonly resolverId: string;
  resolveBranch(context: LocationContext): Promise<{ branchId: number; branchName?: string } | null>;
}

export interface FranchiseResolver {
  readonly resolverId: string;
  resolveFranchise(context: LocationContext): Promise<{ franchiseId: number; franchiseName?: string } | null>;
}

export interface WorkforceResolver {
  readonly resolverId: string;
  resolveWorkforce(context: LocationContext, serviceId?: number): Promise<{ staffAvailable: boolean; count?: number }>;
}

export interface EtaResolver {
  readonly resolverId: string;
  estimateEta(context: LocationContext, serviceId?: number): Promise<{ minutes: number; confidence: number } | null>;
}

export interface PricingResolver {
  readonly resolverId: string;
  resolvePricing(context: LocationContext, serviceId: number): Promise<{ amount: number; currency: string } | null>;
}

export interface HolidayResolver {
  readonly resolverId: string;
  isHoliday(context: LocationContext, date: string): Promise<boolean>;
}

export interface OperatingHoursResolver {
  readonly resolverId: string;
  isWithinOperatingHours(context: LocationContext, at: Date): Promise<boolean>;
}

export interface InventoryResolver {
  readonly resolverId: string;
  checkInventory(context: LocationContext, sku: string): Promise<{ available: boolean; quantity?: number }>;
}

export interface RecommendationResolver {
  readonly resolverId: string;
  recommendServices(context: LocationContext): Promise<Array<{ serviceId: number; score: number }>>;
}

export type LocationExtensionRegistry = {
  branch?: BranchResolver;
  franchise?: FranchiseResolver;
  workforce?: WorkforceResolver;
  eta?: EtaResolver;
  pricing?: PricingResolver;
  holiday?: HolidayResolver;
  operatingHours?: OperatingHoursResolver;
  inventory?: InventoryResolver;
  recommendation?: RecommendationResolver;
};

export const locationExtensionRegistry: LocationExtensionRegistry = {};
