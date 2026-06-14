import { normalizeIndianMobile } from "./phone";
import { normalizeEmail, validateEmail } from "./email";

export type ContactEntityType = "customer" | "staff" | "user";

export type ParsedContactIdentity = {
  phone: string;
  email: string | null;
};

export type ContactConflictField = "phone" | "email";

export type ContactConflict = {
  field: ContactConflictField;
  entity: ContactEntityType;
  entityId: number;
  entityName: string;
  phone: string;
  email: string | null;
};

export function parseContactIdentity(
  phone: unknown,
  email?: unknown,
): { ok: true; value: ParsedContactIdentity } | { ok: false; error: string } {
  if (phone === undefined || phone === null || String(phone).trim() === "") {
    return { ok: false, error: "Mobile number is required" };
  }

  const normalizedPhone = normalizeIndianMobile(String(phone));
  if (!normalizedPhone) {
    return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };
  }

  if (email === undefined || email === null || String(email).trim() === "") {
    return { ok: true, value: { phone: normalizedPhone, email: null } };
  }

  const emailResult = validateEmail(String(email), { required: true });
  if (!emailResult.ok) return emailResult;

  return {
    ok: true,
    value: { phone: normalizedPhone, email: emailResult.value },
  };
}

export function contactIdentityLabel(phone: string, email: string | null): string {
  return email ? `${phone} · ${email}` : phone;
}

export function contactConflictMessage(conflict: ContactConflict): string {
  const entityLabel =
    conflict.entity === "customer" ? "customer"
      : conflict.entity === "staff" ? "staff member"
        : "user account";

  if (conflict.field === "phone") {
    return `A ${entityLabel} with this mobile number already exists`;
  }
  return `A ${entityLabel} with this email address already exists`;
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizeIndianMobile(a);
  const nb = normalizeIndianMobile(b);
  return Boolean(na && nb && na === nb);
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = a?.trim() ? normalizeEmail(a) : null;
  const nb = b?.trim() ? normalizeEmail(b) : null;
  return Boolean(na && nb && na === nb);
}
