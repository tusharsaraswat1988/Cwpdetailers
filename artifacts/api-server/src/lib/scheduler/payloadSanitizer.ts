/**
 * Payload and Error Sanitizer for Job Execution Observability.
 * Ensures that tokens, passwords, secrets, and raw sensitive customer data
 * are never leaked into execution logs, history tables, or admin dashboards.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "credential",
  "cardnumber",
  "card_number",
  "cvv",
  "otp",
  "webhook_secret",
]);

export function sanitizePayload(payload: any, depth = 0): any {
  if (depth > 6 || payload == null) return payload;

  if (typeof payload === "string") {
    // Redact Bearer tokens
    if (/bearer\s+[a-zA-Z0-9_\-\.]+/i.test(payload)) {
      return payload.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]");
    }
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item, depth + 1));
  }

  if (typeof payload === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || Array.from(SENSITIVE_KEYS).some((s) => lowerKey.includes(s))) {
        sanitized[key] = "[REDACTED]";
      } else if (lowerKey === "phone" && typeof val === "string" && val.length >= 10) {
        // Mask phone number (keep first 3 and last 3 digits)
        sanitized[key] = `${val.slice(0, 3)}****${val.slice(-3)}`;
      } else {
        sanitized[key] = sanitizePayload(val, depth + 1);
      }
    }
    return sanitized;
  }

  return payload;
}

export function sanitizeErrorMessage(error: any): { message: string; stack?: string } {
  if (!error) return { message: "Unknown error" };

  let message = "";
  let stack: string | undefined;

  if (error instanceof Error) {
    message = error.message;
    stack = error.stack;
  } else if (typeof error === "string") {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  // Redact potential connection string credentials or tokens in error message
  message = message.replace(/(postgresql:\/\/[^:]+:)([^@]+)(@)/gi, "$1[REDACTED]$3");
  if (stack) {
    stack = stack.replace(/(postgresql:\/\/[^:]+:)([^@]+)(@)/gi, "$1[REDACTED]$3");
  }

  return { message, stack };
}
