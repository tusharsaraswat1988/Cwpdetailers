export {
  normalizeRegistration,
  extractRegistrationFromText,
  processPlateOcrOutput,
  shouldAutoSelectFromOcrConfidence,
  PLATE_OCR_AUTO_SELECT_THRESHOLD,
  type PlateOcrResult,
} from "@workspace/validation";

export function formatRegistrationDisplay(normalized: string): string {
  if (normalized.length < 4) return normalized;
  return normalized;
}
