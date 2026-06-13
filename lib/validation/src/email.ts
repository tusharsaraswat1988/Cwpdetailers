import { z } from "zod";

export const EMAIL_ERRORS = {
  REQUIRED: "Email is required",
  INVALID: "Enter a valid email address (e.g. name@example.com)",
} as const;

export type FieldResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function validateEmail(
  input: string,
  { required = false }: { required?: boolean } = {},
): FieldResult<string | null> {
  const trimmed = input.trim();
  if (!trimmed) {
    return required
      ? { ok: false, error: EMAIL_ERRORS.REQUIRED }
      : { ok: true, value: null };
  }

  const normalized = normalizeEmail(trimmed);
  const result = z.string().email(EMAIL_ERRORS.INVALID).safeParse(normalized);
  if (!result.success) {
    return { ok: false, error: EMAIL_ERRORS.INVALID };
  }

  return { ok: true, value: normalized };
}

/** Strip spaces while typing. */
export function sanitizeEmailInput(value: string): string {
  return value.replace(/\s/g, "").slice(0, 254);
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, EMAIL_ERRORS.REQUIRED)
  .email(EMAIL_ERRORS.INVALID)
  .transform(normalizeEmail);

export const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const normalized = normalizeEmail(v);
    const result = z.string().email(EMAIL_ERRORS.INVALID).safeParse(normalized);
    if (!result.success) throw new z.ZodError([{ code: "custom", message: EMAIL_ERRORS.INVALID, path: [] }]);
    return normalized;
  });
