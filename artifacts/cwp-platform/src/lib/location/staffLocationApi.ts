import type { LocationPayload, StaffLocationLogRow } from "./types";
import { getStaffLocation, parseApiLocationError, toLocationPayload } from "./getStaffLocation";

export async function transitionBookingWithLocation(
  bookingId: number,
  body: { toStatus: string; reason?: string },
): Promise<unknown> {
  const needsLocation = ["en_route", "in_progress", "completed"].includes(body.toStatus);
  let payload: Record<string, unknown> = { ...body };

  if (needsLocation) {
    const coords = await getStaffLocation("action");
    payload = { ...payload, ...toLocationPayload(coords) };
  }

  const res = await fetch(`/api/bookings/${bookingId}/transition`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseApiLocationError(res));
  }
  return res.json();
}

export async function markAttendanceWithLocation(
  staffId: number,
  body: { date: string; status: string; checkInTime?: string; checkOutTime?: string; notes?: string },
): Promise<unknown> {
  const coords = await getStaffLocation("action");
  const payload = { ...body, ...toLocationPayload(coords) };

  const res = await fetch(`/api/staff/${staffId}/attendance`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseApiLocationError(res));
  }
  return res.json();
}

export async function fetchStaffLocationLogs(
  staffId: number,
  month?: string,
): Promise<StaffLocationLogRow[]> {
  const qs = new URLSearchParams();
  if (month) qs.set("month", month);
  const res = await fetch(`/api/staff/${staffId}/location-logs?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to load location history");
  }
  return res.json() as Promise<StaffLocationLogRow[]>;
}

export type { LocationPayload, StaffLocationLogRow };
