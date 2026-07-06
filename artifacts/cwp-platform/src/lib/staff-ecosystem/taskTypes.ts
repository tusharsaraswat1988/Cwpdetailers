/** Service task types for split assignment — mirror of API `service_task_type` enum. */
export type ServiceTaskType =
  | "daily_cleaning"
  | "car_wash"
  | "solar_cleaning"
  | "interior_detailing"
  | "one_time_service";

export const TASK_TYPE_LABELS: Record<ServiceTaskType, string> = {
  daily_cleaning: "Daily Clean",
  car_wash: "Full Wash",
  solar_cleaning: "Solar Cleaning",
  interior_detailing: "Interior Detailing",
  one_time_service: "One-Time Service",
};

import { OPERATIONAL_ROLE_SLUGS, type OperationalRoleSlug } from "./roles";

export const TASK_TYPE_ROLE_SLUG: Record<ServiceTaskType, OperationalRoleSlug> = {
  daily_cleaning: OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER,
  car_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  solar_cleaning: OPERATIONAL_ROLE_SLUGS.SOLAR_CLEANER,
  interior_detailing: OPERATIONAL_ROLE_SLUGS.INTERIOR_DETAILER,
  one_time_service: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
};

export function taskTypeLabel(taskType: ServiceTaskType): string {
  return TASK_TYPE_LABELS[taskType] ?? taskType.replace(/_/g, " ");
}

export function roleSlugForTaskType(taskType: ServiceTaskType): OperationalRoleSlug {
  return TASK_TYPE_ROLE_SLUG[taskType];
}
