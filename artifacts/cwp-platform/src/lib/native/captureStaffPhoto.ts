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

export type CapturedStaffPhotoWithGps = CapturedStaffPhoto & {
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  gpsUnavailable?: boolean;
  gpsUnavailableReason?: "underground_basement_no_signal" | "covered_parking_timeout" | "hardware_gps_unavailable";
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
  // Fire photo capture and location query concurrently for exact timestamp match
  const locationPromise = getStaffLocation("action")
    .then(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      gpsUnavailable: false,
      weakGpsFallback: false,
    }))
    .catch(() => {
      const cached = locationStoreSnapshot().lastKnownLocation;
      if (cached) {
        return {
          latitude: cached.latitude,
          longitude: cached.longitude,
          accuracy: cached.accuracy,
          gpsUnavailable: false,
          weakGpsFallback: true,
        };
      }
      // Basement signal loss fallback
      return {
        latitude: 0,
        longitude: 0,
        accuracy: 999,
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
    gpsUnavailable: locInfo.gpsUnavailable,
    gpsUnavailableReason: locInfo.gpsUnavailableReason,
    weakGpsFallback: locInfo.weakGpsFallback,
  };
}
