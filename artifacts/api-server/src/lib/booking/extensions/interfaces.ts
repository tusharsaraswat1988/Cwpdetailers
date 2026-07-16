/** Extension interfaces — prepared for Phase 4+ modules. Not implemented in Phase 3. */

import type { BookingContext } from "../BookingContext";

export interface AssignmentProvider {
  readonly providerId: string;
  assign(context: BookingContext, staffId: number): Promise<{ success: boolean; error?: string }>;
}

export interface PricingProvider {
  readonly providerId: string;
  resolvePrice(context: BookingContext): Promise<{ amount: string; metadata?: Record<string, unknown> }>;
}

export interface ScheduleProvider {
  readonly providerId: string;
  validateSchedule(context: BookingContext): Promise<{ valid: boolean; error?: string }>;
}

export interface SlotProvider {
  readonly providerId: string;
  getAvailableSlots(context: BookingContext, date: string): Promise<Array<{ time: string; available: boolean }>>;
}

export interface PaymentProvider {
  readonly providerId: string;
  initiatePayment(context: BookingContext): Promise<{ paymentId: string; status: string }>;
  confirmPayment(context: BookingContext, paymentId: string): Promise<{ success: boolean }>;
}

export interface ReviewProvider {
  readonly providerId: string;
  submitReview(context: BookingContext, rating: number, comment?: string): Promise<{ success: boolean }>;
}

export interface RecommendationProvider {
  readonly providerId: string;
  recommend(context: BookingContext): Promise<Array<{ serviceId: number; serviceName: string; score: number }>>;
}

export interface RouteOptimizationProvider {
  readonly providerId: string;
  optimizeRoute(staffId: number, bookingIds: number[]): Promise<{ orderedIds: number[] }>;
}

export interface NotificationProvider {
  readonly providerId: string;
  notify(event: string, context: BookingContext): Promise<void>;
}

export interface AnalyticsProvider {
  readonly providerId: string;
  track(event: string, context: BookingContext, metadata?: Record<string, unknown>): Promise<void>;
}

export type BookingExtensionRegistry = {
  assignment?: AssignmentProvider;
  pricing?: PricingProvider;
  schedule?: ScheduleProvider;
  slot?: SlotProvider;
  payment?: PaymentProvider;
  review?: ReviewProvider;
  recommendation?: RecommendationProvider;
  routeOptimization?: RouteOptimizationProvider;
  notification?: NotificationProvider;
  analytics?: AnalyticsProvider;
};

export const bookingExtensionRegistry: BookingExtensionRegistry = {};
