import { getApiErrorMessage } from "./apiError";

/** Neutral copy — never reveals whether an account exists. */
export const AUTH_NEUTRAL_ERROR = "We couldn't complete this request. Please try again.";

export type StructuredAuthCode =
  | "OTP_PROVIDER_UNAVAILABLE"
  | "OTP_DELIVERY_FAILED"
  | "OTP_RATE_LIMITED"
  | "OTP_INVALID_OR_EXPIRED"
  | "ACCOUNT_NOT_ELIGIBLE"
  | "ACCOUNT_LINK_CONFLICT"
  | "PORTAL_MISMATCH"
  | "AUTH_INTERNAL_ERROR";

const AUTH_ERROR_PATTERNS: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  {
    pattern: /no account found|already registered|not registered as a customer|account suspended|couldn't complete this request/i,
    message: AUTH_NEUTRAL_ERROR,
  },
  { pattern: /invalid or expired otp/i, message: "OTP expired or incorrect. Try again or tap Resend OTP." },
  { pattern: /too many/i, message: "Too many attempts. Please wait and try again." },
  { pattern: /network|failed to fetch|load failed/i, message: "Network problem. Check your connection and try again." },
  { pattern: /popup was blocked/i, message: "Google sign-in was blocked. Allow popups for this site and try again." },
  { pattern: /cancelled|canceled/i, message: "Sign-in was cancelled. Try again when you're ready." },
  { pattern: /google sign-in session expired/i, message: "Google sign-in timed out. Please try again." },
  { pattern: /invalid phone|invalid mobile/i, message: "Please enter a valid 10-digit mobile number." },
  { pattern: /invalid credentials|incorrect mobile/i, message: "Incorrect mobile number or password." },
  { pattern: /cannot sign in to the admin portal/i, message: "This phone number is not registered as an admin. Contact your super admin." },
  { pattern: /staff account|staff member|staff portal|staff login/i, message: "This number belongs to a staff account. Use Staff portal login (phone + password)." },
  { pattern: /administrator|admin portal|superadmin/i, message: "This account belongs to an administrator. Use the Admin portal to sign in." },
  { pattern: /cannot sign in here|correct portal|different account type/i, message: "This account uses a different login portal. Try customer or staff login." },
  { pattern: /sms otp is not configured|verification is temporarily unavailable/i, message: "Verification is temporarily unavailable. Please try again later." },
  { pattern: /unable to send verification code|delivery failed/i, message: "Unable to send verification code. Please try again in a few moments." },
];

export function extractApiErrorCode(err: unknown): StructuredAuthCode | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    code?: string;
    data?: { code?: string };
    response?: { data?: { code?: string } };
  };
  const code = e.data?.code ?? e.response?.data?.code ?? e.code;
  return typeof code === "string" ? (code as StructuredAuthCode) : null;
}

export function mapAuthErrorMessage(raw: string, code?: StructuredAuthCode | null): string {
  if (code === "OTP_PROVIDER_UNAVAILABLE") {
    return "Verification is temporarily unavailable. Please try again later.";
  }
  if (code === "OTP_DELIVERY_FAILED") {
    return "Unable to send verification code. Please try again in a few moments.";
  }
  if (code === "OTP_RATE_LIMITED") {
    return "Too many attempts. Please wait and try again.";
  }
  if (code === "OTP_INVALID_OR_EXPIRED") {
    return "OTP expired or incorrect. Try again or tap Resend OTP.";
  }

  for (const { pattern, message } of AUTH_ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  if (raw.length > 120 || raw.includes(" at ") || raw.includes("Error:")) {
    return AUTH_NEUTRAL_ERROR;
  }
  return raw;
}

export function getAuthErrorMessage(err: unknown, fallback = AUTH_NEUTRAL_ERROR): string {
  const code = extractApiErrorCode(err);
  const raw = getApiErrorMessage(err, fallback);
  return mapAuthErrorMessage(raw, code);
}
