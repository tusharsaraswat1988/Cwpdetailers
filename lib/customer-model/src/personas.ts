import type { ProductLineId } from "./products";

/** Computed customer personas — derived from contracts, assets, and account state. */
export const CUSTOMER_PERSONAS = {
  legacy_contact: {
    id: "legacy_contact",
    label: "Legacy contact",
    description: "Imported dormant contact — re-engage or add a service",
    priority: 100,
    tone: "muted",
  },
  reactivated: {
    id: "reactivated",
    label: "Reactivated",
    description: "Previously dormant, now active again",
    priority: 95,
    tone: "success",
  },
  daily_cleaning: {
    id: "daily_cleaning",
    label: "Daily cleaning",
    description: "Active DCMS subscriber",
    priority: 90,
    tone: "primary",
    productLine: "daily_cleaning",
  },
  solar_amc: {
    id: "solar_amc",
    label: "Solar AMC",
    description: "Solar annual maintenance contract",
    priority: 85,
    tone: "primary",
    productLine: "solar_amc",
  },
  wash_package: {
    id: "wash_package",
    label: "Package customer",
    description: "Prepaid wash credits on account",
    priority: 80,
    tone: "primary",
    productLine: "wash_package",
  },
  monthly_wash: {
    id: "monthly_wash",
    label: "Monthly wash",
    description: "Recurring monthly wash contract",
    priority: 75,
    tone: "primary",
    productLine: "monthly_wash",
  },
  detailing: {
    id: "detailing",
    label: "Detailing",
    description: "Detailing plan or credits",
    priority: 70,
    tone: "primary",
    productLine: "detailing_plan",
  },
  b2b: {
    id: "b2b",
    label: "B2B",
    description: "GST billing profile",
    priority: 60,
    tone: "secondary",
  },
  solar_owner: {
    id: "solar_owner",
    label: "Solar owner",
    description: "Has registered solar site(s)",
    priority: 55,
    tone: "secondary",
  },
  vehicle_owner: {
    id: "vehicle_owner",
    label: "Vehicle owner",
    description: "Has registered vehicle(s)",
    priority: 50,
    tone: "secondary",
  },
  transactional: {
    id: "transactional",
    label: "One-time",
    description: "Bookings without active plan",
    priority: 40,
    tone: "secondary",
  },
  prospect: {
    id: "prospect",
    label: "Prospect",
    description: "Active account, no services yet",
    priority: 20,
    tone: "muted",
  },
  dormant: {
    id: "dormant",
    label: "Dormant",
    description: "Inactive account",
    priority: 10,
    tone: "muted",
  },
} as const;

export type CustomerPersonaId = keyof typeof CUSTOMER_PERSONAS;

export type CustomerLifecycle =
  | "active"
  | "inactive"
  | "suspended"
  | "legacy_dormant"
  | "reactivated";

const PERSONA_BY_PRODUCT: Partial<Record<ProductLineId, CustomerPersonaId>> = {
  daily_cleaning: "daily_cleaning",
  wash_package: "wash_package",
  monthly_wash: "monthly_wash",
  solar_amc: "solar_amc",
  detailing_plan: "detailing",
};

export function personaForProductLine(productLine: ProductLineId): CustomerPersonaId | null {
  return PERSONA_BY_PRODUCT[productLine] ?? null;
}

export function getPersonaDef(id: CustomerPersonaId) {
  return CUSTOMER_PERSONAS[id];
}
