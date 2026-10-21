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

export interface ActionableAuthError {
  message: string;
  actionableStep?: string;
  actionUrl?: string;
  actionLabel?: string;
  code?: StructuredAuthCode | null;
}

const AUTH_ERROR_PATTERNS: ReadonlyArray<{ pattern: RegExp; message: string; actionableStep?: string }> = [
  {
    pattern: /no account found|already registered|not registered as a customer|account suspended|couldn't complete this request/i,
    message: AUTH_NEUTRAL_ERROR,
    actionableStep: "Please double check your mobile number or create a new account.",
  },
  {
    pattern: /invalid or expired otp/i,
    message: "OTP expired or incorrect. Try again or tap Resend OTP.",
    actionableStep: "Tap Resend OTP to receive a fresh verification code.",
  },
  {
    pattern: /too many/i,
    message: "Too many attempts. Please wait and try again.",
    actionableStep: "Wait a few moments or try signing in with a password.",
  },
  {
    pattern: /network|failed to fetch|load failed/i,
    message: "We couldn't reach the server. Check your connection and retry.",
    actionableStep: "Check your internet connection and tap retry.",
  },
  {
    pattern: /popup was blocked/i,
    message: "Google sign-in was blocked. Allow popups for this site and try again.",
    actionableStep: "Enable popups in your browser settings and try again.",
  },
  {
    pattern: /cancelled|canceled/i,
    message: "Sign-in was cancelled. You can try again or use another method.",
    actionableStep: "Select Google or enter your mobile number to continue.",
  },
  {
    pattern: /google sign-in session expired/i,
    message: "Google sign-in timed out. Please try again.",
    actionableStep: "Tap Google sign-in again to re-authenticate.",
  },
  {
    pattern: /invalid phone|invalid mobile/i,
    message: "Enter a valid 10-digit mobile number.",
    actionableStep: "Please enter 10 digits starting with 6, 7, 8, or 9.",
  },
  {
    pattern: /invalid credentials|incorrect mobile|incorrect password/i,
    message: "Incorrect mobile number or password.",
    actionableStep: "Check your password or reset it.",
  },
  {
    pattern: /cannot sign in to the admin portal/i,
    message: "This phone number is not registered as an admin. Contact your super admin.",
    actionableStep: "Contact your super administrator for portal access.",
  },
  {
    pattern: /staff account|staff member|staff portal|staff login/i,
    message: "This number belongs to a staff account. Use Staff portal login (phone + password).",
    actionableStep: "Use the Staff portal to sign in.",
  },
  {
    pattern: /administrator|admin portal|superadmin/i,
    message: "This account belongs to an administrator. Use the Admin portal to sign in.",
    actionableStep: "Use the Admin portal to sign in.",
  },
  {
    pattern: /cannot sign in here|correct portal|different account type/i,
    message: "This account uses a different login portal. Try customer or staff login.",
    actionableStep: "Please sign in through your assigned customer, staff, or admin portal.",
  },
  {
    pattern: /sms otp is not configured|verification is temporarily unavailable/i,
    message: "Verification is temporarily unavailable. Please try again later.",
    actionableStep: "You can sign in with your password instead, or try again shortly.",
  },
  {
    pattern: /unable to send verification code|delivery failed/i,
    message: "Unable to send verification code. Please try again in a few moments.",
    actionableStep: "Wait 30 seconds and request a new code, or use password login.",
  },
  {
    pattern: /session expired|jwt expired|token expired/i,
    message: "Your session has expired. Please sign in again.",
    actionableStep: "Sign in again to continue where you left off.",
  },
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
  if (code === "ACCOUNT_NOT_ELIGIBLE") {
    if (/suspended/i.test(raw)) return "Account suspended. Contact support.";
    return AUTH_NEUTRAL_ERROR;
  }
  if (code === "PORTAL_MISMATCH") {
    if (/staff/i.test(raw)) return "This number belongs to a staff account. Use Staff portal login (phone + password).";
    if (/admin/i.test(raw)) return "This account belongs to an administrator. Use the Admin portal to sign in.";
    return "This account uses a different login portal. Try customer or staff login.";
  }

  for (const { pattern, message } of AUTH_ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  if (raw.length > 120 || raw.includes(" at ") || raw.includes("Error:")) {
    return AUTH_NEUTRAL_ERROR;
  }
  return raw;
}

export function getActionableAuthDetails(err: unknown, fallback = AUTH_NEUTRAL_ERROR): ActionableAuthError {
  const code = extractApiErrorCode(err);
  const raw = getApiErrorMessage(err, fallback);
  const message = mapAuthErrorMessage(raw, code);

  let actionableStep: string | undefined;
  let actionUrl: string | undefined;
  let actionLabel: string | undefined;

  if (code === "OTP_PROVIDER_UNAVAILABLE" || code === "OTP_DELIVERY_FAILED") {
    actionableStep = "SMS service is unavailable. You can sign in using your password instead.";
    actionLabel = "Sign in with password";
  } else if (code === "PORTAL_MISMATCH" || /admin|staff/i.test(message)) {
    if (/admin/i.test(message)) {
      actionableStep = "Switch to the administrator sign-in portal.";
      actionUrl = "/admin/login";
      actionLabel = "Go to Admin Login";
    } else if (/staff/i.test(message)) {
      actionableStep = "Switch to the field staff sign-in portal.";
      actionUrl = "/staff/login";
      actionLabel = "Go to Staff Portal";
    }
  } else if (code === "OTP_RATE_LIMITED") {
    actionableStep = "Please wait before making another request.";
  } else if (/password/i.test(raw) && /incorrect/i.test(raw)) {
    actionableStep = "Check your password or reset it.";
    actionUrl = "/forgot-password";
    actionLabel = "Reset password";
  }

  return {
    message,
    actionableStep,
    actionUrl,
    actionLabel,
    code,
  };
}

export function getAuthErrorMessage(err: unknown, fallback = AUTH_NEUTRAL_ERROR): string {
  const code = extractApiErrorCode(err);
  const raw = getApiErrorMessage(err, fallback);
  return mapAuthErrorMessage(raw, code);
}
