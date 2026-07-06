import type { CustomerContract } from "@workspace/db";
import {
  OPERATIONAL_ROLE_SLUGS,
  roleSlugForProductLine,
  type OperationalRoleSlug,
} from "../staffEcosystem/operationalRoles";

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

export const TASK_TYPE_ROLE_SLUG: Record<ServiceTaskType, OperationalRoleSlug> = {
  daily_cleaning: OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER,
  car_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  solar_cleaning: OPERATIONAL_ROLE_SLUGS.SOLAR_CLEANER,
  interior_detailing: OPERATIONAL_ROLE_SLUGS.INTERIOR_DETAILER,
  one_time_service: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
};

function num(summary: Record<string, unknown>, key: string): number {
  const v = summary[key];
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

/** Required task types for a contract — e.g. daily clean + wash bundle → both tasks. */
export function getRequiredTaskTypes(
  productLine: string,
  summaryJson: unknown,
): ServiceTaskType[] {
  const summary = (summaryJson ?? {}) as Record<string, unknown>;

  if (productLine === "daily_cleaning") {
    const tasks: ServiceTaskType[] = ["daily_cleaning"];
    const allocatedWashes = num(summary, "allocatedWashes");
    const remainingWashes = num(summary, "remainingWashes");
    if (allocatedWashes > 0 || remainingWashes > 0) {
      tasks.push("car_wash");
    }
    return tasks;
  }

  if (productLine === "wash_package" || productLine === "monthly_wash") {
    return ["car_wash"];
  }
  if (productLine === "solar_amc") return ["solar_cleaning"];
  if (productLine === "detailing_plan") return ["interior_detailing"];

  const role = roleSlugForProductLine(productLine);
  if (role === OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER) return ["daily_cleaning"];
  if (role === OPERATIONAL_ROLE_SLUGS.SOLAR_CLEANER) return ["solar_cleaning"];
  if (role === OPERATIONAL_ROLE_SLUGS.INTERIOR_DETAILER) return ["interior_detailing"];
  return ["one_time_service"];
}

export function getRequiredTaskTypesForContract(contract: Pick<CustomerContract, "productLine" | "summaryJson">): ServiceTaskType[] {
  return getRequiredTaskTypes(contract.productLine, contract.summaryJson);
}

export function roleSlugForTaskType(taskType: ServiceTaskType): OperationalRoleSlug {
  return TASK_TYPE_ROLE_SLUG[taskType];
}

export function taskTypeLabel(taskType: ServiceTaskType): string {
  return TASK_TYPE_LABELS[taskType] ?? taskType.replace(/_/g, " ");
}

export function defaultTaskTypeForProductLine(productLine: string): ServiceTaskType {
  const types = getRequiredTaskTypes(productLine, {});
  return types[0] ?? "one_time_service";
}

export type TaskAssignmentInput = {
  taskType: ServiceTaskType;
  staffId: number;
};
