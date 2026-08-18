import { createHash, randomInt } from "node:crypto";
import { hashOtpCode } from "../googleAuth";
import type { ExtraServiceCommercialSource } from "@workspace/db";

export const EXTRA_SERVICE_OTP_TTL_MS = 5 * 60 * 1000;
export const EXTRA_SERVICE_OTP_MAX_ATTEMPTS = 5;
export const OPEN_EXTRA_SERVICE_STATUSES = [
  "pending_customer_approval",
  "customer_approved",
] as const;

export type ExtraServiceFingerprintInput = {
  customerId: number;
  staffId: number;
  vehicleId: number;
  serviceId: number;
  addonIds: number[];
  amount: string | number;
  commercialSource: ExtraServiceCommercialSource;
  dcmsSubscriptionId: number | null;
};

export function normalizeAmount(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

export function normalizeAddonIds(addonIds: number[] | null | undefined): number[] {
  const unique = [...new Set((addonIds ?? []).filter(id => Number.isInteger(id) && id > 0))];
  unique.sort((a, b) => a - b);
  return unique;
}

/** Commercial identity of the proposal — changing any field requires a new request. */
export function extraServiceFingerprint(input: ExtraServiceFingerprintInput): string {
  const canonical = [
    input.customerId,
    input.staffId,
    input.vehicleId,
    input.serviceId,
    normalizeAddonIds(input.addonIds).join(","),
    normalizeAmount(input.amount),
    input.commercialSource,
    input.dcmsSubscriptionId ?? "",
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function extraServiceOtpBindingHash(code: string, requestId: number, fingerprint: string): string {
  return hashOtpCode(`${code.trim()}:${requestId}:${fingerprint}`);
}

export function generateExtraServiceOtp(): string {
  return String(randomInt(1000, 10000));
}

export function isOtpExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

export function formatInr(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${Math.round(n)}`;
}
