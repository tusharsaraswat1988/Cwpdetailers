import type { usersTable } from "@workspace/db";

type UserRow = typeof usersTable.$inferSelect;

/** Staff portal always uses admin-created phone + password credentials. */
export function isStaffPasswordLogin(user: Pick<UserRow, "role" | "passwordHash">): boolean {
  return user.role === "staff" && Boolean(user.passwordHash);
}

/** User can sign in with a chosen password (not Google-only or OTP-only). */
export function userHasPassword(user: Pick<UserRow, "authProvider" | "passwordHash" | "role">): boolean {
  if (!user.passwordHash) return false;
  if (user.role === "staff") return true;
  return user.authProvider === "local" || user.authProvider === "hybrid";
}

export function authProviderForStaffPassword(): string {
  return "local";
}

export function authProviderAfterPasswordSet(user: Pick<UserRow, "googleId" | "role">): string {
  if (user.role === "staff") return authProviderForStaffPassword();
  return user.googleId ? "hybrid" : "local";
}

export function validateNewPassword(password: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof password !== "string" || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  return { ok: true, value: password };
}
