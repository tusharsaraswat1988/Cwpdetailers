import type { CoverageResult } from "../../coverage/CoverageTypes";
import { validateServiceabilityForBooking, buildCoverageRequest } from "../../coverage";
import type { BookingPolicy, BookingPolicyContext, PolicyResult } from "./types";

export type ValidationPolicyInput = {
  customerId: number;
  serviceId?: number | null;
  address?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  placeId?: string | null;
  cityId?: number | null;
  citySlug?: string | null;
  cityName?: string | null;
  addressComponents?: unknown[];
  postalCode?: string | null;
  requestSource?: string;
};

export const bookingValidationPolicy: BookingPolicy<ValidationPolicyInput, PolicyResult<CoverageResult>> = {
  name: "BookingValidationPolicy",
  async execute(input, ctx) {
    const coverage = await validateServiceabilityForBooking(
      buildCoverageRequest({
        customerId: input.customerId,
        address: input.address,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        placeId: input.placeId,
        serviceId: input.serviceId,
        cityId: input.cityId,
        citySlug: input.citySlug,
        cityName: input.cityName,
        addressComponents: input.addressComponents as never,
        postalCode: input.postalCode,
      }),
      {
        requestSource: input.requestSource ?? "booking_validation",
        requestId: ctx.trace.requestId,
        bookingId: ctx.trace.bookingId,
        traceId: ctx.trace.traceId,
      },
      ctx.logger,
    );
    if (!coverage.success) {
      return { success: false, error: coverage.message ?? "Coverage validation failed", data: coverage };
    }
    return { success: true, data: coverage };
  },
};
