/**
 * Capacity provider — Booking Engine reads capacity from here, never hardcodes
 * limits inside conflict/slot algorithms. Later backed by Business Settings.
 */

export type CapacityContext = {
  branchId?: number | null;
  scheduledDate: string;
  /** Candidate start time (HH:mm) or ISO — provider may ignore granularity. */
  scheduledTime?: string | null;
  cityId?: number | null;
};

export type CapacityProvider = {
  readonly providerId: string;
  /** Max concurrent bookings allowed in the evaluated window for this context. */
  getMaxConcurrentBookings(context: CapacityContext): Promise<number> | number;
};

/**
 * Default provider used until Business Settings owns capacity.
 * Value lives here — not inside ConflictDetector / SlotService algorithms.
 */
export class DefaultCapacityProvider implements CapacityProvider {
  readonly providerId = "default-capacity-v1";

  constructor(private readonly defaultMax = 8) {}

  getMaxConcurrentBookings(_context: CapacityContext): number {
    return this.defaultMax;
  }
}

let activeCapacityProvider: CapacityProvider = new DefaultCapacityProvider();

export function getCapacityProvider(): CapacityProvider {
  return activeCapacityProvider;
}

export function setCapacityProvider(provider: CapacityProvider): void {
  activeCapacityProvider = provider;
}

export function resetCapacityProvider(): void {
  activeCapacityProvider = new DefaultCapacityProvider();
}
