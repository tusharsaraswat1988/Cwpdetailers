import type { Request } from "express";
import { maskPhone } from "./googleAuth";
import type { StructuredAuthErrorCode } from "./authIdentity";
import { authMetrics, type AuthMethod } from "./authMetrics";

export type AuthLogEvent =
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
  | "auth.logout"
  | "auth.rate_limited";

function mapEventToMetric(event: AuthLogEvent): { method: AuthMethod; isSuccess: boolean } | null {
  switch (event) {
    case "auth.otp.send":
      return { method: "otp_send", isSuccess: true };
    case "auth.otp.send.failed":
      return { method: "otp_send", isSuccess: false };
    case "auth.otp.verify":
      return { method: "otp_verify", isSuccess: true };
    case "auth.otp.verify.failed":
      return { method: "otp_verify", isSuccess: false };
    case "auth.login.password":
      return { method: "password", isSuccess: true };
    case "auth.login.password.failed":
      return { method: "password", isSuccess: false };
    case "auth.google":
      return { method: "google", isSuccess: true };
    case "auth.google.failed":
      return { method: "google", isSuccess: false };
    case "auth.logout":
      return { method: "logout", isSuccess: true };
    case "auth.reset_password":
      return { method: "reset_password", isSuccess: true };
    default:
      return null;
  }
}

export function logAuthEvent(
  req: Request,
  event: AuthLogEvent,
  fields: Record<string, unknown> = {},
): void {
  try {
    const phone = typeof fields.phone === "string" ? maskPhone(fields.phone) : undefined;
    // Strictly purge credentials, OTP codes, session tokens and raw passwords
    const {
      phone: _p,
      code: _c,
      password: _pw,
      newPassword: _np,
      token: _t,
      idToken: _it,
      linkToken: _lt,
      sessionCookie: _sc,
      durationMs,
      authErrorCode,
      ...safe
    } = fields;

    const requestId = req.id || req.headers["x-request-id"] || req.headers["x-correlation-id"];
    const duration = typeof durationMs === "number" ? Math.round(durationMs) : undefined;
    const errorCode = typeof authErrorCode === "string" ? authErrorCode : undefined;

    const logPayload = {
      event,
      requestId,
      portal: fields.portal ?? "customer",
      ...(phone ? { maskedPhone: phone } : {}),
      ...(errorCode ? { authErrorCode: errorCode } : {}),
      ...(duration !== undefined ? { durationMs: duration } : {}),
      ...safe,
    };

    if (req.log && typeof req.log.info === "function") {
      if (event.endsWith(".failed")) {
        req.log.warn(logPayload, event);
      } else {
        req.log.info(logPayload, event);
      }
    }

    // Update operational metrics registry
    const metricMap = mapEventToMetric(event);
    if (metricMap) {
      const isProvider = errorCode === "OTP_PROVIDER_UNAVAILABLE" || errorCode === "OTP_DELIVERY_FAILED";
      authMetrics.recordOutcome(
        metricMap.method,
        metricMap.isSuccess ? "success" : isProvider ? "provider_error" : "failure",
        {
          durationMs: duration,
          errorCode,
          isProviderError: isProvider,
        },
      );
    } else if (event === "auth.rate_limited") {
      authMetrics.recordOutcome("otp_send", "rate_limited", { errorCode: "OTP_RATE_LIMITED" });
    }
  } catch (err) {
    // Observability / metrics errors must never disrupt the primary authentication flow
    if (process.env.NODE_ENV !== "test") {
      console.error("[AUTH_OBSERVABILITY_ERROR] Failed to record auth telemetry:", err);
    }
  }
}

/** Helper to track execution time of an authentication span */
export function startAuthSpan() {
  const start = Date.now();
  return {
    getDurationMs(): number {
      return Date.now() - start;
    },
  };
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
