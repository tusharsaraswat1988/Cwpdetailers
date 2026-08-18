/**
 * DCC visit attendance vs service outcome.
 *
 * Attendance (was staff present at the stop?):
 *   present      = completed | car_not_available
 *   not_present  = no visit row, or rejected geofence, or EOD missed log
 *
 * Service outcome:
 *   completed | car_not_available | other_exception (rejected) | pending | missed
 *
 * Historical records: status "completed" remains PRESENT + COMPLETED.
 * CAR_NOT_AVAILABLE is a new explicit visit status — never inferred from missed logs.
 */

export const DCMS_VISIT_STATUSES = ["completed", "rejected", "car_not_available"] as const;
export type DcmsVisitStatus = (typeof DCMS_VISIT_STATUSES)[number];

export type DcmsAttendance = "present" | "not_present";
export type DcmsServiceOutcome =
  | "completed"
  | "car_not_available"
  | "other_exception"
  | "pending"
  | "missed";

export type DcmsVisitType = "cleaning" | "wash";

export const CUSTOMER_HEADLINE_COMPLETED = "Daily cleaning completed";
export const CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE = "Car was not available for today's cleaning";

export function isPresentVisitStatus(status: string | null | undefined): boolean {
  return status === "completed" || status === "car_not_available";
}

export function attendanceFromVisitStatus(status: string | null | undefined): DcmsAttendance {
  return isPresentVisitStatus(status) ? "present" : "not_present";
}

export function photosRequiredForOutcome(outcome: "completed" | "car_not_available"): boolean {
  return outcome === "completed";
}

export function consumesCleaningEntitlement(
  visitType: DcmsVisitType,
  status: string,
): boolean {
  return status === "completed" && visitType === "cleaning";
}

export function consumesWashEntitlement(
  visitType: DcmsVisitType,
  status: string,
): boolean {
  return status === "completed" && visitType === "wash";
}

export function applyEntitlementDelta(
  sub: {
    usedCleanings: number;
    remainingCleanings: number;
    usedWashes: number;
    remainingWashes: number;
  },
  visitType: DcmsVisitType,
  status: string,
): {
  usedCleanings: number;
  remainingCleanings: number;
  usedWashes: number;
  remainingWashes: number;
  consumedCleaning: boolean;
  consumedWash: boolean;
} {
  const consumedCleaning = consumesCleaningEntitlement(visitType, status);
  const consumedWash = consumesWashEntitlement(visitType, status);
  return {
    usedCleanings: consumedCleaning ? sub.usedCleanings + 1 : sub.usedCleanings,
    remainingCleanings: consumedCleaning ? sub.remainingCleanings - 1 : sub.remainingCleanings,
    usedWashes: consumedWash ? sub.usedWashes + 1 : sub.usedWashes,
    remainingWashes: consumedWash ? sub.remainingWashes - 1 : sub.remainingWashes,
    consumedCleaning,
    consumedWash,
  };
}

export type RouteStopStatus =
  | "pending"
  | "completed"
  | "missed"
  | "rejected"
  | "car_not_available";

export function classifyRouteStop(
  visitStatus: string | undefined,
  isPastDay: boolean,
): RouteStopStatus {
  if (visitStatus === "completed") return "completed";
  if (visitStatus === "car_not_available") return "car_not_available";
  if (visitStatus === "rejected") return "rejected";
  if (isPastDay) return "missed";
  return "pending";
}

export function shouldRecordMissedVisit(args: {
  expectedToday: boolean;
  hasPresentVisit: boolean;
}): boolean {
  return args.expectedToday && !args.hasPresentVisit;
}

export type PresentVisitRef = { id: number; status: string };

export type CarNotAvailablePlan =
  | { action: "insert" }
  | { action: "return"; visitId: number }
  | { action: "reject"; error: string };

export type CompleteCleaningPlan =
  | { action: "insert" }
  | { action: "return"; visitId: number }
  | { action: "update"; visitId: number }
  | { action: "reject"; error: string };

/** Same-day CNA is idempotent. Completed → CNA is never allowed. */
export function planCarNotAvailable(existing: PresentVisitRef[]): CarNotAvailablePlan {
  const completed = existing.find(v => v.status === "completed");
  if (completed) return { action: "reject", error: "Cleaning already completed today" };
  const cna = existing.find(v => v.status === "car_not_available");
  if (cna) return { action: "return", visitId: cna.id };
  return { action: "insert" };
}

/**
 * Same-day complete is idempotent.
 * CNA → COMPLETED updates the same visit (car returned).
 * There is no missed visit row to recover; do not invent MISSED → COMPLETED.
 */
export function planCompleteCleaning(existing: PresentVisitRef[]): CompleteCleaningPlan {
  const completed = existing.find(v => v.status === "completed");
  if (completed) return { action: "return", visitId: completed.id };
  const cna = existing.find(v => v.status === "car_not_available");
  if (cna) return { action: "update", visitId: cna.id };
  return { action: "insert" };
}

export function canRecordCarNotAvailable(existingStatusesToday: string[]): {
  ok: boolean;
  error?: string;
} {
  const plan = planCarNotAvailable(existingStatusesToday.map((status, id) => ({ id, status })));
  if (plan.action === "reject") return { ok: false, error: plan.error };
  return { ok: true };
}

export function canCompleteCleaningToday(existingStatusesToday: string[]): {
  ok: boolean;
  error?: string;
} {
  const plan = planCompleteCleaning(existingStatusesToday.map((status, id) => ({ id, status })));
  if (plan.action === "reject") return { ok: false, error: plan.error };
  return { ok: true };
}

export function customerVisitHeadline(status: string, visitType?: string): string {
  if (status === "car_not_available") return CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE;
  if (status === "completed" && visitType === "wash") return "Wash completed";
  if (status === "completed") return CUSTOMER_HEADLINE_COMPLETED;
  if (status === "rejected") return "Visit could not be verified";
  return "Visit recorded";
}

export function adminVisitLabel(status: string): string {
  if (status === "car_not_available") return "Car Not Available";
  if (status === "completed") return "Completed";
  if (status === "rejected") return "Rejected";
  if (status === "missed") return "Missed";
  if (status === "pending") return "Pending";
  return status;
}

export function staffPerformanceFromCounts(args: {
  completed: number;
  carNotAvailable: number;
  rejected: number;
  missed: number;
}): {
  completedVisits: number;
  carNotAvailableVisits: number;
  rejectedVisits: number;
  missedVisits: number;
  completionPercentage: number;
} {
  const scored = args.completed + args.rejected + args.missed;
  return {
    completedVisits: args.completed,
    carNotAvailableVisits: args.carNotAvailable,
    rejectedVisits: args.rejected,
    missedVisits: args.missed,
    completionPercentage: scored > 0 ? Math.round((args.completed / scored) * 100) : 0,
  };
}

export function classifyTodayOutcome(visitStatus: string | undefined): DcmsServiceOutcome {
  if (visitStatus === "completed") return "completed";
  if (visitStatus === "car_not_available") return "car_not_available";
  if (visitStatus === "rejected") return "other_exception";
  return "pending";
}
