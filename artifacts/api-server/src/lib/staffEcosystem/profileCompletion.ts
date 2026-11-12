import type { Staff, StaffDocument } from "@workspace/db";

const MANDATORY_DOC_TYPES = ["aadhaar", "pan", "driving_license", "address_proof"] as const;
const BANK_DOC_TYPES = ["bank_cancelled_cheque", "bank_passbook"] as const;

function filled(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim());
}

function addressBlockComplete(staff: Staff, prefix: "current" | "permanent"): boolean {
  const city = prefix === "current" ? staff.currentCity : staff.permanentCity;
  const state = prefix === "current" ? staff.currentState : staff.permanentState;
  const pincode = prefix === "current" ? staff.currentPincode : staff.permanentPincode;
  const line = prefix === "current"
    ? staff.currentHouseNumber || staff.currentStreet || staff.currentArea
    : staff.permanentHouseNumber || staff.permanentStreet || staff.permanentArea;
  return filled(line) && filled(city) && filled(state) && filled(pincode);
}

export type ProfileCompletionBreakdown = {
  identityComplete: boolean;
  documentsComplete: boolean;
  bankComplete: boolean;
  addressComplete: boolean;
  percent: number;
};

export function computeProfileCompletion(
  staff: Staff,
  documents: Pick<StaffDocument, "documentType" | "isCurrent">[],
): ProfileCompletionBreakdown {
  const currentDocs = documents.filter((d) => d.isCurrent);
  const hasDoc = (type: string) => currentDocs.some((d) => d.documentType === type);

  // Email is optional for ground field cleaning staff, mandatory for supervisors
  const emailValid = staff.staffCategory === "supervisor" ? filled(staff.email) : true;

  const identityComplete =
    filled(staff.name)
    && filled(staff.phone)
    && emailValid
    && Boolean(staff.dateOfBirth)
    && Boolean(staff.gender)
    && Boolean(staff.joiningDate)
    && filled(staff.emergencyContactName || staff.guardianName)
    && filled(staff.emergencyContactPhone || staff.guardianPhone)
    && filled(staff.profilePhotoUrl)
    && filled(staff.employeeCode);

  // Driving license is mandatory ONLY if staff owns/uses a vehicle
  const requiredDocs = staff.ownsVehicle
    ? ["aadhaar", "pan", "driving_license", "address_proof"]
    : ["aadhaar", "pan", "address_proof"];

  const documentsComplete =
    requiredDocs.every((t) => hasDoc(t))
    && (BANK_DOC_TYPES.some((t) => hasDoc(t)));

  const bankComplete =
    filled(staff.bankAccountName)
    && filled(staff.bankName)
    && filled(staff.bankAccountNumber)
    && filled(staff.bankIfsc)
    && filled(staff.bankBranch)
    && BANK_DOC_TYPES.some((t) => hasDoc(t));

  const addressComplete =
    addressBlockComplete(staff, "current")
    && (staff.permanentSameAsCurrent || addressBlockComplete(staff, "permanent"));

  const sections = [identityComplete, documentsComplete, bankComplete, addressComplete];
  const completed = sections.filter(Boolean).length;
  const percent = Math.round((completed / sections.length) * 100);

  return { identityComplete, documentsComplete, bankComplete, addressComplete, percent };
}

export function generateEmployeeCode(staffId: number): string {
  return `CWP-STF-${String(staffId).padStart(5, "0")}`;
}

export function isStaffAssignable(staff: Pick<Staff, "isActive" | "verificationStatus">): boolean {
  if (!staff.isActive) return false;
  if (staff.verificationStatus !== "verified") return false;
  return true;
}

export function staffAssignableError(
  staff: Pick<Staff, "isActive" | "verificationStatus" | "staffCategory">,
): string | null {
  if (staff.staffCategory === "supervisor") {
    return "Supervisors cannot be assigned to field jobs — assign cleaning staff instead";
  }
  if (staff.verificationStatus === "suspended") return "Staff member is suspended and cannot receive new assignments";
  if (staff.verificationStatus === "rejected") return "Staff member is rejected and cannot receive new assignments";
  if (!staff.isActive) return "Staff member is inactive and cannot receive new assignments";
  if (staff.verificationStatus !== "verified") return `Staff member must be verified before receiving assignments (current status: ${staff.verificationStatus})`;
  return null;
}

export const EXPIRY_DOC_TYPES = ["driving_license", "vehicle_insurance", "police_verification"] as const;
