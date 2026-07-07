/** Client-side camera capture helpers — gallery upload disabled, EXIF hints for server validation. */

export type ClientExifPayload = {
  Make?: string;
  Model?: string;
  Software?: string;
  DateTimeOriginal?: string;
  CreateDate?: string;
};

/** Read minimal EXIF-like hints from JPEG binary (best-effort in browser). */
export async function extractClientExif(file: File): Promise<ClientExifPayload | null> {
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const text = Array.from(bytes.slice(0, Math.min(bytes.length, 65536)))
      .map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : " "))
      .join("");

    const pick = (tag: string) => {
      const idx = text.indexOf(tag);
      if (idx === -1) return undefined;
      return text.slice(idx + tag.length, idx + tag.length + 40).replace(/[^\x20-\x7E]/g, "").trim() || undefined;
    };

    return {
      Make: pick("Make"),
      Model: pick("Model"),
      Software: pick("Software"),
      DateTimeOriginal: pick("DateTimeOriginal") ?? pick("CreateDate"),
      CreateDate: pick("CreateDate"),
    };
  } catch {
    return null;
  }
}

/** Reject gallery picks — camera capture only. */
export function validateCameraFile(file: File): void {
  const ageMs = Date.now() - file.lastModified;
  if (ageMs > 5 * 60 * 1000) {
    throw new Error("Gallery uploads are disabled — use live camera capture");
  }
  if (file.size < 5000) {
    throw new Error("Invalid camera photo");
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
