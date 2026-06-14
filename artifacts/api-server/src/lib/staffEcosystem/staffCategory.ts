import type { Staff } from "@workspace/db";

export type StaffCategoryValue = "supervisor" | "cleaning_staff";

export function normalizeStaffCategory(value: unknown): StaffCategoryValue {
  return value === "supervisor" ? "supervisor" : "cleaning_staff";
}

export function resolveStaffCategory(
  staff: Pick<Staff, "staffCategory" | "role">,
): StaffCategoryValue {
  if (staff.staffCategory === "supervisor" || staff.staffCategory === "cleaning_staff") {
    return staff.staffCategory;
  }
  return staff.role === "supervisor" ? "supervisor" : "cleaning_staff";
}

export function isSupervisorStaff(
  staff: Pick<Staff, "staffCategory" | "role">,
): boolean {
  return resolveStaffCategory(staff) === "supervisor";
}

export function applyStaffCategoryFields(
  category: StaffCategoryValue,
): Pick<Staff, "staffCategory" | "role"> & { reportingManagerId: null | undefined } {
  if (category === "supervisor") {
    return {
      staffCategory: "supervisor",
      role: "supervisor",
      reportingManagerId: null,
    };
  }
  return {
    staffCategory: "cleaning_staff",
    role: "technician",
    reportingManagerId: undefined,
  };
}
