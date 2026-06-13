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

export type ClientPlateOcrOutput = PlateOcrResult & {
  displayRegistration: string | null;
};

/** Run Tesseract OCR on a plate photo (client-side). */
export async function recognizePlateFromImage(file: Blob): Promise<ClientPlateOcrOutput> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, {
    logger: () => {},
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -",
    });
    const { data } = await worker.recognize(file);
    const result = processPlateOcrOutput(data.text, data.confidence);
    return {
      ...result,
      displayRegistration: result.extractedRegistration
        ? normalizeRegistration(result.extractedRegistration)
        : null,
    };
  } finally {
    await worker.terminate();
  }
}
