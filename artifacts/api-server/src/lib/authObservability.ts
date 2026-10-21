import type { Request } from "express";
import { maskPhone } from "./googleAuth";
import type { StructuredAuthErrorCode } from "./authIdentity";

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
  const requestId = req.id || req.headers["x-request-id"] || req.headers["x-correlation-id"];
  req.log.info(
    {
      event,
      requestId,
      portal: fields.portal ?? "customer",
      ...(phone ? { maskedPhone: phone } : {}),
      ...(fields.authErrorCode ? { authErrorCode: fields.authErrorCode } : {}),
      ...safe,
    },
    event,
  );
}

/** Neutral client-facing copy — avoids account enumeration while accurately reporting provider/system states. */
export function neutralizeOtpSendError(message: string, code?: StructuredAuthErrorCode): string {
  if (code === "OTP_PROVIDER_UNAVAILABLE" || /sms otp is not configured|verification is temporarily unavailable/i.test(message)) {
    return "Verification is temporarily unavailable. Please try again later.";
  }
  if (code === "OTP_DELIVERY_FAILED") {
    return "Unable to send verification code. Please try again in a few moments.";
  }
  if (code === "OTP_RATE_LIMITED" || /too many/i.test(message)) {
    return "Too many attempts. Please wait and try again.";
  }
  if (/name is required/i.test(message)) {
    return "Please enter your full name to continue.";
  }
  if (
    code === "ACCOUNT_NOT_ELIGIBLE" ||
    /no account found|already registered|not registered as a customer|account suspended/i.test(
      message,
    )
  ) {
    return "We couldn't complete this request. Please try again.";
  }
  return "We couldn't complete this request. Please try again.";
}
