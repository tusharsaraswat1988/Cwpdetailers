/** Contract registry product lines — synced from DCMS, entitlements, subscriptions. */
export const PRODUCT_LINES = {
  daily_cleaning: {
    id: "daily_cleaning",
    label: "Daily cleaning",
    category: "vehicle",
    assetType: "vehicle",
    hubSection: "dailyCleaning",
  },
  wash_package: {
    id: "wash_package",
    label: "Wash package",
    category: "vehicle",
    assetType: "vehicle",
    hubSection: "entitlements",
  },
  monthly_wash: {
    id: "monthly_wash",
    label: "Monthly wash",
    category: "vehicle",
    assetType: "vehicle",
    hubSection: "legacySubscriptions",
  },
  solar_amc: {
    id: "solar_amc",
    label: "Solar AMC",
    category: "solar",
    assetType: "solar_site",
    hubSection: "legacySubscriptions",
  },
  detailing_plan: {
    id: "detailing_plan",
    label: "Detailing plan",
    category: "vehicle",
    assetType: "vehicle",
    hubSection: "legacySubscriptions",
  },
} as const;

export type ProductLineId = keyof typeof PRODUCT_LINES;

export type ServiceProductFlow =
  | "dcms_subscription"
  | "grant_package"
  | "booking";

export type ServiceAssetRequirement = "vehicle" | "solar_site" | "none";

/** Admin wizard actions — each maps to a backend flow. */
export const SERVICE_PRODUCTS = {
  daily_cleaning: {
    id: "daily_cleaning",
    productLine: "daily_cleaning" as ProductLineId,
    label: "Daily car cleaning",
    description: "DCMS plan per vehicle",
    icon: "sparkles",
    flow: "dcms_subscription" as ServiceProductFlow,
    requiresAsset: "vehicle" as ServiceAssetRequirement,
  },
  wash_package: {
    id: "wash_package",
    productLine: "wash_package" as ProductLineId,
    label: "Car wash package",
    description: "Prepaid wash packages",
    icon: "package",
    flow: "grant_package" as ServiceProductFlow,
    requiresAsset: "vehicle" as ServiceAssetRequirement,
  },
  one_time_wash: {
    id: "one_time_wash",
    productLine: null,
    label: "One-time car wash",
    description: "Single doorstep wash booking",
    icon: "car",
    flow: "booking" as ServiceProductFlow,
    requiresAsset: "vehicle" as ServiceAssetRequirement,
  },
  one_time_solar: {
    id: "one_time_solar",
    productLine: null,
    label: "One-time solar cleaning",
    description: "Single solar panel cleaning",
    icon: "sun",
    flow: "booking" as ServiceProductFlow,
    requiresAsset: "solar_site" as ServiceAssetRequirement,
  },
  solar_amc: {
    id: "solar_amc",
    productLine: "solar_amc" as ProductLineId,
    label: "Solar AMC",
    description: "6 or 12 month visit package",
    icon: "sun",
    flow: "grant_package" as ServiceProductFlow,
    requiresAsset: "solar_site" as ServiceAssetRequirement,
  },
} as const;

export type ServiceProductId = keyof typeof SERVICE_PRODUCTS;

export type HubSectionId =
  | "contracts"
  | "dailyCleaning"
  | "entitlements"
  | "legacySubscriptions"
  | "solarSites"
  | "recentWork";

export const HUB_SECTIONS: Record<HubSectionId, {
  id: HubSectionId;
  label: string;
  productLines?: ProductLineId[];
  always?: boolean;
}> = {
  contracts: { id: "contracts", label: "Contract registry", always: true },
  dailyCleaning: { id: "dailyCleaning", label: "Daily car cleaning", productLines: ["daily_cleaning"] },
  entitlements: { id: "entitlements", label: "Wash packages", productLines: ["wash_package"] },
  legacySubscriptions: {
    id: "legacySubscriptions",
    label: "Service contracts",
    productLines: ["monthly_wash", "solar_amc", "detailing_plan"],
  },
  solarSites: { id: "solarSites", label: "Solar sites" },
  recentWork: { id: "recentWork", label: "Recent work", always: true },
};

export const SERVICE_PRODUCT_LIST = Object.values(SERVICE_PRODUCTS);

export function formatProductLineLabel(productLine: string): string {
  const def = PRODUCT_LINES[productLine as ProductLineId];
  return def?.label ?? productLine.replace(/_/g, " ");
}

export function getServiceProduct(id: ServiceProductId) {
  return SERVICE_PRODUCTS[id];
}
