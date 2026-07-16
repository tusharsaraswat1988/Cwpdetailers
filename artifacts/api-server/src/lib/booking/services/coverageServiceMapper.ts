import type { CoverageResult } from "../../coverage/CoverageTypes";
import type { ServiceAvailability, DiscoveredService } from "./ServiceDiscoveryService";

function mapAvailability(raw: string): ServiceAvailability {
  switch (raw) {
    case "available":
    case "AVAILABLE":
      return "AVAILABLE";
    case "coming_soon":
    case "COMING_SOON":
      return "COMING_SOON";
    case "temporarily_unavailable":
    case "TEMPORARILY_UNAVAILABLE":
      return "TEMPORARILY_UNAVAILABLE";
    default:
      return "UNAVAILABLE";
  }
}

/** Flatten CoverageResult service lists into unified discovery format. */
export function flattenCoverageServices(coverage: CoverageResult): DiscoveredService[] {
  const available = (coverage.availableServices ?? []).map((s) => ({
    serviceId: s.id,
    serviceName: s.name,
    availability: "AVAILABLE" as ServiceAvailability,
    serviceType: s.category ?? undefined,
  }));
  const comingSoon = (coverage.comingSoonServices ?? []).map((s) => ({
    serviceId: s.id,
    serviceName: s.name,
    availability: "COMING_SOON" as ServiceAvailability,
    serviceType: s.category ?? undefined,
  }));
  const unavailable = (coverage.unavailableServices ?? []).map((s) => ({
    serviceId: s.id,
    serviceName: s.name,
    availability: "UNAVAILABLE" as ServiceAvailability,
    serviceType: s.category ?? undefined,
  }));
  return [...available, ...comingSoon, ...unavailable];
}

export function isServiceAvailableInCoverage(coverage: CoverageResult, serviceId: number): boolean {
  if (!coverage.availableServices?.length) return true;
  return coverage.availableServices.some((s) => s.id === serviceId);
}
