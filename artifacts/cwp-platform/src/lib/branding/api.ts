import type { BrandAssetSlot, PublicBranding } from "./types";

async function brandingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPublicBranding(): Promise<PublicBranding> {
  return brandingFetch<PublicBranding>("/branding/public");
}

export function fetchAdminBranding(): Promise<Record<string, unknown>> {
  return brandingFetch("/branding");
}

export function updateBranding(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return brandingFetch("/branding", { method: "PUT", body: JSON.stringify(data) });
}

export function uploadBrandingAsset(payload: {
  url: string;
  slot: BrandAssetSlot;
  contentType?: string;
  size?: number;
  svgContent?: string;
  regenerateDerivatives?: boolean;
}): Promise<Record<string, unknown>> {
  return brandingFetch("/branding/upload", { method: "POST", body: JSON.stringify(payload) });
}

export function processBrandingAssets(): Promise<Record<string, unknown>> {
  return brandingFetch("/branding/process", { method: "POST", body: "{}" });
}

export type BrandingManifestPortal = "main" | "admin" | "customer" | "staff" | "franchisee";

export function brandingManifestUrl(portal: BrandingManifestPortal): string {
  return `/api/branding/public/manifest/${portal}`;
}
