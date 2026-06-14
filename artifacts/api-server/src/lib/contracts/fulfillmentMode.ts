/**
 * Frozen fulfillment mappings (Founder Rule #2 — do not alter):
 *
 * Doorstep One-Time Wash  → one_time
 * Daily Car Cleaning      → contract_recurring (dcms_subscriptions)
 * Solar AMC               → contract_recurring (subscriptions solar_amc)
 * Doorstep Wash Package   → contract_credits (customer_entitlements)
 *
 * Wallet is never used for fulfillment (Founder Rule #3).
 */

import { db, catalogPackageEntitlementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type FulfillmentMode = "one_time" | "contract_recurring" | "contract_credits";

export type CatalogSelectionKind = "service" | "package" | "plan";

export type ResolveFulfillmentInput = {
  selectionKind: CatalogSelectionKind;
  selectionId: number;
  assetType: "vehicle" | "solar_site";
};

export type ResolvedFulfillment = {
  mode: FulfillmentMode;
  /** Human label for admin UI */
  label: string;
  /** Whether package is solar AMC (contract_recurring) vs wash package (contract_credits) */
  isSolarAmcPackage?: boolean;
};

export async function resolveFulfillmentMode(input: ResolveFulfillmentInput): Promise<ResolvedFulfillment> {
  const { selectionKind, selectionId, assetType } = input;

  if (selectionKind === "service") {
    return {
      mode: "one_time",
      label: assetType === "solar_site" ? "One-time solar job" : "One-time service job",
    };
  }

  if (selectionKind === "plan") {
    return {
      mode: "contract_recurring",
      label: "Daily cleaning plan",
    };
  }

  // package — inspect catalog entitlements to distinguish wash vs solar AMC
  const items = await db.select({
    entitlementType: catalogPackageEntitlementsTable.entitlementType,
  })
    .from(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.packageId, selectionId));

  const hasSolarVisit = items.some(i => i.entitlementType === "solar_visit");

  if (hasSolarVisit || assetType === "solar_site") {
    return {
      mode: "contract_recurring",
      label: "Solar AMC plan",
      isSolarAmcPackage: true,
    };
  }

  return {
    mode: "contract_credits",
    label: "Wash package",
  };
}

export function fulfillmentModeLabel(mode: FulfillmentMode): string {
  switch (mode) {
    case "one_time": return "One-time job";
    case "contract_recurring": return "Plan with schedule";
    case "contract_credits": return "Prepaid package";
    default: return mode;
  }
}
