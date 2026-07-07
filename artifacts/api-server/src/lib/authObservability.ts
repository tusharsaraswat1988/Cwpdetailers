import type { Request } from "express";
import { maskPhone } from "./googleAuth";

type AuthLogEvent =
  | "auth.otp.send"
  | "auth.otp.send.failed"
  | "auth.otp.verify"
  | "auth.otp.verify.failed"
  | "auth.login.password"
  | "auth.login.password.failed"
  | "auth.google"
  | "auth.google.failed"
  | "auth.forgot_password"
  | "auth.reset_password"
  | "auth.rate_limited";

export function logAuthEvent(
  req: Request,
  event: AuthLogEvent,
  fields: Record<string, unknown> = {},
): void {
  const phone = typeof fields.phone === "string" ? maskPhone(fields.phone) : undefined;
  const { phone: _p, code: _c, password: _pw, newPassword: _np, ...safe } = fields;
  req.log.info(
    {
      event,
      portal: fields.portal ?? "customer",
      ...(phone ? { maskedPhone: phone } : {}),
      ...safe,
    },
    event,
  );
}

/** Neutral client-facing copy — avoids account enumeration. */
export function neutralizeOtpSendError(message: string): string {
  if (
    /no account found|already registered|not registered as a customer|account suspended/i.test(
      message,
    )
  ) {
    return "We couldn't complete this request. Please try again.";
  }
  if (/too many otp/i.test(message)) {
    return "Too many attempts. Please wait and try again.";
  }
  if (/sms otp is not configured/i.test(message)) {
    return "Verification is temporarily unavailable. Please try again later.";
  }
  if (/name is required/i.test(message)) {
    return "Please enter your full name to continue.";
  }
  return "We couldn't complete this request. Please try again.";
}
