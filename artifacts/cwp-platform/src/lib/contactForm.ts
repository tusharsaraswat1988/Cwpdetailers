import {
  validateIndianMobile,
  validateEmail,
  validateContactPhone,
  normalizeIndianMobile,
  normalizeEmail,
} from "@workspace/validation";

export function submitMobile(
  value: string,
  { required = true, optional = false } = {},
): { ok: true; value: string } | { ok: false; error: string } {
  const result = validateIndianMobile(value, { required: required && !optional });
  if (!result.ok) return result;
  if (!result.value) return { ok: true, value: "" };
  const normalized = normalizeIndianMobile(result.value);
  return normalized ? { ok: true, value: normalized } : { ok: false, error: "Invalid mobile number" };
}

export function submitOptionalMobile(
  value: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (!value.trim()) return { ok: true, value: undefined };
  const result = validateIndianMobile(value, { required: true });
  if (!result.ok) return result;
  const normalized = normalizeIndianMobile(result.value);
  return normalized ? { ok: true, value: normalized } : { ok: false, error: "Invalid mobile number" };
}

export function submitEmail(
  value: string,
  { required = false } = {},
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const result = validateEmail(value, { required });
  if (!result.ok) return result;
  return { ok: true, value: result.value ?? undefined };
}

export function submitContactPhone(
  value: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (!value.trim()) return { ok: true, value: undefined };
  const result = validateContactPhone(value, { required: true });
  if (!result.ok) return result;
  return { ok: true, value: result.value ?? undefined };
}
