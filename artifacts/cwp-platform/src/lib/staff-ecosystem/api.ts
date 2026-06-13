export type StaffRoleAssignment = {
  roleId: number;
  roleName: string;
  roleSlug: string;
  skillLevel: "trainee" | "basic" | "intermediate" | "expert";
};

export type StaffDocument = {
  id: number;
  staffId: number;
  documentType: string;
  documentNumber?: string | null;
  title?: string | null;
  description?: string | null;
  fileUrl: string;
  contentType?: string | null;
  expiryDate?: string | null;
  uploadedAt: string;
  isExpired?: boolean;
};

export type StaffNote = {
  id: number;
  staffId: number;
  authorName?: string | null;
  note: string;
  createdAt: string;
};

export type StaffPerformanceProfile = {
  totalJobs: number;
  completedJobs: number;
  dailyCleaningVisits: number;
  carWashes: number;
  solarJobs: number;
  solarAmcVisits: number;
  averageRating: number;
  complaintsReceived: number;
  lastJobDate: string | null;
};

export type ProfileCompletion = {
  identityComplete: boolean;
  documentsComplete: boolean;
  bankComplete: boolean;
  addressComplete: boolean;
  percent: number;
};

export type StaffEcosystemProfile = {
  id: number;
  employeeCode?: string | null;
  name: string;
  profilePhotoUrl?: string | null;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  joiningDate?: string | null;
  role: string;
  branchId: number;
  branchName?: string;
  city?: string | null;
  cityId?: number | null;
  franchiseeId?: number | null;
  partnerName?: string | null;
  reportingManagerId?: number | null;
  reportingManagerName?: string | null;
  employmentType?: string | null;
  monthlySalary?: string | null;
  perWashRate?: string | null;
  perDailyCleaningRate?: string | null;
  perSolarPanelRate?: string | null;
  perSolarAmcVisitRate?: string | null;
  ownsVehicle?: boolean;
  vehicleType?: string | null;
  vehicleRegistrationNumber?: string | null;
  petrolModel?: string | null;
  ratePerKm?: string | null;
  availability?: string;
  weeklyOff?: string | null;
  workingHoursStart?: string | null;
  workingHoursEnd?: string | null;
  currentHouseNumber?: string | null;
  currentStreet?: string | null;
  currentArea?: string | null;
  currentLandmark?: string | null;
  currentCity?: string | null;
  currentState?: string | null;
  currentPincode?: string | null;
  permanentHouseNumber?: string | null;
  permanentStreet?: string | null;
  permanentArea?: string | null;
  permanentLandmark?: string | null;
  permanentCity?: string | null;
  permanentState?: string | null;
  permanentPincode?: string | null;
  permanentSameAsCurrent?: boolean;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  upiId?: string | null;
  verificationStatus: string;
  verificationNotes?: string | null;
  isActive: boolean;
  profileCompletionPercent: number;
  roles: StaffRoleAssignment[];
  documents: StaffDocument[];
  notes: StaffNote[];
  performance: StaffPerformanceProfile;
  profileCompletion: ProfileCompletion;
  assignable: boolean;
};

export type RoleMaster = { id: number; name: string; slug: string };

export type StaffDashboardStats = {
  totalStaff: number;
  averageCompletion: number;
  incompleteProfiles: number;
  pendingVerification: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const staffEcosystemApi = {
  getProfile: (id: number) => api<StaffEcosystemProfile>(`/api/staff/${id}/ecosystem`),
  patchProfile: (id: number, data: Record<string, unknown>) =>
    api(`/api/staff/${id}/ecosystem`, { method: "PATCH", body: JSON.stringify(data) }),
  getRoleMaster: () => api<RoleMaster[]>("/api/staff-role-master"),
  putRoles: (id: number, roles: { roleId: number; skillLevel: string }[]) =>
    api(`/api/staff/${id}/roles`, { method: "PUT", body: JSON.stringify({ roles }) }),
  setVerificationStatus: (id: number, status: string, notes?: string) =>
    api(`/api/staff/${id}/verification-status`, { method: "POST", body: JSON.stringify({ status, notes }) }),
  listDocuments: (id: number) => api<StaffDocument[]>(`/api/staff/${id}/documents`),
  uploadDocument: (id: number, data: Record<string, unknown>) =>
    api(`/api/staff/${id}/documents`, { method: "POST", body: JSON.stringify(data) }),
  replaceDocument: (id: number, docId: number, data: Record<string, unknown>) =>
    api(`/api/staff/${id}/documents/${docId}/replace`, { method: "POST", body: JSON.stringify(data) }),
  deleteDocument: (id: number, docId: number) =>
    api(`/api/staff/${id}/documents/${docId}`, { method: "DELETE" }),
  listNotes: (id: number) => api<StaffNote[]>(`/api/staff/${id}/notes`),
  addNote: (id: number, note: string) =>
    api(`/api/staff/${id}/notes`, { method: "POST", body: JSON.stringify({ note }) }),
  dashboardStats: () => api<StaffDashboardStats>("/api/staff/dashboard-stats"),
  listStaffForAssignment: () => api<Array<{ id: number; name: string }>>("/api/staff?forAssignment=true&isActive=true"),
};

export const STAFF_ECOSYSTEM_QUERY_KEY = "staff-ecosystem";

export const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  driving_license: "Driving License",
  address_proof: "Address Proof",
  bank_cancelled_cheque: "Cancelled Cheque",
  bank_passbook: "Bank Passbook",
  staff_consent_form: "Staff Consent Form",
  vehicle_insurance: "Vehicle Insurance",
  vehicle_registration: "Vehicle Registration",
  police_verification: "Police Verification",
  medical_certificate: "Medical Certificate",
  other: "Other Document",
};

export const MANDATORY_DOCS = ["aadhaar", "pan", "driving_license", "address_proof", "bank_passbook", "bank_cancelled_cheque"];
export const OPTIONAL_DOCS = ["staff_consent_form", "vehicle_insurance", "vehicle_registration", "police_verification", "medical_certificate"];
export const EXPIRY_DOCS = ["driving_license", "vehicle_insurance", "police_verification"];
