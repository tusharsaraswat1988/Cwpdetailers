import {
  validateIndianMobile,
  validateEmail,
  validateContactPhone,
  normalizeIndianMobile,
  normalizeEmail,
} from "@workspace/validation";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseRequiredMobile(value: unknown, label = "Mobile number"): ParseResult<string> {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: false, error: `${label} is required` };
  }
  return validateIndianMobile(String(value), { required: true });
}

export function parseOptionalMobile(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  const result = validateIndianMobile(String(value), { required: true });
  if (!result.ok) return result;
  return { ok: true, value: result.value };
}

export function parseOptionalEmail(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  return validateEmail(String(value), { required: true });
}

export function parseOptionalContactPhone(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }
  return validateContactPhone(String(value), { required: true });
}

/** Normalize login identifier — phone digits or lowercase email. */
export function normalizeLoginIdentifier(
  phone: unknown,
  email: unknown,
): ParseResult<{ phone?: string; email?: string }> {
  const hasPhone = phone !== undefined && phone !== null && String(phone).trim() !== "";
  const hasEmail = email !== undefined && email !== null && String(email).trim() !== "";

  if (!hasPhone && !hasEmail) {
    return { ok: false, error: "Phone number or email is required" };
  }
  if (hasPhone && hasEmail) {
    return { ok: false, error: "Provide either phone number or email, not both" };
  }

  if (hasPhone) {
    const normalized = normalizeIndianMobile(String(phone));
    if (!normalized) {
      return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };
    }
    return { ok: true, value: { phone: normalized } };
  }

  const emailResult = validateEmail(String(email), { required: true });
  if (!emailResult.ok) return emailResult;
  return { ok: true, value: { email: emailResult.value! } };
}

export { normalizeIndianMobile, normalizeEmail };

export function applyMobileField(
  body: Record<string, unknown>,
  key: string,
  target: Record<string, unknown>,
  label?: string,
): ParseResult<void> {
  if (body[key] === undefined) return { ok: true, value: undefined };
  const result = parseRequiredMobile(body[key], label);
  if (!result.ok) return result;
  target[key] = result.value;
  return { ok: true, value: undefined };
}

export function applyOptionalMobileField(
  body: Record<string, unknown>,
  key: string,
  target: Record<string, unknown>,
): ParseResult<void> {
  if (body[key] === undefined) return { ok: true, value: undefined };
  const result = parseOptionalMobile(body[key]);
  if (!result.ok) return result;
  target[key] = result.value;
  return { ok: true, value: undefined };
}

export function applyOptionalEmailField(
  body: Record<string, unknown>,
  key: string,
  target: Record<string, unknown>,
): ParseResult<void> {
  if (body[key] === undefined) return { ok: true, value: undefined };
  const result = parseOptionalEmail(body[key]);
  if (!result.ok) return result;
  target[key] = result.value;
  return { ok: true, value: undefined };
}

export function applyOptionalContactPhoneField(
  body: Record<string, unknown>,
  key: string,
  target: Record<string, unknown>,
): ParseResult<void> {
  if (body[key] === undefined) return { ok: true, value: undefined };
  const result = parseOptionalContactPhone(body[key]);
  if (!result.ok) return result;
  target[key] = result.value;
  return { ok: true, value: undefined };
}
