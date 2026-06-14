import { validateIndianMobile, validateEmail } from "@workspace/validation";
import type { CustomerImportRow, MigrationIssue } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function issue(
  sheet: string,
  row: number,
  severity: MigrationIssue["severity"],
  code: string,
  message: string,
  column?: string,
  legacyId?: string,
): MigrationIssue {
  return { sheet, row, column, severity, code, message, legacyId };
}

export function parseBool(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  const s = String(value).trim().toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1";
}

export function parseOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  const s = String(value).trim();
  if (DATE_RE.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

export function parseOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

export function parseMoney(value: unknown, defaultValue = "0"): string {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  const n = parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return n.toFixed(2);
}

const CUSTOMER_STATUSES = new Set(["active", "inactive", "suspended"]);
const LEGACY_SEGMENTS = new Set(["legacy_contact"]);

export function parseCustomerStatus(value: unknown, defaultValue: "active" | "inactive" | "suspended" = "active") {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  const s = String(value).trim().toLowerCase();
  return CUSTOMER_STATUSES.has(s) ? s as "active" | "inactive" | "suspended" : defaultValue;
}

export function parseLegacySegment(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const s = String(value).trim().toLowerCase();
  return LEGACY_SEGMENTS.has(s) ? s : null;
}

export function validateCustomerRows(
  rows: CustomerImportRow[],
  existingPhones: Set<string>,
): { errors: MigrationIssue[]; warnings: MigrationIssue[] } {
  const errors: MigrationIssue[] = [];
  const warnings: MigrationIssue[] = [];
  const seenLegacy = new Map<string, number>();
  const seenPhone = new Map<string, number>();

  for (const row of rows) {
    const lid = row.legacyCustomerId;

    if (!lid) {
      errors.push(issue("Customers", row.rowNumber, "error", "MISSING_LEGACY_ID", "legacy_customer_id is required", "legacy_customer_id"));
      continue;
    }
    if (seenLegacy.has(lid)) {
      errors.push(issue("Customers", row.rowNumber, "error", "DUPLICATE_LEGACY_ID", `Duplicate legacy_customer_id '${lid}'`, "legacy_customer_id", lid));
    } else {
      seenLegacy.set(lid, row.rowNumber);
    }

    if (!row.name?.trim()) {
      errors.push(issue("Customers", row.rowNumber, "error", "MISSING_NAME", "name is required", "name", lid));
    }

    const phoneResult = validateIndianMobile(row.phone, { required: true });
    if (!phoneResult.ok) {
      errors.push(issue("Customers", row.rowNumber, "error", "INVALID_PHONE", phoneResult.error, "phone", lid));
    } else {
      row.phone = phoneResult.value;
      if (seenPhone.has(row.phone)) {
        errors.push(issue("Customers", row.rowNumber, "error", "DUPLICATE_PHONE", `Duplicate phone in file: ${row.phone}`, "phone", lid));
      } else {
        seenPhone.set(row.phone, row.rowNumber);
      }
      if (existingPhones.has(row.phone)) {
        warnings.push(issue("Customers", row.rowNumber, "warning", "PHONE_EXISTS", `Phone ${row.phone} already exists — will upsert`, "phone", lid));
      }
    }

    if (row.email) {
      const emailResult = validateEmail(row.email, { required: true });
      if (!emailResult.ok) {
        errors.push(issue("Customers", row.rowNumber, "error", "INVALID_EMAIL", emailResult.error, "email", lid));
      } else {
        row.email = emailResult.value;
      }
    }

    if (row.lastPaymentDate && !DATE_RE.test(row.lastPaymentDate)) {
      errors.push(issue("Customers", row.rowNumber, "error", "INVALID_DATE", "last_payment_date must be YYYY-MM-DD", "last_payment_date", lid));
    }
    if (row.customerSince && !DATE_RE.test(row.customerSince)) {
      errors.push(issue("Customers", row.rowNumber, "error", "INVALID_DATE", "customer_since must be YYYY-MM-DD", "customer_since", lid));
    }

    if (row.historicalWashCount !== null && row.historicalWashCount < 0) {
      errors.push(issue("Customers", row.rowNumber, "error", "INVALID_COUNT", "historical_wash_count must be >= 0", "historical_wash_count", lid));
    }
    if (row.historicalSolarVisitCount !== null && row.historicalSolarVisitCount < 0) {
      errors.push(issue("Customers", row.rowNumber, "error", "INVALID_COUNT", "historical_solar_visit_count must be >= 0", "historical_solar_visit_count", lid));
    }

    if (row.createLogin && !row.temporaryPassword) {
      warnings.push(issue("Customers", row.rowNumber, "warning", "AUTO_PASSWORD", "No temporary_password — a random password will be generated", "temporary_password", lid));
    }

    if (row.status && !CUSTOMER_STATUSES.has(row.status)) {
      errors.push(issue("Customers", row.rowNumber, "error", "INVALID_STATUS", "status must be active, inactive, or suspended", "status", lid));
    }

    if (row.legacySegment && !LEGACY_SEGMENTS.has(row.legacySegment)) {
      errors.push(issue("Customers", row.rowNumber, "error", "INVALID_SEGMENT", "legacy_segment must be legacy_contact or empty", "legacy_segment", lid));
    }

    if (row.legacySegment === "legacy_contact" && row.status === "active") {
      warnings.push(issue("Customers", row.rowNumber, "warning", "LEGACY_ACTIVE", "legacy_contact is usually imported as inactive — will import as active", "status", lid));
    }
  }

  return { errors, warnings };
}
