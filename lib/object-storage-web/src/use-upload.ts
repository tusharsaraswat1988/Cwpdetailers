import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

type CloudinarySig = {
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
};

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
  cloudinary?: CloudinarySig;
  /** Absolute https URL returned after Cloudinary upload */
  secureUrl?: string;
}

interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

async function uploadToCloudinary(file: File, presign: UploadResponse): Promise<string> {
  const sig = presign.cloudinary;
  if (!sig) throw new Error("Missing Cloudinary signature from upload endpoint");

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

/**
 * React hook for Cloudinary uploads via signed parameters from the API.
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      return response.json();
    },
    [basePath],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const uploadResponse = await requestUploadUrl(file);

        setProgress(30);
        const secureUrl = await uploadToCloudinary(file, uploadResponse);

        setProgress(100);
        const result = { ...uploadResponse, secureUrl, objectPath: secureUrl };
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, options],
  );

  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    ): Promise<{ method: "POST"; url: string; formData?: Record<string, string> }> => {
      const presign = await requestUploadUrl(file.data as File);
      const sig = presign.cloudinary;
      if (!sig) throw new Error("Missing Cloudinary signature");

      return {
        method: "POST",
        url: presign.uploadURL,
        formData: {
          api_key: sig.apiKey,
          timestamp: String(sig.timestamp),
          signature: sig.signature,
          folder: sig.folder,
          public_id: sig.publicId,
        },
      };
    },
    [requestUploadUrl],
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}
