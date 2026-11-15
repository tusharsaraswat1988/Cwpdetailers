import "./load-env.js";
import {
  db,
  citiesTable,
  branchesTable,
  operationalZonesTable,
  branchZoneMappingsTable,
  geographicLocalitiesTable,
  residentialSocietiesTable,
  locationAliasesTable,
  zoneCoverageRulesTable,
  locationPricingRulesTable,
  pricingRuleAuditTable,
  servicesTable,
} from "@workspace/db";
import { eq, and, sql, or } from "drizzle-orm";
import { locationResolver } from "../../artifacts/api-server/src/lib/location-intelligence/resolver/LocationResolver.js";
import { serviceabilityEngine } from "../../artifacts/api-server/src/lib/location-intelligence/serviceability/ServiceabilityEngine.js";
import { locationPricingEngine } from "../../artifacts/api-server/src/lib/location-intelligence/pricing/LocationPricingEngine.js";

export async function getNoidaCounts() {
  const [noidaCity] = await db
    .select({ id: citiesTable.id, name: citiesTable.name })
    .from(citiesTable)
    .where(or(eq(citiesTable.slug, "noida"), sql`LOWER(${citiesTable.name}) = 'noida'`))
    .limit(1);

  if (!noidaCity) {
    return { error: "Noida city not found" };
  }

  const branches = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.cityId, noidaCity.id));

  const zones = await db
    .select()
    .from(operationalZonesTable)
    .where(eq(operationalZonesTable.cityId, noidaCity.id));

  const localities = await db
    .select()
    .from(geographicLocalitiesTable)
    .where(eq(geographicLocalitiesTable.cityId, noidaCity.id));

  const societies = await db
    .select()
    .from(residentialSocietiesTable)
    .where(eq(residentialSocietiesTable.cityId, noidaCity.id));

  const pricingRules = await db
    .select()
    .from(locationPricingRulesTable)
    .where(eq(locationPricingRulesTable.cityId, noidaCity.id));

  const totalCoverage = await db.select().from(zoneCoverageRulesTable);
  const totalAuditLogs = await db.select().from(pricingRuleAuditTable);

  return {
    cityId: noidaCity.id,
    cityName: noidaCity.name,
    branchesCount: branches.length,
    zonesCount: zones.length,
    localitiesCount: localities.length,
    societiesCount: societies.length,
    pricingRulesCount: pricingRules.length,
    totalCoverageRulesCount: totalCoverage.length,
    totalAuditLogsCount: totalAuditLogs.length,
    branches: branches.map(b => ({ id: b.id, name: b.name, code: b.code })),
    zones: zones.map(z => ({ id: z.id, name: z.name, code: z.code })),
    localities: localities.map(l => ({ id: l.id, name: l.name, code: l.code, pincode: l.pincode })),
    societies: societies.map(s => ({ id: s.id, name: s.name, code: s.code })),
    pricingRules: pricingRules.map(p => ({
      id: p.id,
      locationType: p.locationType,
      societyId: p.societyId,
      zoneId: p.zoneId,
      basePrice: p.basePrice,
      priority: p.priority,
    })),
  };
}

export async function runNoidaVerification() {
  console.log("=== NOIDA PROVISIONING VERIFICATION & PRICING AUDIT ===");

  const counts = await getNoidaCounts();
  console.log("\nCurrent Database Counts:", JSON.stringify(counts, null, 2));

  // Verify Daily Car Cleaning Service
  const [cleaningService] = await db
    .select()
    .from(servicesTable)
    .where(
      or(
        eq(servicesTable.code, "DCC-MONTHLY"),
        sql`LOWER(${servicesTable.name}) LIKE '%daily car cleaning%'`
      )
    )
    .limit(1);

  if (!cleaningService) {
    throw new Error("Daily Car Cleaning service not found in database.");
  }

  const [noidaCity] = await db
    .select()
    .from(citiesTable)
    .where(or(eq(citiesTable.slug, "noida"), sql`LOWER(${citiesTable.name}) = 'noida'`))
    .limit(1);

  const [noidaZone] = await db
    .select()
    .from(operationalZonesTable)
    .where(eq(operationalZonesTable.code, "NOIDA-EXPWY-01"))
    .limit(1);

  if (!noidaZone) {
    throw new Error("NOIDA-EXPWY-01 zone not found.");
  }

  const [jpWishTown] = await db
    .select()
    .from(residentialSocietiesTable)
    .where(
      and(
        eq(residentialSocietiesTable.cityId, noidaCity.id),
        eq(residentialSocietiesTable.code, "JP-WISHTOWN")
      )
    )
    .limit(1);

  if (!jpWishTown) {
    throw new Error("JP-WISHTOWN society not found.");
  }

  // --- TEST 1: PILOT SOCIETY RESOLUTION & TIER 1 PRICING (₹1,200) ---
  console.log("\n[VERIFY 1] Resolving Society (Jaypee Greens Wish Town)...");
  const res1 = await locationResolver.resolve({
    cityId: noidaCity.id,
    societyId: jpWishTown.id,
    propertyType: "GATED_SOCIETY",
    flatNumber: "Tower 5, Flat 1002",
  });
  console.log(`  Resolver output: status=${res1.status}, zoneId=${res1.zoneId}, matchedBy=${res1.matchedBy}`);

  const serv1 = await serviceabilityEngine.evaluate({
    cityId: res1.cityId,
    branchId: res1.branchId,
    zoneId: res1.zoneId,
    societyId: res1.societyId,
    propertyType: res1.propertyType,
    resolvedLocation: res1,
  });
  console.log(`  Serviceability: isServiceable=${serv1.isServiceable}, status=${serv1.status}`);

  const price1 = await locationPricingEngine.resolvePrice({
    serviceId: cleaningService.id,
    cityId: noidaCity.id,
    branchId: res1.branchId,
    zoneId: res1.zoneId,
    societyId: res1.societyId,
    locationType: "GATED_SOCIETY",
  });
  console.log(`  Pricing: total=₹${price1.total}, priorityLevel=${price1.priorityLevel}, priorityName=${price1.priorityName}`);

  if (price1.total !== 1200) {
    throw new Error(`FAIL: Expected ₹1,200 for Tier 1 Society, got ₹${price1.total}`);
  }
  console.log("  ✅ Tier 1 Society Pricing PASS (₹1,200)");

  // --- TEST 2: INDIVIDUAL HOME RESOLUTION & TIER 2 PRICING (₹1,500) ---
  console.log("\n[VERIFY 2] Resolving Individual Home inside Sector 137 / Zone 1...");
  const res2 = await locationResolver.resolve({
    cityId: noidaCity.id,
    propertyType: "INDIVIDUAL_HOME",
    latitude: 28.5135,
    longitude: 77.4030,
    locality: "Sector 137",
    houseNumber: "Villa 12",
  });
  console.log(`  Resolver output: status=${res2.status}, zoneId=${res2.zoneId}, matchedBy=${res2.matchedBy}`);

  const serv2 = await serviceabilityEngine.evaluate({
    cityId: res2.cityId,
    branchId: res2.branchId,
    zoneId: res2.zoneId,
    propertyType: res2.propertyType,
    resolvedLocation: res2,
  });
  console.log(`  Serviceability: isServiceable=${serv2.isServiceable}, status=${serv2.status}`);

  const price2 = await locationPricingEngine.resolvePrice({
    serviceId: cleaningService.id,
    cityId: noidaCity.id,
    branchId: res2.branchId,
    zoneId: res2.zoneId,
    societyId: null,
    locationType: "INDIVIDUAL_HOME",
  });
  console.log(`  Pricing: total=₹${price2.total}, priorityLevel=${price2.priorityLevel}, priorityName=${price2.priorityName}`);

  if (price2.total !== 1500) {
    throw new Error(`FAIL: Expected ₹1,500 for Tier 2 Individual Home, got ₹${price2.total}`);
  }
  console.log("  ✅ Tier 2 Individual Home Pricing PASS (₹1,500)");

  // --- TEST 3: NOIDA FALLBACK / CITY BASELINE PRICING (₹1,350) ---
  console.log("\n[VERIFY 3] Resolving City Default Baseline...");
  const price3 = await locationPricingEngine.resolvePrice({
    serviceId: cleaningService.id,
    cityId: noidaCity.id,
    branchId: null,
    zoneId: null,
    societyId: null,
    locationType: "ALL",
  });
  console.log(`  Pricing: total=₹${price3.total}, priorityLevel=${price3.priorityLevel}, priorityName=${price3.priorityName}`);

  if (price3.total !== 1350) {
    throw new Error(`FAIL: Expected ₹1,350 for Tier 3 City Baseline, got ₹${price3.total}`);
  }
  console.log("  ✅ Tier 3 City Baseline Pricing PASS (₹1,350)");

  // --- TEST 4: OUT-OF-ZONE / UNSERVICEABLE ADDRESS ---
  console.log("\n[VERIFY 4] Testing Out-of-Zone Address Fail-Closed...");
  const res4 = await locationResolver.resolve({
    cityId: noidaCity.id,
    propertyType: "INDIVIDUAL_HOME",
    latitude: 28.9500, // 45km away
    longitude: 77.9500,
    formattedAddress: "Remote Farmland, Outer Peripheral Highway",
  });
  const serv4 = await serviceabilityEngine.evaluate({
    cityId: res4.cityId,
    branchId: res4.branchId,
    zoneId: res4.zoneId,
    propertyType: res4.propertyType,
    resolvedLocation: res4,
  });
  console.log(`  Serviceability: isServiceable=${serv4.isServiceable}, status=${serv4.status}, reason=${serv4.rejectionReason}`);

  if (serv4.isServiceable || serv4.status !== "NOT_SERVICEABLE") {
    throw new Error("FAIL: Out-of-zone location should be NOT_SERVICEABLE");
  }
  console.log("  ✅ Out-of-Zone Fail-Closed PASS");

  // --- TEST 5: LEGACY VARANASI CITY COMPATIBILITY ---
  console.log("\n[VERIFY 5] Testing Varanasi Legacy Compatibility...");
  const [varanasiCity] = await db
    .select()
    .from(citiesTable)
    .where(or(eq(citiesTable.slug, "varanasi"), sql`LOWER(${citiesTable.name}) = 'varanasi'`))
    .limit(1);

  if (varanasiCity) {
    const servVns = await serviceabilityEngine.evaluate({
      cityId: varanasiCity.id,
      propertyType: "INDIVIDUAL_HOME",
    });
    console.log(`  Varanasi Serviceability: isServiceable=${servVns.isServiceable}, status=${servVns.status}`);
    if (!servVns.isServiceable) {
      throw new Error("FAIL: Varanasi legacy city must remain serviceable");
    }
    console.log("  ✅ Varanasi Legacy Compatibility PASS");
  }

  console.log("\n=== ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY (PASS) ===");
}

if (process.argv[1]?.replace(/\\/g, "/").includes("verify-noida-provisioning")) {
  runNoidaVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
