export {
  INDIAN_MOBILE_REGEX,
  PHONE_ERRORS,
  sanitizePhoneInput,
  normalizeIndianMobile,
  validateIndianMobile,
  validateContactPhone,
  indianMobileSchema,
  optionalIndianMobileSchema,
  type FieldResult as PhoneFieldResult,
} from "./phone";

export {
  EMAIL_ERRORS,
  normalizeEmail,
  validateEmail,
  sanitizeEmailInput,
  emailSchema,
  optionalEmailSchema,
  type FieldResult as EmailFieldResult,
} from "./email";

export function firstFieldError(
  results: Record<string, { ok: boolean; error?: string }>,
): string | null {
  for (const result of Object.values(results)) {
    if (!result.ok && result.error) return result.error;
  }
  return null;
}

export function collectFieldErrors(
  results: Record<string, { ok: boolean; error?: string }>,
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  for (const [key, result] of Object.entries(results)) {
    if (!result.ok && result.error) errors[key] = result.error;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
