import { SERVICE_LOCATION_TYPE_LABELS, type ServiceLocationType } from "@/features/service-locations/api";

/** Human-readable location for assignment queues — never show bare "Primary". */
export function formatAssignmentLocation(row: {
  serviceLocationLabel?: string | null;
  serviceLocationType?: string | null;
  serviceLocationCity?: string | null;
}): string {
  const label = row.serviceLocationLabel?.trim();
  if (!label) return "No location";

  const typeKey = row.serviceLocationType as ServiceLocationType | undefined;
  const typeLabel = typeKey && SERVICE_LOCATION_TYPE_LABELS[typeKey]
    ? SERVICE_LOCATION_TYPE_LABELS[typeKey]
    : null;
  const city = row.serviceLocationCity?.trim();

  const typePhrase = typeLabel && !label.toLowerCase().includes(typeLabel.toLowerCase())
    ? ` ${typeLabel}`
    : "";

  if (city && !label.toLowerCase().includes(city.toLowerCase())) {
    return `${label}${typePhrase} · ${city}`;
  }
  if (typePhrase) return `${label}${typePhrase}`;
  return label;
}
