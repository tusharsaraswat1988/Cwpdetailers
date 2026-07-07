import { getApiErrorMessage } from "./apiError";

/** Neutral copy — never reveals whether an account exists. */
export const AUTH_NEUTRAL_ERROR = "We couldn't complete this request. Please try again.";

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
  { pattern: /sms otp is not configured|verification is temporarily unavailable/i, message: "Verification is temporarily unavailable. Please try again later." },
];

export function mapAuthErrorMessage(raw: string): string {
  for (const { pattern, message } of AUTH_ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  if (raw.length > 120 || raw.includes(" at ") || raw.includes("Error:")) {
    return AUTH_NEUTRAL_ERROR;
  }
  return raw;
}

export function getAuthErrorMessage(err: unknown, fallback = AUTH_NEUTRAL_ERROR): string {
  const raw = getApiErrorMessage(err, fallback);
  return mapAuthErrorMessage(raw);
}
