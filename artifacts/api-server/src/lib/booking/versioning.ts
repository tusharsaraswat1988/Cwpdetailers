/**
 * Booking Domain — version markers.
 * V2+ can coexist without replacing V1 consumers.
 */

export const BOOKING_DOMAIN_VERSION = "BookingDomainV2" as const;
export const BOOKING_CAPABILITY_VERSION = "BookingCapabilityV2" as const;

export type BookingDomainVersion = typeof BOOKING_DOMAIN_VERSION;
export type BookingCapabilityVersion = typeof BOOKING_CAPABILITY_VERSION;
