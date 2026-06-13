/** Indian vehicle registration: strip separators, uppercase. UP-65-AB-1234 → UP65AB1234 */
export function normalizeRegistration(reg: string): string {
  return reg.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Match Indian plate patterns with optional spaces/dashes between segments. */
const PLATE_PATTERN =
  /[A-Za-z]{2}[\s-]?\d{1,2}[\s-]?[A-Za-z]{1,3}[\s-]?\d{1,4}/g;

export function extractRegistrationFromText(text: string): string | null {
  const matches = text.match(PLATE_PATTERN);
  if (!matches?.length) return null;

  let best: string | null = null;
  let bestLen = 0;
  for (const m of matches) {
    const norm = normalizeRegistration(m);
    if (norm.length >= 6 && norm.length > bestLen) {
      best = m;
      bestLen = norm.length;
    }
  }
  return best;
}

export const PLATE_OCR_AUTO_SELECT_THRESHOLD = 90;

export function shouldAutoSelectFromOcrConfidence(confidence: number): boolean {
  return confidence > PLATE_OCR_AUTO_SELECT_THRESHOLD;
}

export type PlateOcrResult = {
  rawText: string;
  extractedRegistration: string | null;
  normalizedRegistration: string | null;
  confidence: number;
};

export function processPlateOcrOutput(rawText: string, confidence: number): PlateOcrResult {
  const extracted = extractRegistrationFromText(rawText);
  return {
    rawText,
    extractedRegistration: extracted,
    normalizedRegistration: extracted ? normalizeRegistration(extracted) : null,
    confidence,
  };
}
