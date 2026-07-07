export type StaffGpsCoords = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type LocationPermissionState =
  | "checking"
  | "granted"
  | "prompt"
  | "denied"
  | "unsupported";

/** navigation = cached 30s; action = fresh high-accuracy fix */
export type GpsRequestMode = "navigation" | "action" | "background";

export type StaffLocationLogRow = {
  id: number;
  staffId: number;
  bookingId?: number | null;
  action: "attendance" | "en_route" | "job_start" | "job_complete";
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  geoFenceVerified?: boolean | null;
  geoFenceRadiusMeters?: number | null;
  distanceMeters?: number | null;
  targetLatitude?: number | null;
  targetLongitude?: number | null;
  recordedAt: string;
  metadata?: Record<string, unknown>;
};

export type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};
