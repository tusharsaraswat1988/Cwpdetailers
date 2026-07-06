import { pgEnum } from "drizzle-orm/pg-core";

export const serviceTaskTypeEnum = pgEnum("service_task_type", [
  "daily_cleaning",
  "car_wash",
  "solar_cleaning",
  "interior_detailing",
  "one_time_service",
]);

export type ServiceTaskType = (typeof serviceTaskTypeEnum.enumValues)[number];
