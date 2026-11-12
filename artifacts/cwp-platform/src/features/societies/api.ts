import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ResidentialSociety = {
  id: number;
  name: string;
  code: string;
  address: string;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gateSecurityNotes?: string | null;
  totalTowers: number;
  totalFlats: number;
  isActive: boolean;
  cityId: number;
  cityName?: string;
  serviceAreaId?: number | null;
  serviceAreaName?: string;
  createdAt: string;
  updatedAt: string;
};

export type SocietyTower = {
  id: number;
  societyId: number;
  name: string;
  code?: string | null;
  totalFloors?: number | null;
  totalFlats?: number | null;
  parkingLevels?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SocietyWithTowers = ResidentialSociety & {
  towers: SocietyTower[];
};

export type ListSocietiesParams = {
  cityId?: number;
  citySlug?: string;
  serviceAreaId?: number;
  search?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
  return body as T;
}

export async function listSocieties(params?: ListSocietiesParams): Promise<{ data: ResidentialSociety[]; total: number }> {
  const url = new URL("/api/societies", window.location.origin);
  if (params?.cityId) url.searchParams.set("cityId", String(params.cityId));
  if (params?.citySlug) url.searchParams.set("citySlug", params.citySlug);
  if (params?.serviceAreaId) url.searchParams.set("serviceAreaId", String(params.serviceAreaId));
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.isActive !== undefined) url.searchParams.set("isActive", String(params.isActive));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url, { credentials: "include" });
  return parseJson<{ data: ResidentialSociety[]; total: number }>(res);
}

export async function getSociety(id: number): Promise<SocietyWithTowers> {
  const res = await fetch(`/api/societies/${id}`, { credentials: "include" });
  return parseJson<SocietyWithTowers>(res);
}

export async function listSocietyTowers(societyId: number): Promise<SocietyTower[]> {
  const res = await fetch(`/api/societies/${societyId}/towers`, { credentials: "include" });
  const body = await parseJson<{ data: SocietyTower[] }>(res);
  return body.data;
}

export async function createSociety(body: {
  cityId: number;
  serviceAreaId?: number;
  name: string;
  code?: string;
  address: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  gateSecurityNotes?: string;
  initialTowers?: string[];
}): Promise<ResidentialSociety> {
  const res = await fetch("/api/societies", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<ResidentialSociety>(res);
}

export async function createSocietyTower(societyId: number, body: {
  name: string;
  code?: string;
  totalFloors?: number;
  totalFlats?: number;
  parkingLevels?: string;
}): Promise<SocietyTower> {
  const res = await fetch(`/api/societies/${societyId}/towers`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<SocietyTower>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// React Query Hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useSocieties(params?: ListSocietiesParams) {
  return useQuery({
    queryKey: ["societies", params],
    queryFn: () => listSocieties(params),
  });
}

export function useSociety(id: number | null | undefined) {
  return useQuery({
    queryKey: ["societies", id],
    queryFn: () => (id ? getSociety(id) : null),
    enabled: Boolean(id),
  });
}

export function useSocietyTowers(societyId: number | null | undefined) {
  return useQuery({
    queryKey: ["societies", societyId, "towers"],
    queryFn: () => (societyId ? listSocietyTowers(societyId) : []),
    enabled: Boolean(societyId),
  });
}

export function useCreateSociety() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSociety,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["societies"] });
    },
  });
}

export function useCreateSocietyTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ societyId, body }: { societyId: number; body: Parameters<typeof createSocietyTower>[1] }) =>
      createSocietyTower(societyId, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["societies", variables.societyId, "towers"] });
      qc.invalidateQueries({ queryKey: ["societies"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Operations & Exceptions Types & Hooks
// ─────────────────────────────────────────────────────────────────────────────

export type StaffOperationalBreakdown = {
  staffId: number;
  staffName: string;
  assignedCount: number;
  completedCount: number;
};

export type SocietyDailyOperationsRow = {
  societyId: number;
  societyName: string;
  societyCode: string;
  cityId: number;
  cityName: string;
  totalTowers: number;
  activeSubscriptionsCount: number;
  completedTodayCount: number;
  carNotAvailableTodayCount: number;
  pendingTodayCount: number;
  completionPercentage: number;
  openExceptionsCount: number;
  assignedStaff: StaffOperationalBreakdown[];
};

export type SocietyOperationsSummary = {
  totalSocieties: number;
  totalActiveSubscriptions: number;
  totalCompletedToday: number;
  totalCarNotAvailableToday: number;
  totalPendingToday: number;
  overallCompletionPercentage: number;
  totalOpenExceptions: number;
};

export type SocietyDailyOperationsResult = {
  date: string;
  cityId?: number;
  summary: SocietyOperationsSummary;
  societies: SocietyDailyOperationsRow[];
};

export type OperationalExceptionRow = {
  id: number;
  subscriptionId: number;
  visitId?: number | null;
  societyId?: number | null;
  societyName?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  staffId?: number | null;
  staffName?: string | null;
  exceptionType: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  reason: string;
  notes?: string | null;
  evidencePhotoUrl?: string | null;
  reportedAt: string;
  resolutionAction?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  customerId: number;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string;
  parkingBay?: string | null;
};

export async function getSocietyDailyOperations(params?: {
  date?: string;
  cityId?: number;
}): Promise<SocietyDailyOperationsResult> {
  const url = new URL("/api/daily-cleaning/societies/daily-operations", window.location.origin);
  if (params?.date) url.searchParams.set("date", params.date);
  if (params?.cityId) url.searchParams.set("cityId", String(params.cityId));
  const res = await fetch(url, { credentials: "include" });
  return parseJson<SocietyDailyOperationsResult>(res);
}

export async function listOperationalExceptions(params?: {
  societyId?: number;
  cityId?: number;
  status?: string;
  exceptionType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: OperationalExceptionRow[]; total: number }> {
  const url = new URL("/api/daily-cleaning/exceptions", window.location.origin);
  if (params?.societyId) url.searchParams.set("societyId", String(params.societyId));
  if (params?.cityId) url.searchParams.set("cityId", String(params.cityId));
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.exceptionType) url.searchParams.set("exceptionType", params.exceptionType);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url, { credentials: "include" });
  return parseJson<{ data: OperationalExceptionRow[]; total: number }>(res);
}

export async function resolveOperationalException(body: {
  exceptionId: number;
  action: "grant_makeup_credit" | "reassign_staff" | "schedule_reclean" | "dismiss";
  resolutionNotes: string;
  newStaffId?: number;
}): Promise<any> {
  const res = await fetch(`/api/daily-cleaning/exceptions/${body.exceptionId}/resolve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function getMediaRetentionPolicy(): Promise<{
  routineRetentionDays: number;
  exceptionRetentionDays: number;
  notice: string;
}> {
  const res = await fetch("/api/daily-cleaning/media/retention/policy", { credentials: "include" });
  return parseJson(res);
}

export async function runMediaPurge(body: { days?: number; dryRun?: boolean }): Promise<{
  dryRun: boolean;
  retentionDays: number;
  cutoffDate: string;
  eligibleCount: number;
  purgedCount: number;
  visitIds: number[];
}> {
  const res = await fetch("/api/daily-cleaning/media/retention/run-purge", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export function useSocietyDailyOperations(params?: { date?: string; cityId?: number }) {
  return useQuery({
    queryKey: ["society-daily-operations", params],
    queryFn: () => getSocietyDailyOperations(params),
    refetchInterval: 15_000,
  });
}

export function useOperationalExceptions(params?: {
  societyId?: number;
  cityId?: number;
  status?: string;
  exceptionType?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["operational-exceptions", params],
    queryFn: () => listOperationalExceptions(params),
    refetchInterval: 15_000,
  });
}

export function useResolveOperationalException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resolveOperationalException,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational-exceptions"] });
      qc.invalidateQueries({ queryKey: ["society-daily-operations"] });
    },
  });
}

export function useMediaRetentionPolicy() {
  return useQuery({
    queryKey: ["media-retention-policy"],
    queryFn: getMediaRetentionPolicy,
  });
}

export function useRunMediaPurge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runMediaPurge,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["society-daily-operations"] });
    },
  });
}
