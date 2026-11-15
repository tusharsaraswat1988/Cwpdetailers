import "./load-env.js";
import { db } from "@workspace/db";
import {
  citiesTable,
  branchesTable,
  operationalZonesTable,
  branchZoneMappingsTable,
  zoneCoverageRulesTable,
  locationPricingRulesTable,
  pricingRuleAuditTable,
  residentialSocietiesTable,
  servicesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { locationResolver } from "../../artifacts/api-server/src/lib/location-intelligence/resolver/LocationResolver.js";
import { serviceabilityEngine } from "../../artifacts/api-server/src/lib/location-intelligence/serviceability/ServiceabilityEngine.js";
import { locationPricingEngine } from "../../artifacts/api-server/src/lib/location-intelligence/pricing/LocationPricingEngine.js";

async function runStagingE2E() {
  console.log("=== STAGING LIVE DATABASE E2E INTEGRATION SUITE ===");

  // 1. Identify or Bootstrap Noida Test City & Branch
  let [noidaCity] = await db.select().from(citiesTable).where(eq(citiesTable.slug, "noida")).limit(1);
  if (!noidaCity) {
    [noidaCity] = await db.insert(citiesTable).values({
      name: "Noida",
      slug: "noida",
      state: "Uttar Pradesh",
      status: "active",
      isActive: true,
    }).returning();
  }

  let [noidaBranch] = await db.select().from(branchesTable).where(eq(branchesTable.cityId, noidaCity.id)).limit(1);
  if (!noidaBranch) {
    [noidaBranch] = await db.insert(branchesTable).values({
      cityId: noidaCity.id,
      name: "Noida Sector 78 Branch",
      code: "NOIDA-SEC78",
      status: "active",
      isActive: true,
    }).returning();
  }

  // Identify or Bootstrap Varanasi City (for legacy compatibility test)
  let [varanasiCity] = await db.select().from(citiesTable).where(eq(citiesTable.slug, "varanasi")).limit(1);
  if (!varanasiCity) {
    [varanasiCity] = await db.insert(citiesTable).values({
      name: "Varanasi",
      slug: "varanasi",
      state: "Uttar Pradesh",
      status: "active",
      isActive: true,
    }).returning();
  }

  // 2. Identify or Bootstrap a Test Service (Daily Car Cleaning)
  let [cleaningService] = await db.select().from(servicesTable).where(eq(servicesTable.code, "DCC-MONTHLY")).limit(1);
  if (!cleaningService) {
    [cleaningService] = await db.insert(servicesTable).values({
      name: "Daily Car Cleaning Monthly",
      code: "DCC-MONTHLY",
      category: "car_cleaning",
      basePrice: "1350.00",
      pricingType: "inclusive",
      gstRate: "18.00",
      isActive: true,
    }).returning();
  }

  // 3. Create or Reset Operational Zone for Staging Test
  const testZoneCode = "NOIDA-EXPWY-STAGE";
  let [testZone] = await db.select().from(operationalZonesTable).where(eq(operationalZonesTable.code, testZoneCode)).limit(1);
  if (!testZone) {
    [testZone] = await db.insert(operationalZonesTable).values({
      cityId: noidaCity.id,
      branchId: noidaBranch.id,
      name: "Noida Expressway Test Zone",
      code: testZoneCode,
      centerLatitude: 28.5355,
      centerLongitude: 77.3910,
      radiusMeters: 8000,
      status: "active",
      isActive: true,
    }).returning();
  }

  // Ensure branch-zone mapping
  await db.insert(branchZoneMappingsTable).values({
    branchId: noidaBranch.id,
    zoneId: testZone.id,
    isPrimary: true,
    isActive: true,
  }).onConflictDoNothing();

  // 4. Create or Reset Residential Society for Staging Test
  let [testSociety] = await db.select().from(residentialSocietiesTable)
    .where(and(eq(residentialSocietiesTable.cityId, noidaCity.id), eq(residentialSocietiesTable.name, "Jaypee Wish Town Stage")))
    .limit(1);

  if (!testSociety) {
    [testSociety] = await db.insert(residentialSocietiesTable).values({
      cityId: noidaCity.id,
      branchId: noidaBranch.id,
      name: "Jaypee Wish Town Stage",
      code: "JWTS-001",
      address: "Sector 128, Noida, Uttar Pradesh",
      latitude: 28.5200,
      longitude: 77.3700,
      isActive: true,
    }).returning();
  }

  // 5. Create Zone Coverage Rule for the society
  let [coverageRule] = await db.select().from(zoneCoverageRulesTable)
    .where(and(eq(zoneCoverageRulesTable.zoneId, testZone.id), eq(zoneCoverageRulesTable.societyId, testSociety.id)))
    .limit(1);

  if (!coverageRule) {
    [coverageRule] = await db.insert(zoneCoverageRulesTable).values({
      zoneId: testZone.id,
      branchId: noidaBranch.id,
      coverageType: "society",
      societyId: testSociety.id,
      propertyType: "ALL",
      status: "serviceable",
      priority: 100,
      isActive: true,
    }).returning();
  }

  // Create Zone Coverage Rule for Individual Homes in this zone
  let [indCoverageRule] = await db.select().from(zoneCoverageRulesTable)
    .where(and(eq(zoneCoverageRulesTable.zoneId, testZone.id), eq(zoneCoverageRulesTable.propertyType, "INDIVIDUAL_HOME")))
    .limit(1);

  if (!indCoverageRule) {
    [indCoverageRule] = await db.insert(zoneCoverageRulesTable).values({
      zoneId: testZone.id,
      branchId: noidaBranch.id,
      coverageType: "property_type",
      propertyType: "INDIVIDUAL_HOME",
      status: "serviceable",
      priority: 50,
      isActive: true,
    }).returning();
  }

  // 6. Setup 5-Tier Pricing Rules
  // Rule A: Explicit Society Override -> Rs 1200
  let [socPricingRule] = await db.select().from(locationPricingRulesTable)
    .where(and(eq(locationPricingRulesTable.serviceId, cleaningService.id), eq(locationPricingRulesTable.societyId, testSociety.id)))
    .limit(1);

  if (!socPricingRule) {
    [socPricingRule] = await db.insert(locationPricingRulesTable).values({
      serviceId: cleaningService.id,
      cityId: noidaCity.id,
      branchId: noidaBranch.id,
      zoneId: testZone.id,
      societyId: testSociety.id,
      locationType: "GATED_SOCIETY",
      basePrice: "1200.00",
      gstRate: "18.00",
      pricingType: "inclusive",
      status: "active",
      priority: 50,
      isActive: true,
    }).returning();
  }

  // Rule B: Zone + Individual Home Override -> Rs 1500
  let [indPricingRule] = await db.select().from(locationPricingRulesTable)
    .where(and(
      eq(locationPricingRulesTable.serviceId, cleaningService.id),
      eq(locationPricingRulesTable.zoneId, testZone.id),
      eq(locationPricingRulesTable.locationType, "INDIVIDUAL_HOME"),
    ))
    .limit(1);

  if (!indPricingRule) {
    [indPricingRule] = await db.insert(locationPricingRulesTable).values({
      serviceId: cleaningService.id,
      cityId: noidaCity.id,
      branchId: noidaBranch.id,
      zoneId: testZone.id,
      locationType: "INDIVIDUAL_HOME",
      basePrice: "1500.00",
      gstRate: "18.00",
      pricingType: "inclusive",
      status: "active",
      priority: 40,
      isActive: true,
    }).returning();
  }

  // Rule C: City Default Price -> Rs 1350
  let [cityPricingRule] = await db.select().from(locationPricingRulesTable)
    .where(and(
      eq(locationPricingRulesTable.serviceId, cleaningService.id),
      eq(locationPricingRulesTable.cityId, noidaCity.id),
      eq(locationPricingRulesTable.locationType, "ALL"),
      sql`${locationPricingRulesTable.zoneId} IS NULL`,
    ))
    .limit(1);

  if (!cityPricingRule) {
    [cityPricingRule] = await db.insert(locationPricingRulesTable).values({
      serviceId: cleaningService.id,
      cityId: noidaCity.id,
      locationType: "ALL",
      basePrice: "1350.00",
      gstRate: "18.00",
      pricingType: "inclusive",
      status: "active",
      priority: 10,
      isActive: true,
    }).returning();
  }

  console.log("Staging test fixtures ready. Commencing workflow assertions...\n");

  // TEST 1: Society Customer Resolution & Tier 1 Pricing
  const res1 = await locationResolver.resolve({
    cityId: noidaCity.id,
    societyId: testSociety.id,
    propertyType: "GATED_SOCIETY",
    flatNumber: "1204",
    tower: "Tower 4",
  });
  console.log("TEST 1: Location Resolution (Society):", res1.status, `Confidence: ${res1.confidence}%`, `Zone: ${res1.zoneName}`);
  if (res1.status !== "EXACT_MATCH" || res1.zoneId !== testZone.id) throw new Error("Test 1 failed: Expected EXACT_MATCH and zone match");

  const serv1 = await serviceabilityEngine.evaluate({
    cityId: res1.cityId,
    branchId: res1.branchId,
    zoneId: res1.zoneId,
    societyId: res1.societyId,
    propertyType: res1.propertyType,
    resolvedLocation: res1,
  });
  console.log("TEST 1: Serviceability (Society):", serv1.status, `isServiceable: ${serv1.isServiceable}`);
  if (!serv1.isServiceable) throw new Error("Test 1 failed: Expected serviceable society");

  const price1 = await locationPricingEngine.resolvePrice({
    serviceId: cleaningService.id,
    cityId: noidaCity.id,
    branchId: res1.branchId,
    zoneId: res1.zoneId,
    societyId: res1.societyId,
    locationType: "GATED_SOCIETY",
  });
  console.log("TEST 1: Pricing (Society Tier 1):", `Total: Rs ${price1.total}`, `Priority: ${price1.priorityName}`);
  if (price1.total !== 1200 || price1.priorityName !== "society_override") throw new Error(`Test 1 failed: Expected Rs 1200 society override, got ${price1.total}`);

  // TEST 2: Individual Home Customer Resolution & Tier 2 Pricing
  const res2 = await locationResolver.resolve({
    cityId: noidaCity.id,
    propertyType: "INDIVIDUAL_HOME",
    latitude: 28.5350,
    longitude: 77.3915, // Inside expressway test zone radius
    locality: "Sector 137",
    houseNumber: "House 45",
  });
  console.log("\nTEST 2: Location Resolution (Individual Home):", res2.status, `Zone: ${res2.zoneName}`);
  if (res2.zoneId !== testZone.id) throw new Error("Test 2 failed: Expected zone match via coordinates");

  const serv2 = await serviceabilityEngine.evaluate({
    cityId: res2.cityId,
    branchId: res2.branchId,
    zoneId: res2.zoneId,
    propertyType: res2.propertyType,
    resolvedLocation: res2,
  });
  console.log("TEST 2: Serviceability (Individual Home):", serv2.status, `isServiceable: ${serv2.isServiceable}`);
  if (!serv2.isServiceable) throw new Error("Test 2 failed: Expected individual home serviceable via zone rule");

  const price2 = await locationPricingEngine.resolvePrice({
    serviceId: cleaningService.id,
    cityId: noidaCity.id,
    branchId: res2.branchId,
    zoneId: res2.zoneId,
    societyId: null,
    locationType: "INDIVIDUAL_HOME",
  });
  console.log("TEST 2: Pricing (Individual Home Tier 2):", `Total: Rs ${price2.total}`, `Priority: ${price2.priorityName}`);
  if (price2.total !== 1500 || price2.priorityName !== "zone_location_type") throw new Error(`Test 2 failed: Expected Rs 1500 zone_location_type, got ${price2.total}`);

  // TEST 3: Unserviceable Address -> Fail Closed
  const res3 = await locationResolver.resolve({
    cityId: noidaCity.id,
    propertyType: "INDIVIDUAL_HOME",
    latitude: 28.9500, // Outside zone radius (~45km away)
    longitude: 77.9500,
    formattedAddress: "Remote Unzoned Farmland, Noida outskirts",
  });
  console.log("\nTEST 3: Location Resolution (Unzoned Location):", res3.status, `Zone: ${res3.zoneId}`);

  const serv3 = await serviceabilityEngine.evaluate({
    cityId: res3.cityId,
    branchId: res3.branchId,
    zoneId: res3.zoneId,
    propertyType: res3.propertyType,
    resolvedLocation: res3,
  });
  console.log("TEST 3: Serviceability (Unzoned Location):", serv3.status, `Reason: ${serv3.rejectionReason}`);
  if (serv3.isServiceable || serv3.status !== "NOT_SERVICEABLE") throw new Error("Test 3 failed: Expected fail-closed NOT_SERVICEABLE");

  // TEST 4: Address Edit Recalculation (Workflow D)
  // Switching property type from Gated Society to Individual Home resets Tier 1 -> Tier 2
  const updatedPrice = await locationPricingEngine.resolvePrice({
    serviceId: cleaningService.id,
    cityId: noidaCity.id,
    branchId: res1.branchId,
    zoneId: res1.zoneId,
    societyId: null, // cleared
    locationType: "INDIVIDUAL_HOME",
  });
  console.log("\nTEST 4: Address Edit Recalculation (Workflow D):", `Price updated from Rs ${price1.total} to Rs ${updatedPrice.total}`);
  if (updatedPrice.total !== 1500) throw new Error("Test 4 failed: Address edit did not transition price to Rs 1500");

  // TEST 5: Legacy Non-Zoned City Backward Compatibility (Varanasi)
  const servVns = await serviceabilityEngine.evaluate({
    cityId: varanasiCity.id,
    propertyType: "INDIVIDUAL_HOME",
  });
  console.log("\nTEST 5: Varanasi Legacy City Compatibility:", servVns.status, `isServiceable: ${servVns.isServiceable}`);
  if (!servVns.isServiceable) throw new Error("Test 5 failed: Varanasi legacy city must remain serviceable without operational zones");

  // TEST 6: Immutable Price Snapshot Integrity
  const snapshot = price1.snapshot;
  console.log("\nTEST 6: Immutable Snapshot Verification:", JSON.stringify(snapshot, null, 2));
  if (!snapshot.ruleId || !snapshot.basePrice || !snapshot.total || !snapshot.resolvedAt) {
    throw new Error("Test 6 failed: Snapshot missing mandatory audit fields");
  }

  console.log("\n=== ALL 6 STAGING E2E LIVE DATABASE WORKFLOWS VERIFIED (PASS) ===");
  process.exit(0);
}

runStagingE2E().catch(err => {
  console.error("Staging E2E Failure:", err);
  process.exit(1);
});
