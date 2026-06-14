const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function normalizeGstin(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const normalized = String(value).trim().toUpperCase();
  if (!GSTIN_RE.test(normalized)) {
    throw new Error("Invalid GSTIN format (15 characters, e.g. 09ABCDE1234F1Z5)");
  }
  return normalized;
}
