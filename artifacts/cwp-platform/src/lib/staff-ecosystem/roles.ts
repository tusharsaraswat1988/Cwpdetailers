/** Operational role slugs — mirror of API `staff_role_master.slug` seed values. */
export const OPERATIONAL_ROLE_SLUGS = {
  DAILY_CAR_CLEANER: "daily_car_cleaner",
  CAR_WASHER: "car_washer",
  SOLAR_CLEANER: "solar_cleaner",
  INTERIOR_DETAILER: "interior_detailer",
  COATING_DETAILER: "coating_detailer",
} as const;

export type OperationalRoleSlug = (typeof OPERATIONAL_ROLE_SLUGS)[keyof typeof OPERATIONAL_ROLE_SLUGS];

/** Booking service types → required operational role for assignment pickers. */
export const BOOKING_SERVICE_ROLE_MAP: Record<string, OperationalRoleSlug> = {
  car_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  one_time_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  subscription_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  pickup_drop: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  emergency: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  daily_cleaning: OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER,
  solar_cleaning: OPERATIONAL_ROLE_SLUGS.SOLAR_CLEANER,
  detailing: OPERATIONAL_ROLE_SLUGS.INTERIOR_DETAILER,
};

export function roleSlugForBookingService(serviceType?: string | null): OperationalRoleSlug | null {
  if (!serviceType) return null;
  return BOOKING_SERVICE_ROLE_MAP[serviceType] ?? null;
}

export function roleSlugForVehicleAssignment(): OperationalRoleSlug {
  return OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER;
}
