/** Extract API error message from customFetch ApiError or axios-style errors */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;

  const e = err as {
    message?: string;
    data?: { error?: string; message?: string };
    response?: { data?: { error?: string; message?: string } };
  };

  const raw =
    e.data?.error ??
    e.data?.message ??
    e.response?.data?.error ??
    e.response?.data?.message ??
    (typeof e.message === "string" && !e.message.startsWith("HTTP ") ? e.message : undefined) ??
    fallback;

  return sanitizeUserErrorMessage(raw);
}

/** Hide raw SQL / drizzle dumps from end users. */
export function sanitizeUserErrorMessage(message: string): string {
  if (
    message.includes("Failed query:") ||
    message.includes("insert into \"") ||
    message.includes("params:")
  ) {
    return "Could not save. Please check the details and try again.";
  }
  return message;
}
