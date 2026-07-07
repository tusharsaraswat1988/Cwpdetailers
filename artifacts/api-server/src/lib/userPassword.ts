import type { usersTable } from "@workspace/db";

type UserRow = typeof usersTable.$inferSelect;

/** User chose a password (phone login). Google-only accounts use authProvider "google". */
export function userHasPassword(user: Pick<UserRow, "authProvider">): boolean {
  return user.authProvider === "local" || user.authProvider === "hybrid";
}

export function authProviderAfterPasswordSet(user: Pick<UserRow, "googleId">): string {
  return user.googleId ? "hybrid" : "local";
}

export function validateNewPassword(password: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof password !== "string" || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  return { ok: true, value: password };
}
