/**
 * Frozen Customer IA v1.0 — canonical routes.
 * @see docs/CUSTOMER_IA_FREEZE_v1.md
 */

import {
  buildScheduleEntryUrl,
  type ScheduleEntryParams,
} from "@/lib/schedule-entry";

export const CUSTOMER_ROUTES = {
  home: "/customer/dashboard",
  plans: "/customer/plans",
  planDetail: (id: number | string) => `/customer/plans/${id}`,
  schedule: "/customer/schedule",
  scheduleEntry: (params?: ScheduleEntryParams) => buildScheduleEntryUrl(params),
  scheduledServiceDetail: (id: number | string) => `/customer/schedule/${id}`,
  assets: "/customer/assets",
  account: "/customer/account",
  serviceHistory: "/customer/history",
  invoices: "/customer/invoices",
  support: "/customer/support",
} as const;

/** Legacy paths that redirect to canonical routes (see CustomerRouteRedirects). */
export const CUSTOMER_LEGACY_ROUTES = {
  wallet: "/customer/wallet",
  services: "/customer/services",
  bookings: "/customer/bookings",
  bookingsDetail: (id: number | string) => `/customer/bookings/${id}`,
  book: "/customer/book",
  complaints: "/customer/complaints",
} as const;
