import { db, vehiclesTable, type Vehicle } from "@workspace/db";
import { eq } from "drizzle-orm";

export type VehicleReferencePhotoSlot = "front" | "rear" | "left" | "right";

export type VehicleReferencePhotos = {
  front: string | null;
  rear: string | null;
  left: string | null;
  right: string | null;
};

const SLOT_TO_COLUMN: Record<VehicleReferencePhotoSlot, keyof Vehicle> = {
  front: "refPhotoFrontUrl",
  rear: "refPhotoRearUrl",
  left: "refPhotoLeftUrl",
  right: "refPhotoRightUrl",
};

export function mapVehicleReferencePhotos(vehicle: Pick<Vehicle, "refPhotoFrontUrl" | "refPhotoRearUrl" | "refPhotoLeftUrl" | "refPhotoRightUrl">): VehicleReferencePhotos {
  return {
    front: vehicle.refPhotoFrontUrl ?? null,
    rear: vehicle.refPhotoRearUrl ?? null,
    left: vehicle.refPhotoLeftUrl ?? null,
    right: vehicle.refPhotoRightUrl ?? null,
  };
}

export function isReferencePhotoSetComplete(photos: VehicleReferencePhotos): boolean {
  return Boolean(photos.front && photos.rear);
}

export async function getVehicleReferencePhotos(vehicleId: number) {
  const [vehicle] = await db.select({
    id: vehiclesTable.id,
    registrationNumber: vehiclesTable.registrationNumber,
    make: vehiclesTable.make,
    model: vehiclesTable.model,
    refPhotoFrontUrl: vehiclesTable.refPhotoFrontUrl,
    refPhotoRearUrl: vehiclesTable.refPhotoRearUrl,
    refPhotoLeftUrl: vehiclesTable.refPhotoLeftUrl,
    refPhotoRightUrl: vehiclesTable.refPhotoRightUrl,
  }).from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);

  if (!vehicle) return null;

  const photos = mapVehicleReferencePhotos(vehicle);
  return {
    vehicleId: vehicle.id,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    photos,
    requiredComplete: isReferencePhotoSetComplete(photos),
  };
}

export async function updateVehicleReferencePhotos(
  vehicleId: number,
  updates: Partial<VehicleReferencePhotos>,
) {
  const patch: Partial<Vehicle> = { updatedAt: new Date() };
  for (const [slot, url] of Object.entries(updates) as [VehicleReferencePhotoSlot, string | null | undefined][]) {
    if (url === undefined) continue;
    patch[SLOT_TO_COLUMN[slot]] = url;
  }

  const [vehicle] = await db.update(vehiclesTable)
    .set(patch)
    .where(eq(vehiclesTable.id, vehicleId))
    .returning();

  if (!vehicle) return null;
  const photos = mapVehicleReferencePhotos(vehicle);
  return {
    vehicleId: vehicle.id,
    photos,
    requiredComplete: isReferencePhotoSetComplete(photos),
  };
}
