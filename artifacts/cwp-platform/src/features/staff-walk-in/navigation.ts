import type { WalkInServiceKind } from "./api";

export type WalkInNavigationTarget =
  | { route: "daily_clean"; subscriptionId: number; visitType: "cleaning" }
  | { route: "booking"; bookingId: number; serviceKind: WalkInServiceKind };

/** Route walk-in resolution by the selected service entitlement — not package source. */
export function resolveWalkInNavigation(
  serviceKind: WalkInServiceKind,
  result:
    | { mode: "dcms"; subscriptionId: number; visitType: "cleaning" }
    | { mode: "booking"; bookingId: number },
): WalkInNavigationTarget {
  if (result.mode === "dcms" && serviceKind === "daily_clean") {
    return {
      route: "daily_clean",
      subscriptionId: result.subscriptionId,
      visitType: result.visitType,
    };
  }

  if (result.mode === "booking") {
    return {
      route: "booking",
      bookingId: result.bookingId,
      serviceKind,
    };
  }

  throw new Error(`Unsupported walk-in navigation for ${serviceKind}`);
}

export function walkInNavigationPath(target: WalkInNavigationTarget): string {
  if (target.route === "daily_clean") {
    return `/staff/daily-clean?walkIn=1&subscriptionId=${target.subscriptionId}&visitType=${target.visitType}`;
  }
  return `/staff/bookings?job=booking-${target.bookingId}`;
}
