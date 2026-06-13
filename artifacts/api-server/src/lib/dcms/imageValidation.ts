/**
 * Validates camera-captured photos using EXIF metadata.
 * Rejects gallery uploads, screenshots, and edited images.
 */

export type ExifPayload = {
  Make?: string;
  Model?: string;
  Software?: string;
  DateTimeOriginal?: string;
  CreateDate?: string;
  ModifyDate?: string;
  Orientation?: number;
  GPSLatitude?: number;
  GPSLongitude?: number;
  [key: string]: unknown;
};

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

const EDIT_SOFTWARE = /photoshop|lightroom|snapseed|picsart|canva|gimp|afterlight|vsco|facetune|beauty|editor|edited/i;
const SCREENSHOT_HINTS = /screenshot|screen.?shot|screen.?capture|screen.?recording|miui|oneui|ios|android.*capture/i;

function decodeBase64ToBuffer(imageBase64: string): Buffer {
  const raw = imageBase64.startsWith("data:") ? imageBase64.split(",")[1] ?? "" : imageBase64;
  return Buffer.from(raw, "base64");
}

/** Minimal JPEG EXIF parser for Make/Model/DateTimeOriginal/Software tags. */
function parseJpegExif(buffer: Buffer): ExifPayload | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const size = buffer.readUInt16BE(offset + 2);
    if (marker === 0xe1) {
      const exifHeader = buffer.subarray(offset + 4, offset + 4 + 6).toString("ascii");
      if (exifHeader.startsWith("Exif")) {
        return extractExifStrings(buffer.subarray(offset + 4, offset + 2 + size));
      }
    }
    offset += 2 + size;
  }
  return null;
}

function extractExifStrings(exifSegment: Buffer): ExifPayload {
  const result: ExifPayload = {};
  const text = exifSegment.toString("latin1");

  const pick = (tag: string) => {
    const idx = text.indexOf(tag);
    if (idx === -1) return undefined;
    const slice = text.slice(idx, idx + 80).replace(/[^\x20-\x7E]/g, " ").trim();
    const parts = slice.split(/\s{2,}/);
    return parts[0]?.replace(tag, "").trim() || undefined;
  };

  result.Make = pick("Make");
  result.Model = pick("Model");
  result.Software = pick("Software");
  result.DateTimeOriginal = pick("DateTimeOriginal") ?? pick("CreateDate");
  result.CreateDate = pick("CreateDate");

  return result;
}

export function mergeExif(server: ExifPayload | null, client?: ExifPayload | null): ExifPayload {
  return { ...(server ?? {}), ...(client ?? {}) };
}

export function validateCameraPhoto(imageBase64: string, clientExif?: ExifPayload | null): ExifPayload {
  if (!imageBase64) throw new ImageValidationError("Photo required");

  const buffer = decodeBase64ToBuffer(imageBase64);
  if (buffer.length < 1000) throw new ImageValidationError("Invalid image data");

  const serverExif = parseJpegExif(buffer);
  const exif = mergeExif(serverExif, clientExif);

  const make = String(exif.Make ?? "").trim();
  const model = String(exif.Model ?? "").trim();
  const software = String(exif.Software ?? "").trim();
  const dateTaken = exif.DateTimeOriginal ?? exif.CreateDate;

  if (!make && !model && !dateTaken) {
    throw new ImageValidationError("Missing camera metadata — use device camera only");
  }

  if (!dateTaken) {
    throw new ImageValidationError("Missing camera timestamp in image metadata");
  }

  const metaBlob = `${make} ${model} ${software}`.toLowerCase();
  if (SCREENSHOT_HINTS.test(metaBlob)) {
    throw new ImageValidationError("Screenshot uploads are not allowed");
  }

  if (software && EDIT_SOFTWARE.test(software)) {
    throw new ImageValidationError("Edited images are not allowed");
  }

  if (/screenshot|screen capture/i.test(metaBlob)) {
    throw new ImageValidationError("Screenshot uploads are not allowed");
  }

  return exif;
}

export function sanitizeExifForStorage(exif: ExifPayload): Record<string, unknown> {
  const allowed = ["Make", "Model", "Software", "DateTimeOriginal", "CreateDate", "ModifyDate", "Orientation", "GPSLatitude", "GPSLongitude"];
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (exif[k] != null) out[k] = exif[k];
  }
  return out;
}
