import {
  extractRegistrationFromText,
  normalizeRegistration,
  processPlateOcrOutput,
  shouldAutoSelectFromOcrConfidence,
  type PlateOcrResult,
} from "@workspace/validation";

export {
  extractRegistrationFromText,
  normalizeRegistration,
  processPlateOcrOutput,
  shouldAutoSelectFromOcrConfidence,
  type PlateOcrResult,
};

/** OCR abstraction — processes raw OCR engine output into a structured plate result. */
export function recognizePlateFromOcrText(rawText: string, confidence: number): PlateOcrResult {
  return processPlateOcrOutput(rawText.trim(), confidence);
}

/** Resolve a registration string from raw OCR text (handles spaces, dashes, case). */
export function resolveRegistrationFromOcr(rawText: string): string | null {
  const extracted = extractRegistrationFromText(rawText);
  return extracted ? normalizeRegistration(extracted) : null;
}
