import {
  extractClientExif,
  readFileAsDataUrl,
  validateCameraFile,
  type ClientExifPayload,
} from "@/features/daily-cleaning/lib/cameraCapture";
import { isStaffNativeApp } from "./staffNative";
import { getStaffLocation } from "@/lib/location";
import { locationStoreSnapshot } from "@/lib/location/locationStore";

export type StaffCameraFacing = "front" | "rear";

export type CapturedStaffPhoto = {
  file: File;
  dataUrl: string;
  capturedAt: string;
  exif: ClientExifPayload | null;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
};

// Backwards-compatibility alias
export type StaffCapturedPhoto = CapturedStaffPhoto;

export function isCameraCancel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /cancel|cancelled|canceled|user cancelled|no image/i.test(msg);
}

export function isCameraPermissionDenied(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /permission|denied|access to camera|not allowed/i.test(msg);
}

export async function checkStaffCameraPermission(): Promise<{
  granted: boolean;
  canAsk: boolean;
  permanentlyDenied: boolean;
}> {
  if (isStaffNativeApp()) {
    try {
      const { Camera } = await import("@capacitor/camera");
      const status = await Camera.checkPermissions();
      const cameraState = status.camera;
      return {
        granted: cameraState === "granted",
        canAsk: cameraState === "prompt",
        permanentlyDenied: cameraState === "denied",
      };
    } catch {
      // fallback
    }
  }
  return { granted: true, canAsk: true, permanentlyDenied: false };
}

export async function requestStaffCameraPermission(): Promise<{
  granted: boolean;
  permanentlyDenied: boolean;
}> {
  if (isStaffNativeApp()) {
    try {
      const { Camera } = await import("@capacitor/camera");
      const status = await Camera.requestPermissions({ permissions: ["camera"] });
      return {
        granted: status.camera === "granted",
        permanentlyDenied: status.camera === "denied",
      };
    } catch {
      // fallback
    }
  }
  return { granted: true, permanentlyDenied: false };
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  return new File([blob], filename, { type, lastModified: Date.now() });
}

async function captureNativePhoto(facing: StaffCameraFacing): Promise<CapturedStaffPhoto> {
  const { Camera, CameraResultType, CameraSource, CameraDirection } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 80,
    width: 1600,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    direction: facing === "front" ? CameraDirection.Front : CameraDirection.Rear,
    correctOrientation: true,
    saveToGallery: false,
  });

  const dataUrl = photo.dataUrl;
  if (!dataUrl) throw new Error("Camera capture failed");

  const filename = `staff-${facing}-${Date.now()}.jpg`;
  const file = await dataUrlToFile(dataUrl, filename);
  return {
    file,
    dataUrl,
    capturedAt: new Date().toISOString(),
    exif: {
      Make: "CWP Staff",
      Model: "native-camera",
      Software: "capacitor-camera",
      CreateDate: new Date().toISOString(),
    },
  };
}

function captureWebPhoto(facing: StaffCameraFacing): Promise<CapturedStaffPhoto> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", facing === "front" ? "user" : "environment");
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error("No photo captured"));
          return;
        }
        validateCameraFile(file);
        const [dataUrl, exif] = await Promise.all([readFileAsDataUrl(file), extractClientExif(file)]);
        resolve({
          file,
          dataUrl,
          capturedAt: new Date(file.lastModified).toISOString(),
          exif,
        });
      } catch (err) {
        reject(err);
      }
    };
    input.addEventListener("cancel", () => reject(new Error("User cancelled photos app")));
    input.click();
  });
}

/** Native camera in the Android staff app; live camera file input on the web PWA. */
export async function captureStaffPhoto(facing: StaffCameraFacing): Promise<CapturedStaffPhoto> {
  if (isStaffNativeApp()) return captureNativePhoto(facing);
  return captureWebPhoto(facing);
}

export type GpsEvidenceSource =
  | "fresh_shutter"
  | "last_known_fallback"
  | "underground_basement"
  | "permission_denied"
  | "unavailable"
  | "low_accuracy";

export type CapturedStaffPhotoWithGps = CapturedStaffPhoto & {
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  gpsSource: GpsEvidenceSource;
  gpsTimestamp: string;
  isEvidenceAcceptable: boolean;
  gpsUnavailable?: boolean;
  gpsUnavailableReason?: "underground_basement_no_signal" | "covered_parking_timeout" | "hardware_gps_unavailable" | "permission_denied" | "low_accuracy";
  weakGpsFallback?: boolean;
};

/**
 * Capture-time location-verified photo proof.
 * Immediately binds device GPS coordinates at the instant of camera capture.
 * If GPS is unavailable (e.g. underground parking basement with concrete shielding),
 * falls back to recent cached campus location or flags audited basement fallback.
 */
export async function captureStaffPhotoWithGps(
  facing: StaffCameraFacing,
): Promise<CapturedStaffPhotoWithGps> {
  const shutterTimestamp = new Date().toISOString();

  // Fire photo capture and location query concurrently for exact timestamp match
  const locationPromise = getStaffLocation("action")
    .then(loc => {
      const accuracy = loc.accuracy ?? 50;
      const isLowAccuracy = accuracy > 200;
      return {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy,
        gpsSource: isLowAccuracy ? ("low_accuracy" as const) : ("fresh_shutter" as const),
        isEvidenceAcceptable: !isLowAccuracy,
        gpsUnavailable: false,
        gpsUnavailableReason: isLowAccuracy ? ("low_accuracy" as const) : undefined,
        weakGpsFallback: false,
      };
    })
    .catch(err => {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isPermissionDenied = /permission|denied/i.test(msg);

      if (isPermissionDenied) {
        return {
          latitude: 0,
          longitude: 0,
          accuracy: 999,
          gpsSource: "permission_denied" as const,
          isEvidenceAcceptable: false,
          gpsUnavailable: true,
          gpsUnavailableReason: "permission_denied" as const,
          weakGpsFallback: false,
        };
      }

      const cached = locationStoreSnapshot().lastKnownLocation;
      if (cached && Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude) && !(cached.latitude === 0 && cached.longitude === 0)) {
        return {
          latitude: cached.latitude,
          longitude: cached.longitude,
          accuracy: cached.accuracy ?? 100,
          gpsSource: "last_known_fallback" as const,
          isEvidenceAcceptable: true,
          gpsUnavailable: false,
          weakGpsFallback: true,
        };
      }

      // Basement signal loss fallback
      return {
        latitude: 0,
        longitude: 0,
        accuracy: 999,
        gpsSource: "underground_basement" as const,
        isEvidenceAcceptable: false,
        gpsUnavailable: true,
        gpsUnavailableReason: "underground_basement_no_signal" as const,
        weakGpsFallback: false,
      };
    });

  const photo = await captureStaffPhoto(facing);
  const locInfo = await locationPromise;

  return {
    ...photo,
    location: {
      latitude: locInfo.latitude,
      longitude: locInfo.longitude,
      accuracy: locInfo.accuracy,
    },
    gpsSource: locInfo.gpsSource,
    gpsTimestamp: shutterTimestamp,
    isEvidenceAcceptable: locInfo.isEvidenceAcceptable,
    gpsUnavailable: locInfo.gpsUnavailable,
    gpsUnavailableReason: locInfo.gpsUnavailableReason,
    weakGpsFallback: locInfo.weakGpsFallback,
  };
}
