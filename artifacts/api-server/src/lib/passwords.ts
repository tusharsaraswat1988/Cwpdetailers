import crypto from "crypto";
import argon2 from "argon2";

const LEGACY_SALT = "cwp_salt";

/** Legacy SHA-256 hashes are 64-char hex strings from pre-Phase-1 seeds. */
export function isLegacyPasswordHash(hash: string): boolean {
  return !hash.startsWith("$argon2") && /^[a-f0-9]{64}$/i.test(hash);
}

function legacyHashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (isLegacyPasswordHash(hash)) {
    return legacyHashPassword(password) === hash;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Verifies password and returns an argon2 hash when a legacy hash matched
 * so callers can upgrade stored credentials on successful login.
 */
export async function verifyPasswordWithUpgrade(
  password: string,
  hash: string,
): Promise<{ valid: boolean; upgradedHash?: string }> {
  const valid = await verifyPassword(password, hash);
  if (!valid) return { valid: false };
  if (isLegacyPasswordHash(hash)) {
    return { valid: true, upgradedHash: await hashPassword(password) };
  }
  return { valid: true };
}
