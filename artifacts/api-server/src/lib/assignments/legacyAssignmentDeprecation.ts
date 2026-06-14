import type { Response } from "express";

/**
 * Legacy assignment paths superseded by Sprint 6 unified queue.
 * Do not extend these — route new work through pending_service_assignments + service_assignments.
 */
export const LEGACY_ASSIGNMENT_PATHS = {
  bookingsAssign: {
    method: "POST",
    path: "/api/bookings/:id/assign",
    replacement: "POST /api/assignments/:pendingId/assign (after pending enqueue)",
    uiReplacement: "/admin/assign-services",
  },
  dcmsAssignmentsPost: {
    method: "POST",
    path: "/api/daily-cleaning/assignments",
    replacement: "POST /api/assignments/:pendingId/assign",
    uiReplacement: "/admin/assign-services",
  },
  dcmsAssignmentsGet: {
    method: "GET",
    path: "/api/daily-cleaning/assignments",
    replacement: "GET /api/assignments/pending | GET /api/assignments/assigned",
    uiReplacement: "/admin/assign-services",
  },
  dcmsStaffAssignmentsGet: {
    method: "GET",
    path: "/api/daily-cleaning/staff/assignments",
    replacement: "Sprint 7 staff execution APIs (linked to service_assignments)",
    uiReplacement: "/admin/assign-services",
  },
  bookingsStaffField: {
    method: "PATCH",
    path: "/api/bookings/:id (staffId)",
    replacement: "Unified assignment via pending queue",
    uiReplacement: "/admin/assign-services",
  },
} as const;

export const LEGACY_ASSIGNMENT_DEPRECATION_MESSAGE =
  "Deprecated: assign staff via /admin/assign-services and pending_service_assignments. " +
  "This path will be removed after Sprint 7 execution migration.";

/** HTTP headers for deprecated assignment endpoints (RFC 8594 Deprecation). */
export function applyLegacyAssignmentDeprecation(res: Response, successorPath = "/admin/assign-services"): void {
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", `<${successorPath}>; rel="successor-version"`);
  res.setHeader("X-CWP-Deprecated-Reason", LEGACY_ASSIGNMENT_DEPRECATION_MESSAGE);
}
