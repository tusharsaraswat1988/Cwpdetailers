import { uploadFileToCloudinary, type CloudinaryUploadSignatureResponse } from "@/lib/media-url";
import { dataUrlToFile } from "@/lib/native/captureStaffPhoto";
import { addExecutionPhotos } from "@/features/service-executions/api";
import { connectivityService } from "./connectivityService";
import { offlineQueue, type QueueItem } from "./offlineQueue";

export const STAFF_PHOTO_QUEUE_URL = "cwp://staff-photo";

export type StaffPhotoQueuePayload = {
  jobId: number;
  source: "booking" | "execution";
  executionId?: number;
  kind: "before" | "after";
  field?: "beforePhotoUrl" | "afterPhotoUrl";
  dataUrl: string;
  fileName: string;
  contentType: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  existingBeforeUrls?: string[];
  existingAfterUrls?: string[];
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
};

export async function enqueueStaffPhotoUpload(
  payload: StaffPhotoQueuePayload,
  label: string,
): Promise<QueueItem> {
  return offlineQueue.enqueue({
    type: "staff_photo",
    label,
    url: STAFF_PHOTO_QUEUE_URL,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function requestPresign(file: File): Promise<CloudinaryUploadSignatureResponse> {
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });
  if (!res.ok) {
    throw new Error("Presign failed");
  }
  return res.json() as Promise<CloudinaryUploadSignatureResponse>;
}

async function patchBookingPhotos(payload: StaffPhotoQueuePayload, secureUrl: string): Promise<void> {
  const currentBefore = payload.existingBeforeUrls ?? [];
  const currentAfter = payload.existingAfterUrls ?? [];
  const nextBefore = payload.kind === "before" ? [...currentBefore, secureUrl] : currentBefore;
  const nextAfter = payload.kind === "after" ? [...currentAfter, secureUrl] : currentAfter;
  const nextProof = [...nextBefore, ...nextAfter];

  const body: Record<string, unknown> = payload.field
    ? { [payload.field]: secureUrl }
    : {
        proofPhotoUrls: nextProof,
        beforePhotoUrl: nextBefore[0] ?? payload.beforePhotoUrl,
        afterPhotoUrl: nextAfter[0] ?? payload.afterPhotoUrl,
      };

  const res = await fetch(`/api/bookings/${payload.jobId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save photo on booking");
}

export async function processStaffPhotoQueueItem(item: QueueItem): Promise<void> {
  if (!item.body) throw new Error("Missing photo payload");
  const payload = JSON.parse(item.body) as StaffPhotoQueuePayload;
  const file = await dataUrlToFile(payload.dataUrl, payload.fileName || "staff-photo.jpg");
  const presign = await requestPresign(file);
  const secureUrl = await uploadFileToCloudinary(file, presign);

  if (payload.source === "execution") {
    const executionId = payload.executionId ?? payload.jobId;
    await addExecutionPhotos(executionId, [{
      kind: payload.kind,
      url: secureUrl,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
    }]);
    return;
  }

  await patchBookingPhotos(payload, secureUrl);
}

export function isNetworkUploadFailure(err: unknown): boolean {
  if (!connectivityService.canExecuteWrites()) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|failed to fetch|Load failed/i.test(err.message)) return true;
  return false;
}
