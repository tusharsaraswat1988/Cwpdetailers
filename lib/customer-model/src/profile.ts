import {
  HUB_SECTIONS,
  PRODUCT_LINES,
  SERVICE_PRODUCTS,
  type HubSectionId,
  type ProductLineId,
  type ServiceProductId,
} from "./products";
import {
  CUSTOMER_PERSONAS,
  personaForProductLine,
  type CustomerLifecycle,
  type CustomerPersonaId,
} from "./personas";

export type CustomerProfileInput = {
  status: string;
  legacySegment?: string | null;
  reactivatedAt?: string | Date | null;
  gstin?: string | null;
  billingName?: string | null;
  vehicleCount: number;
  solarSiteCount: number;
  activeProductLines: ProductLineId[];
  activeContracts: number;
  recentWorkCount: number;
};

export type CustomerProfileBadge = {
  id: CustomerPersonaId;
  label: string;
  tone: string;
};

export type CustomerProfile = {
  primaryPersona: CustomerPersonaId;
  personas: CustomerPersonaId[];
  lifecycle: CustomerLifecycle;
  activeProductLines: ProductLineId[];
  availableServiceProducts: ServiceProductId[];
  visibleSections: HubSectionId[];
  labels: {
    primary: string;
    description: string;
    badges: CustomerProfileBadge[];
  };
};

const ACTIVE_STATUSES = new Set(["active", "paused", "expiring"]);

function resolveLifecycle(input: CustomerProfileInput): CustomerLifecycle {
  if (input.legacySegment === "legacy_contact" && input.status === "inactive") {
    return "legacy_dormant";
  }
  if (input.reactivatedAt) return "reactivated";
  if (input.status === "suspended") return "suspended";
  if (input.status === "inactive") return "inactive";
  return "active";
}

function detectPersonas(input: CustomerProfileInput, lifecycle: CustomerLifecycle): CustomerPersonaId[] {
  const found = new Set<CustomerPersonaId>();

  if (lifecycle === "legacy_dormant") found.add("legacy_contact");
  if (input.reactivatedAt) found.add("reactivated");
  if (input.gstin || input.billingName) found.add("b2b");

  for (const line of input.activeProductLines) {
    const persona = personaForProductLine(line);
    if (persona) found.add(persona);
  }

  if (input.solarSiteCount > 0) found.add("solar_owner");
  if (input.vehicleCount > 0) found.add("vehicle_owner");

  const hasActivePlan = input.activeContracts > 0;
  if (!hasActivePlan && input.recentWorkCount > 0 && lifecycle !== "legacy_dormant") {
    found.add("transactional");
  }
  if (!hasActivePlan && input.recentWorkCount === 0 && lifecycle === "active") {
    found.add("prospect");
  }
  if (lifecycle === "inactive" && !found.has("legacy_contact")) {
    found.add("dormant");
  }

  return [...found].sort(
    (a, b) => CUSTOMER_PERSONAS[b].priority - CUSTOMER_PERSONAS[a].priority,
  );
}

function resolvePrimaryPersona(personas: CustomerPersonaId[]): CustomerPersonaId {
  if (personas.length === 0) return "prospect";
  return personas[0];
}

function resolveAvailableProducts(lifecycle: CustomerLifecycle): ServiceProductId[] {
  if (lifecycle === "suspended") return [];
  if (lifecycle === "legacy_dormant") {
    return (Object.keys(SERVICE_PRODUCTS) as ServiceProductId[]);
  }
  return (Object.keys(SERVICE_PRODUCTS) as ServiceProductId[]);
}

function resolveVisibleSections(input: CustomerProfileInput): HubSectionId[] {
  const sections: HubSectionId[] = ["contracts"];

  const activeSet = new Set(input.activeProductLines);
  const hasData = {
    dailyCleaning: activeSet.has("daily_cleaning"),
    entitlements: activeSet.has("wash_package"),
    legacySubscriptions: ["monthly_wash", "solar_amc", "detailing_plan"].some(l => activeSet.has(l as ProductLineId)),
    solarSites: input.solarSiteCount > 0 || activeSet.has("solar_amc"),
  };

  for (const [id, def] of Object.entries(HUB_SECTIONS) as [HubSectionId, typeof HUB_SECTIONS[HubSectionId]][]) {
    if (def.always) continue;
    if (id === "dailyCleaning" && (hasData.dailyCleaning || input.vehicleCount > 0)) sections.push(id);
    else if (id === "entitlements" && (hasData.entitlements || input.vehicleCount > 0)) sections.push(id);
    else if (id === "legacySubscriptions" && hasData.legacySubscriptions) sections.push(id);
    else if (id === "solarSites" && hasData.solarSites) sections.push(id);
  }

  sections.push("recentWork");
  return sections;
}

/** Derive active product lines from contract rows. */
export function activeProductLinesFromContracts(
  contracts: Array<{ productLine: string; status: string }>,
): ProductLineId[] {
  const lines = new Set<ProductLineId>();
  for (const c of contracts) {
    if (!ACTIVE_STATUSES.has(c.status)) continue;
    if (c.productLine in PRODUCT_LINES) {
      lines.add(c.productLine as ProductLineId);
    }
  }
  return [...lines];
}

export function buildCustomerProfile(input: CustomerProfileInput): CustomerProfile {
  const lifecycle = resolveLifecycle(input);
  const personas = detectPersonas(input, lifecycle);
  const primaryPersona = resolvePrimaryPersona(personas);
  const primaryDef = CUSTOMER_PERSONAS[primaryPersona];

  return {
    primaryPersona,
    personas,
    lifecycle,
    activeProductLines: input.activeProductLines,
    availableServiceProducts: resolveAvailableProducts(lifecycle),
    visibleSections: resolveVisibleSections(input),
    labels: {
      primary: primaryDef.label,
      description: primaryDef.description,
      badges: personas.map(id => ({
        id,
        label: CUSTOMER_PERSONAS[id].label,
        tone: CUSTOMER_PERSONAS[id].tone,
      })),
    },
  };
}
