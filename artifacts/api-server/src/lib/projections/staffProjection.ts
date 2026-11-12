import type { AuthUser } from "../../middlewares/auth";
import { generateSignedDocumentUrl } from "../cloudinaryStorage";

export type RawStaffRecord = Record<string, any>;

/**
 * Strips confidential HR, salary, bank, and identity documentation fields based on caller role.
 * PRD v3.0 (SEC-028):
 * - Central Admin/Super Admin: Full HR, identity and financial data
 * - Branch Manager: Delegated branch-level operational data (no bank details, no unmasked aadhaar/pan, no executive payroll)
 * - Supervisor: Strictly operational (no payroll/salary, no rates, no bank details, no aadhaar/pan)
 * - Staff: Own permitted profile only. Other staff records have identity/payroll stripped.
 */
export function projectStaffRecord<T extends RawStaffRecord>(record: T, caller?: AuthUser | string): T {
  if (!record) return record;

  const callerObj: any = typeof caller === "string" ? { role: caller } : caller;

  // Central Super Admin / Central Admin have full access
  const isCentral = callerObj?.role === "superadmin" || callerObj?.role === "central_admin" || (callerObj?.role === "admin" && !callerObj?.branchId);
  if (isCentral) {
    return record;
  }

  // Clone record to avoid mutating original
  const projected = { ...record };

  // Check if caller is viewing their own staff record
  const isOwnRecord = callerObj?.role === "staff" && callerObj?.staffId === record.id;
  if (isOwnRecord) {
    // Staff may view their own profile/bank details, but omit company internal notes if any
    return projected;
  }

  // Field Staff viewing another employee: strictly minimal directory projection
  if (callerObj?.role === "staff" || callerObj?.role === "customer") {
    delete projected.baseSalary;
    delete projected.salary;
    delete projected.monthlySalary;
    delete projected.dailyRate;
    delete projected.overtimeHourlyRate;
    delete projected.perWashRate;
    delete projected.perDailyCleaningRate;
    delete projected.perSolarPanelRate;
    delete projected.perSolarAmcVisitRate;
    delete projected.ratePerKm;
    delete projected.aadhaar;
    delete projected.aadhaarNumber;
    delete projected.pan;
    delete projected.panNumber;
    delete projected.bankAccountName;
    delete projected.bankName;
    delete projected.bankAccountNumber;
    delete projected.bankIfsc;
    delete projected.bankIfscCode;
    delete projected.bankBranch;
    delete projected.upiId;
    delete projected.bankPassbookUrl;
    delete projected.agreementUrl;
    delete projected.localAddress;
    delete projected.permanentAddress;
    delete projected.currentHouseNumber;
    delete projected.currentStreet;
    delete projected.permanentHouseNumber;
    delete projected.permanentStreet;
    delete projected.guardianName;
    delete projected.guardianPhone;
    delete projected.emergencyContactName;
    delete projected.emergencyContactPhone;
    return projected;
  }

  // Supervisor: operational management only. Strictly NO payroll, bank details, or identity docs
  if (callerObj?.role === "supervisor") {
    delete projected.baseSalary;
    delete projected.salary;
    delete projected.monthlySalary;
    delete projected.dailyRate;
    delete projected.overtimeHourlyRate;
    delete projected.perWashRate;
    delete projected.perDailyCleaningRate;
    delete projected.perSolarPanelRate;
    delete projected.perSolarAmcVisitRate;
    delete projected.ratePerKm;
    delete projected.aadhaar;
    delete projected.aadhaarNumber;
    delete projected.pan;
    delete projected.panNumber;
    delete projected.bankAccountName;
    delete projected.bankName;
    delete projected.bankAccountNumber;
    delete projected.bankIfsc;
    delete projected.bankIfscCode;
    delete projected.bankBranch;
    delete projected.upiId;
    delete projected.bankPassbookUrl;
    delete projected.agreementUrl;
    delete projected.localAddress;
    delete projected.permanentAddress;
    delete projected.permanentHouseNumber;
    delete projected.permanentStreet;
    delete projected.permanentCity;
    delete projected.permanentState;
    delete projected.permanentPincode;
    return projected;
  }

  // Branch Manager: delegated branch operations.
  // Sensitive financial bank info, Aadhaar, PAN, and executive salary are stripped or masked
  if (callerObj?.role === "branch_manager" || callerObj?.role === "manager") {
    delete projected.baseSalary;
    delete projected.salary;
    delete projected.bankAccountNumber;
    delete projected.bankIfsc;
    delete projected.bankIfscCode;
    delete projected.bankPassbookUrl;
    delete projected.aadhaar;
    delete projected.aadhaarNumber;
    delete projected.pan;
    delete projected.panNumber;
    delete projected.monthlySalary;
    delete projected.dailyRate;
    delete projected.overtimeHourlyRate;
    delete projected.perWashRate;
    delete projected.perDailyCleaningRate;
    delete projected.perSolarPanelRate;
    delete projected.perSolarAmcVisitRate;
    delete projected.ratePerKm;
    if (Array.isArray(projected.documents)) {
      projected.documents = projectStaffDocuments(projected.documents, caller, projected.id);
    }
    return projected;
  }

  if (Array.isArray(projected.documents)) {
    projected.documents = projectStaffDocuments(projected.documents, caller, projected.id);
  }
  return projected;
}

/**
 * Projects an array of staff records
 */
export function projectStaffList<T extends RawStaffRecord>(records: T[], caller?: AuthUser): T[] {
  return records.map(r => projectStaffRecord(r, caller));
}

const SENSITIVE_DOC_TYPES = new Set([
  "aadhaar",
  "pan",
  "bank_passbook",
  "bank_cancelled_cheque",
]);

export function maskDocumentNumber(num?: string | null): string | null {
  if (!num) return null;
  const clean = String(num).trim();
  if (clean.length <= 4) return "****";
  return "*".repeat(clean.length - 4) + clean.slice(-4);
}

/**
 * Projects staff compliance document metadata.
 * PRD v3.0 (SEC-028 / STAFF-019):
 * Redacts fileUrl and masks documentNumber for sensitive identity/financial docs
 * (Aadhaar, PAN, Bank Passbook, Cheque) for supervisors, branch managers, and other staff.
 */
export function projectStaffDocument<T extends Record<string, any>>(
  doc: T,
  caller?: AuthUser | string,
  staffId?: number,
): T {
  if (!doc) return doc;
  const callerObj: any = typeof caller === "string" ? { role: caller } : caller;
  const isCentral =
    callerObj?.role === "superadmin" ||
    callerObj?.role === "central_admin" ||
    (callerObj?.role === "admin" && !callerObj?.branchId);

  const targetStaffId = staffId ?? doc.staffId;
  const isOwnRecord = callerObj?.role === "staff" && callerObj?.staffId === targetStaffId;

  // PRD v4.2 (SEC-030): For authorized viewers, generate short-lived signed URLs for sensitive docs
  if (isCentral || isOwnRecord) {
    if (SENSITIVE_DOC_TYPES.has(doc.documentType) && doc.fileUrl) {
      return {
        ...doc,
        fileUrl: generateSignedDocumentUrl(doc.fileUrl),
      };
    }
    return doc;
  }

  // Non-authorized roles (supervisors, branch managers, peer staff): completely shield sensitive documents
  if (SENSITIVE_DOC_TYPES.has(doc.documentType)) {
    return {
      ...doc,
      fileUrl: null,
      documentNumber: maskDocumentNumber(doc.documentNumber),
    };
  }

  return doc;
}

export function projectStaffDocuments<T extends Record<string, any>>(
  docs: T[],
  caller?: AuthUser | string,
  staffId?: number,
): T[] {
  return docs.map(d => projectStaffDocument(d, caller, staffId));
}
