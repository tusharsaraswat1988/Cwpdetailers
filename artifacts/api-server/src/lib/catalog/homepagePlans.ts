import {
  db,
  catalogPackagesTable,
  servicePlansTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { listPlans } from "../dcms/planService";
import { resolveCityId } from "./pricingEngine";

export type HomepagePlanCard = {
  id: number;
  source: "package" | "dcms" | "legacy_plan";
  name: string;
  price: string;
  description?: string | null;
  features?: string[];
  tag?: string | null;
  isHighlighted: boolean;
  validityDays?: number;
  durationMonths?: number | null;
  includedCleanings?: number;
  includedWashes?: number;
  scopeLabel?: string | null;
};

export async function listHomepagePlans(citySlug?: string): Promise<HomepagePlanCard[]> {
  const cityId = citySlug ? await resolveCityId(citySlug) : null;
  const items: HomepagePlanCard[] = [];

  const pkgConditions = [
    eq(catalogPackagesTable.status, "active"),
    eq(catalogPackagesTable.showOnHomepage, true),
  ];
  if (cityId) {
    pkgConditions.push(eq(catalogPackagesTable.cityId, cityId));
  }

  const packages = await db.select().from(catalogPackagesTable)
    .where(and(...pkgConditions))
    .orderBy(asc(catalogPackagesTable.sortOrder));

  for (const pkg of packages) {
    items.push({
      id: pkg.id,
      source: "package",
      name: pkg.name,
      price: String(pkg.price),
      description: pkg.description ?? pkg.shortDescription,
      features: (pkg.features as string[]) ?? [],
      tag: pkg.tag,
      isHighlighted: pkg.isHighlighted,
      validityDays: pkg.validityDays,
    });
  }

  const legacyPlans = await db.select().from(servicePlansTable)
    .where(and(
      eq(servicePlansTable.isActive, true),
      eq(servicePlansTable.showOnHomepage, true),
    ))
    .orderBy(asc(servicePlansTable.sortOrder));

  for (const plan of legacyPlans) {
    if (cityId && plan.cityId != null && plan.cityId !== cityId) continue;
    items.push({
      id: plan.id,
      source: "legacy_plan",
      name: plan.name,
      price: String(plan.price),
      description: plan.description,
      features: (plan.features as string[]) ?? [],
      tag: plan.tag,
      isHighlighted: plan.isHighlighted,
      durationMonths: plan.durationMonths,
    });
  }

  const dcmsPlans = await listPlans(true, undefined, false, true);
  for (const plan of dcmsPlans) {
    const scopeLabel = [
      plan.scopeVehicleLabel ?? plan.vehicleCategoryName ?? "All Car Types",
      plan.scopeSeatLabel ?? plan.seatPricingTierLabel ?? plan.seatCategoryName ?? "All Seater Tiers",
    ].join(" · ");
    const features = [
      `${plan.includedCleanings} cleanings`,
      `${plan.includedWashes} washes`,
      `${plan.weeklyOffs} weekly offs`,
      ...(plan.addons?.length ? [`Includes: ${plan.addons.map(a => a.addonName).join(", ")}`] : []),
    ];
    items.push({
      id: plan.id,
      source: "dcms",
      name: plan.name,
      price: String(plan.price),
      description: plan.description,
      features,
      tag: null,
      isHighlighted: false,
      includedCleanings: plan.includedCleanings,
      includedWashes: plan.includedWashes,
      scopeLabel,
    });
  }

  return items;
}
