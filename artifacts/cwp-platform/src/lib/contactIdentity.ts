import {
  parseContactIdentity,
  contactConflictMessage,
  type ContactConflict,
  type ContactEntityType,
} from "@workspace/validation";
import { submitEmail, submitMobile } from "./contactForm";

export type ContactVerifyResult =
  | { available: true; phone: string; email?: string }
  | { available: false; error: string; conflict?: ContactConflict };

export async function verifyContactIdentity(input: {
  phone: string;
  email?: string;
  excludeEntity?: ContactEntityType;
  excludeId?: number;
}): Promise<ContactVerifyResult> {
  const phoneResult = submitMobile(input.phone);
  if (!phoneResult.ok) return { available: false, error: phoneResult.error };

  const emailResult = submitEmail(input.email ?? "");
  if (!emailResult.ok) return { available: false, error: emailResult.error };

  const parsed = parseContactIdentity(phoneResult.value, emailResult.value);
  if (!parsed.ok) return { available: false, error: parsed.error };

  const params = new URLSearchParams({
    phone: parsed.value.phone,
  });
  if (parsed.value.email) params.set("email", parsed.value.email);
  if (input.excludeEntity && input.excludeId) {
    params.set("excludeEntity", input.excludeEntity);
    params.set("excludeId", String(input.excludeId));
  }

  const res = await fetch(`/api/contact/verify?${params}`, { credentials: "include" });
  const body = await res.json().catch(() => ({}));

  if (res.ok && body.available) {
    return {
      available: true,
      phone: body.identity?.phone ?? parsed.value.phone,
      email: body.identity?.email ?? undefined,
    };
  }

  const conflict = body.conflict as ContactConflict | undefined;
  return {
    available: false,
    error: body.error ?? (conflict ? contactConflictMessage(conflict) : "Contact already registered"),
    conflict,
  };
}

export function formatContactConflict(conflict?: ContactConflict, fallback?: string): string {
  if (conflict) return contactConflictMessage(conflict);
  return fallback ?? "This mobile number or email is already registered";
}
