import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "crypto";

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

export type CloudinaryUploadSignature = {
  uploadURL: string;
  objectPath: string;
  cloudinary: {
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    publicId: string;
  };
  metadata: {
    name: string;
    size: number;
    contentType: string;
  };
};

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new StorageConfigError(
      "Cloudinary is required. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

function resourceTypeForContentType(contentType: string): "image" | "video" | "raw" {
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("image/")) return "image";
  return "raw";
}

/**
 * Returns signed upload parameters for direct browser → Cloudinary uploads.
 * The client must POST multipart form data and persist the returned secure_url.
 */
export function createCloudinaryUploadSignature(input: {
  name: string;
  size: number;
  contentType: string;
}): CloudinaryUploadSignature {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const folder = process.env.CLOUDINARY_FOLDER ?? "cwp/varanasi";
  const publicId = randomUUID();
  const timestamp = Math.round(Date.now() / 1000);
  const resourceType = resourceTypeForContentType(input.contentType);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, public_id: publicId },
    apiSecret,
  );

  return {
    uploadURL: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    objectPath: `${folder}/${publicId}`,
    cloudinary: {
      apiKey,
      timestamp,
      signature,
      folder,
      publicId,
    },
    metadata: input,
  };
}

/** Resolve stored media references for API consumers. */
export function resolveStoredMediaUrl(stored: string): string {
  if (!stored) return stored;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  // Legacy Replit object paths are no longer served locally.
  return stored;
}
