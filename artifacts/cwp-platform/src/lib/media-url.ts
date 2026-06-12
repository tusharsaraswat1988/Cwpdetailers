/**
 * Resolve a stored media reference to a browser-loadable URL.
 * Cloudinary secure URLs are stored as absolute https links on bookings/assets.
 */
export function resolveMediaUrl(stored: string | null | undefined): string {
  if (!stored) return "";
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  // Legacy local object paths from pre-Phase-1 uploads are no longer served.
  if (stored.startsWith("/objects/") || stored.startsWith("/api/storage")) {
    return stored.startsWith("/api") ? stored : `/api/storage${stored}`;
  }
  return stored;
}

export type CloudinaryUploadSignatureResponse = {
  uploadURL: string;
  objectPath: string;
  cloudinary?: {
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    publicId: string;
  };
};

/** Upload a file directly to Cloudinary using a signed signature from the API. */
export async function uploadFileToCloudinary(
  file: File,
  presign: CloudinaryUploadSignatureResponse,
): Promise<string> {
  const sig = presign.cloudinary;
  if (!sig) {
    throw new Error("Missing Cloudinary signature from upload endpoint");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  form.append("public_id", sig.publicId);

  const res = await fetch(presign.uploadURL, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!data.secure_url) {
    throw new Error(data.error?.message ?? "Cloudinary did not return secure_url");
  }
  return data.secure_url;
}
