import { z } from "zod";

export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const PHONE_ERRORS = {
  REQUIRED: "Mobile number is required",
  INVALID: "Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)",
  BRANCH_INVALID: "Enter a valid phone number with 7–15 digits",
} as const;

export type FieldResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Strip invalid characters while typing; keeps digits, +, spaces, hyphens. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+\s-]/g, "").slice(0, 16);
}

export function normalizeIndianMobile(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  let mobile: string;

  if (digits.length === 10) {
    mobile = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    mobile = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    mobile = digits.slice(1);
  } else {
    return null;
  }

  return INDIAN_MOBILE_REGEX.test(mobile) ? mobile : null;
}

export function validateIndianMobile(
  input: string,
  { required = true }: { required?: boolean } = {},
): FieldResult<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    return required
      ? { ok: false, error: PHONE_ERRORS.REQUIRED }
      : { ok: true, value: "" };
  }

  const normalized = normalizeIndianMobile(trimmed);
  if (!normalized) {
    return { ok: false, error: PHONE_ERRORS.INVALID };
  }

  return { ok: true, value: normalized };
}

/** Branch / landline contact — 7–15 digits after stripping formatting. */
export function validateContactPhone(
  input: string,
  { required = false }: { required?: boolean } = {},
): FieldResult<string | null> {
  const trimmed = input.trim();
  if (!trimmed) {
    return required
      ? { ok: false, error: PHONE_ERRORS.REQUIRED }
      : { ok: true, value: null };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return { ok: false, error: PHONE_ERRORS.BRANCH_INVALID };
  }

  return { ok: true, value: digits };
}

export const indianMobileSchema = z
  .string()
  .trim()
  .min(1, PHONE_ERRORS.REQUIRED)
  .refine((v) => normalizeIndianMobile(v) !== null, PHONE_ERRORS.INVALID)
  .transform((v) => normalizeIndianMobile(v)!);

export const optionalIndianMobileSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const normalized = normalizeIndianMobile(v);
    if (!normalized) throw new z.ZodError([{ code: "custom", message: PHONE_ERRORS.INVALID, path: [] }]);
    return normalized;
  });
