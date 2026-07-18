/**
 * Capacity evaluation — algorithms consume CapacityProvider, never embed limits.
 */
import { getCapacityProvider, type CapacityContext } from "./CapacityProvider";

export type CapacityCheckInput = CapacityContext & {
  currentCount: number;
};

export type CapacityResult = {
  available: boolean;
  currentCount: number;
  maxConcurrent: number;
  remaining: number;
};

export async function checkSlotCapacity(input: CapacityCheckInput): Promise<CapacityResult> {
  const maxConcurrent = await getCapacityProvider().getMaxConcurrentBookings({
    branchId: input.branchId,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    cityId: input.cityId,
  });
  const remaining = Math.max(0, maxConcurrent - input.currentCount);
  return {
    available: input.currentCount < maxConcurrent,
    currentCount: input.currentCount,
    maxConcurrent,
    remaining,
  };
}
