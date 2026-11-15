/**
 * Capacity provider — Booking Engine reads capacity from here, never hardcodes
 * limits inside conflict/slot algorithms. Dynamically backed by operational calendar / operating hours.
 */
import { operationalCalendarService } from "./operationalCalendarService";

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

export class DefaultCapacityProvider implements CapacityProvider {
  readonly providerId = "operational-calendar-capacity-v1";
  private readonly explicitMax?: number;

  constructor(fallbackMax?: number) {
    if (fallbackMax !== undefined && fallbackMax !== 8) {
      this.explicitMax = fallbackMax;
    }
  }

  async getMaxConcurrentBookings(context: CapacityContext): Promise<number> {
    if (this.explicitMax !== undefined) {
      return this.explicitMax;
    }

    try {
      const [y, m, d] = context.scheduledDate.split("-").map((v) => parseInt(v, 10));
      const dateObj = new Date(y!, m! - 1, d!);
      const dayOfWeek = dateObj.getDay();

      const profile = await operationalCalendarService.getOperatingHoursForDay({
        dayOfWeek,
        cityId: context.cityId,
        branchId: context.branchId,
      });

      return profile.maxConcurrentSlots ?? 8;
    } catch {
      return 8;
    }
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
