import { createHash } from "node:crypto";

export type GoogleTokenPayload = {
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  picture?: string;
  aud: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Google Sign-In is not configured");

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) throw new Error("Invalid Google token");

  const payload = (await res.json()) as GoogleTokenPayload & { error?: string };
  if (payload.error) throw new Error(payload.error);
  if (payload.aud !== clientId) throw new Error("Google token audience mismatch");

  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (!verified) throw new Error("Google email is not verified");

  if (!payload.sub || !payload.email) throw new Error("Incomplete Google profile");
  return payload;
}

export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID ?? null;
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return `******${phone.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
