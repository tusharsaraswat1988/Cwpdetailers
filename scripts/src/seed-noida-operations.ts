import "./load-env.js";
import {
  db,
  citiesTable,
  branchesTable,
  operationalZonesTable,
  branchZoneMappingsTable,
  geographicLocalitiesTable,
  locationAliasesTable,
  residentialSocietiesTable,
  zoneCoverageRulesTable,
  servicesTable,
  locationPricingRulesTable,
  pricingRuleAuditTable,
} from "@workspace/db";
import { eq, and, or, sql, isNull } from "drizzle-orm";

/**
 * CWP NOIDA OPERATIONS PROVISIONING & MASTER DATA SEED
 *
 * Implements canonical, idempotent provisioning for Noida operations:
 * 1. Environment safety guard (protects production Neon from accidental runs)
 * 2. Dynamic Noida city resolution (no hardcoded IDs)
 * 3. Flagship Noida Expressway operational branch
 * 4. Cluster Zone 1 (center 28.5355, 77.3910, 8km radius, polygon GeoJSON)
 * 5. Branch-zone primary mapping
 * 6. 3 Geographic Localities (Sectors 128, 137, 93A) & Location Aliases
 * 7. 4 Pilot Residential Societies (Jaypee Wish Town, ATS Village, Paras Tierea, Purvanchal Royal Park)
 * 8. Zone Coverage Rules (Society, Locality, Property-Type, Zone-wide)
 * 9. Daily Car Cleaning Monthly 3-tier differential pricing (₹1,200 Society, ₹1,500 Individual Home, ₹1,350 Fallback)
 * 10. Pricing Rule Audit Logs
 */

export interface ProvisioningSummary {
  cityId: number;
  cityName: string;
  branchId: number;
  branchCode: string;
  zoneId: number;
  zoneCode: string;
  localitiesCount: number;
  societiesCount: number;
  aliasesCount: number;
  coverageRulesCount: number;
  pricingRulesCount: number;
  auditLogsCount: number;
}

export async function seedNoidaOperations(): Promise<ProvisioningSummary> {
  console.log("===============================================================");
  console.log("   CWP NOIDA OPERATIONS MASTER DATA PROVISIONING WORKFLOW     ");
  console.log("===============================================================");

  // --- STEP 0: ENVIRONMENT & PRODUCTION SAFETY GUARD ---
  const dbUrl = process.env.DATABASE_URL || "";
  const isProductionTarget =
    dbUrl.includes("ep-flat-meadow-aozck6dv") ||
    dbUrl.toLowerCase().includes("prod") ||
    process.env.NODE_ENV === "production";

  const allowProduction =
    process.env.ALLOW_PRODUCTION_SEED === "true" ||
    process.argv.includes("--allow-production");

  let sanitizedUrl = "unknown";
  try {
    const parsed = new URL(dbUrl);
    sanitizedUrl = `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    sanitizedUrl = dbUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  }

  const isStagingTarget = dbUrl.includes("ep-mute-brook-aodd30zp") || dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost");
  const targetLabel = isProductionTarget ? "PRODUCTION (ep-flat-meadow)" : isStagingTarget ? "STAGING (ep-mute-brook)" : "DEVELOPMENT / LOCAL";

  console.log(`Target Database: [${targetLabel}] ${sanitizedUrl}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  if (isProductionTarget && !allowProduction) {
    console.error("\n❌ FATAL SAFETY GUARD TRIPPED:");
    console.error("Target database is identified as PRODUCTION (ep-flat-meadow-aozck6dv).");
    console.error("Execution aborted to protect live production state.");
    console.error("To authorize production seeding, explicitly set ALLOW_PRODUCTION_SEED=true or pass --allow-production.\n");
    throw new Error("ABORTED_BY_PRODUCTION_SAFETY_GUARD");
  }

  // --- STEP 1: DYNAMIC NOIDA CITY RESOLUTION ---
  console.log("\n[1/8] Resolving Noida City dynamically...");
  const matchingCities = await db
    .select({
      id: citiesTable.id,
      name: citiesTable.name,
      slug: citiesTable.slug,
      status: citiesTable.status,
      isActive: citiesTable.isActive,
    })
    .from(citiesTable)
    .where(
      or(
        eq(citiesTable.slug, "noida"),
        sql`LOWER(${citiesTable.name}) = 'noida'`
      )
    );

  if (matchingCities.length === 0) {
    throw new Error("Canonical Noida city record not found in 'cities' table. Run master data seed first.");
  }

  const noidaCity = matchingCities[0];
  console.log(`  ✓ Resolved City: '${noidaCity.name}' (ID: ${noidaCity.id}, slug: '${noidaCity.slug}')`);

  // --- STEP 2: OPERATIONAL BRANCH PROVISIONING ---
  console.log("\n[2/8] Provisioning Noida Expressway Operational Branch...");
  const branchCode = "NOIDA-EXPWY";
  const branchName = "CWP Noida Expressway";

  const [existingBranch] = await db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.cityId, noidaCity.id), eq(branchesTable.code, branchCode)))
    .limit(1);

  let branchId: number;
  if (existingBranch) {
    branchId = existingBranch.id;
    await db
      .update(branchesTable)
      .set({
        name: branchName,
        city: noidaCity.name,
        address: "Unit 4B, Expressway Commercial Hub, Sector 128, Noida, Uttar Pradesh 201304",
        phone: "+91-9871000128",
        managerName: "Regional Operations Manager - Noida Expressway",
        status: "active",
        isActive: true,
        isCompanyOperated: true,
        operationalNotes: "Flagship multi-city operational hub covering Noida Expressway cluster.",
        updatedAt: new Date(),
      })
      .where(eq(branchesTable.id, branchId));
    console.log(`  ✓ Updated existing Branch ID ${branchId} (${branchCode})`);
  } else {
    const [insertedBranch] = await db
      .insert(branchesTable)
      .values({
        name: branchName,
        code: branchCode,
        city: noidaCity.name,
        cityId: noidaCity.id,
        address: "Unit 4B, Expressway Commercial Hub, Sector 128, Noida, Uttar Pradesh 201304",
        phone: "+91-9871000128",
        managerName: "Regional Operations Manager - Noida Expressway",
        status: "active",
        isActive: true,
        isCompanyOperated: true,
        operationalNotes: "Flagship multi-city operational hub covering Noida Expressway cluster.",
      })
      .returning();
    branchId = insertedBranch.id;
    console.log(`  ✓ Created new Branch ID ${branchId} (${branchCode})`);
  }

  // --- STEP 3: OPERATIONAL ZONE & BRANCH MAPPING ---
  console.log("\n[3/8] Provisioning Noida Expressway Cluster Zone 1 & Branch Mapping...");
  const zoneCode = "NOIDA-EXPWY-01";
  const zoneName = "Noida Expressway Cluster Zone 1";
  const centerLat = 28.5355;
  const centerLng = 77.3910;
  const radiusMeters = 8000; // 8.0 km radius

  const boundaryGeoJson = {
    type: "Polygon",
    coordinates: [
      [
        [77.3500, 28.5600],
        [77.4400, 28.5600],
        [77.4400, 28.4900],
        [77.3500, 28.4900],
        [77.3500, 28.5600],
      ],
    ],
  };

  const [existingZone] = await db
    .select()
    .from(operationalZonesTable)
    .where(eq(operationalZonesTable.code, zoneCode))
    .limit(1);

  let zoneId: number;
  if (existingZone) {
    zoneId = existingZone.id;
    await db
      .update(operationalZonesTable)
      .set({
        cityId: noidaCity.id,
        branchId: branchId,
        name: zoneName,
        description: "Primary cluster zone covering Noida Expressway corridor: Sectors 128, 137, 93A and adjacent societies.",
        centerLatitude: centerLat,
        centerLongitude: centerLng,
        radiusMeters: radiusMeters,
        boundaryGeoJson: boundaryGeoJson,
        status: "active",
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(operationalZonesTable.id, zoneId));
    console.log(`  ✓ Updated existing Zone ID ${zoneId} (${zoneCode})`);
  } else {
    const [insertedZone] = await db
      .insert(operationalZonesTable)
      .values({
        cityId: noidaCity.id,
        branchId: branchId,
        name: zoneName,
        code: zoneCode,
        description: "Primary cluster zone covering Noida Expressway corridor: Sectors 128, 137, 93A and adjacent societies.",
        centerLatitude: centerLat,
        centerLongitude: centerLng,
        radiusMeters: radiusMeters,
        boundaryGeoJson: boundaryGeoJson,
        status: "active",
        isActive: true,
      })
      .returning();
    zoneId = insertedZone.id;
    console.log(`  ✓ Created new Zone ID ${zoneId} (${zoneCode})`);
  }

  // Branch-Zone Mapping
  const [existingMapping] = await db
    .select()
    .from(branchZoneMappingsTable)
    .where(
      and(
        eq(branchZoneMappingsTable.branchId, branchId),
        eq(branchZoneMappingsTable.zoneId, zoneId)
      )
    )
    .limit(1);

  if (existingMapping) {
    await db
      .update(branchZoneMappingsTable)
      .set({ isPrimary: true, isActive: true, updatedAt: new Date() })
      .where(eq(branchZoneMappingsTable.id, existingMapping.id));
    console.log(`  ✓ Confirmed Branch-Zone Mapping ID ${existingMapping.id}`);
  } else {
    const [insertedMapping] = await db
      .insert(branchZoneMappingsTable)
      .values({
        branchId: branchId,
        zoneId: zoneId,
        isPrimary: true,
        isActive: true,
      })
      .returning();
    console.log(`  ✓ Created Branch-Zone Mapping ID ${insertedMapping.id}`);
  }

  // --- STEP 4: GEOGRAPHIC LOCALITIES (3 SECTORS) ---
  console.log("\n[4/8] Provisioning Geographic Localities & Aliases...");
  const localityDefinitions = [
    {
      name: "Sector 128",
      slug: "noida-sector-128",
      code: "SEC-128",
      pincode: "201304",
      latitude: 28.5355,
      longitude: 77.3910,
      aliases: ["sector 128", "sec 128", "sec-128", "sector 128 noida"],
      boundaryGeoJson: {
        type: "Polygon",
        coordinates: [
          [
            [77.3800, 28.5450],
            [77.4050, 28.5450],
            [77.4050, 28.5250],
            [77.3800, 28.5250],
            [77.3800, 28.5450],
          ],
        ],
      },
    },
    {
      name: "Sector 137",
      slug: "noida-sector-137",
      code: "SEC-137",
      pincode: "201305",
      latitude: 28.5135,
      longitude: 77.4030,
      aliases: ["sector 137", "sec 137", "sec-137", "sector 137 noida"],
      boundaryGeoJson: {
        type: "Polygon",
        coordinates: [
          [
            [77.3950, 28.5220],
            [77.4150, 28.5220],
            [77.4150, 28.5050],
            [77.3950, 28.5050],
            [77.3950, 28.5220],
          ],
        ],
      },
    },
    {
      name: "Sector 93A",
      slug: "noida-sector-93a",
      code: "SEC-93A",
      pincode: "201304",
      latitude: 28.5200,
      longitude: 77.3800,
      aliases: ["sector 93a", "sec 93a", "sec-93a", "sector 93 a noida"],
      boundaryGeoJson: {
        type: "Polygon",
        coordinates: [
          [
            [77.3700, 28.5280],
            [77.3900, 28.5280],
            [77.3900, 28.5120],
            [77.3700, 28.5120],
            [77.3700, 28.5280],
          ],
        ],
      },
    },
  ];

  const localityMap = new Map<string, number>();
  let aliasCount = 0;

  for (const def of localityDefinitions) {
    const [existing] = await db
      .select()
      .from(geographicLocalitiesTable)
      .where(
        and(
          eq(geographicLocalitiesTable.cityId, noidaCity.id),
          or(
            eq(geographicLocalitiesTable.slug, def.slug),
            eq(geographicLocalitiesTable.code, def.code)
          )
        )
      )
      .limit(1);

    let locId: number;
    if (existing) {
      locId = existing.id;
      await db
        .update(geographicLocalitiesTable)
        .set({
          name: def.name,
          slug: def.slug,
          code: def.code,
          pincode: def.pincode,
          latitude: def.latitude,
          longitude: def.longitude,
          boundaryGeoJson: def.boundaryGeoJson,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(geographicLocalitiesTable.id, locId));
      console.log(`  ✓ Updated Locality '${def.name}' (ID: ${locId})`);
    } else {
      const [inserted] = await db
        .insert(geographicLocalitiesTable)
        .values({
          cityId: noidaCity.id,
          name: def.name,
          slug: def.slug,
          code: def.code,
          pincode: def.pincode,
          latitude: def.latitude,
          longitude: def.longitude,
          boundaryGeoJson: def.boundaryGeoJson,
          isActive: true,
        })
        .returning();
      locId = inserted.id;
      console.log(`  ✓ Created Locality '${def.name}' (ID: ${locId})`);
    }
    localityMap.set(def.code, locId);

    // Aliases
    for (const alias of def.aliases) {
      const norm = alias.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
      const [existingAlias] = await db
        .select()
        .from(locationAliasesTable)
        .where(
          and(
            eq(locationAliasesTable.entityType, "locality"),
            eq(locationAliasesTable.entityId, locId),
            eq(locationAliasesTable.normalizedAlias, norm)
          )
        )
        .limit(1);

      if (!existingAlias) {
        await db.insert(locationAliasesTable).values({
          entityType: "locality",
          entityId: locId,
          alias: alias,
          normalizedAlias: norm,
          locale: "en",
          isActive: true,
        });
        aliasCount++;
      }
    }
  }

  // --- STEP 5: PILOT RESIDENTIAL SOCIETIES (4 SOCIETIES) ---
  console.log("\n[5/8] Provisioning Pilot Residential Societies & Aliases...");
  const societyDefinitions = [
    {
      name: "Jaypee Greens Wish Town",
      code: "JP-WISHTOWN",
      localityCode: "SEC-128",
      address: "Jaypee Greens Wish Town, Sector 128, Noida, Uttar Pradesh 201304",
      pincode: "201304",
      latitude: 28.5355,
      longitude: 77.3910,
      totalTowers: 12,
      totalFlats: 1200,
      gateSecurityNotes: "Main gate verification required for staff. Advance entry pass via MyGate.",
      aliases: ["jaypee wish town", "wish town", "jaypee greens", "jaypee wishtown"],
    },
    {
      name: "ATS Village",
      code: "ATS-VILLAGE",
      localityCode: "SEC-93A",
      address: "ATS Village, Sector 93A, Noida, Uttar Pradesh 201304",
      pincode: "201304",
      latitude: 28.5200,
      longitude: 77.3800,
      totalTowers: 25,
      totalFlats: 1000,
      gateSecurityNotes: "Visitor gate pass through ApnaComplex.",
      aliases: ["ats village", "ats sector 93a", "ats village noida"],
    },
    {
      name: "Paras Tierea",
      code: "PARAS-TIEREA",
      localityCode: "SEC-137",
      address: "Paras Tierea, Sector 137, Noida, Uttar Pradesh 201305",
      pincode: "201305",
      latitude: 28.5130,
      longitude: 77.4020,
      totalTowers: 30,
      totalFlats: 3500,
      gateSecurityNotes: "Staff biometric/tag ID required at Gate 2.",
      aliases: ["paras tierea", "paras sector 137", "paras tierea noida"],
    },
    {
      name: "Purvanchal Royal Park",
      code: "PURV-ROYAL",
      localityCode: "SEC-137",
      address: "Purvanchal Royal Park, Sector 137, Noida, Uttar Pradesh 201305",
      pincode: "201305",
      latitude: 28.5150,
      longitude: 77.4050,
      totalTowers: 16,
      totalFlats: 1100,
      gateSecurityNotes: "Entry via Gate 1 with Society Pass.",
      aliases: ["purvanchal royal park", "purvanchal sector 137", "royal park noida"],
    },
  ];

  const societyMap = new Map<string, number>();

  for (const def of societyDefinitions) {
    const [existing] = await db
      .select()
      .from(residentialSocietiesTable)
      .where(
        and(
          eq(residentialSocietiesTable.cityId, noidaCity.id),
          or(
            eq(residentialSocietiesTable.code, def.code),
            eq(residentialSocietiesTable.name, def.name)
          )
        )
      )
      .limit(1);

    let socId: number;
    if (existing) {
      socId = existing.id;
      await db
        .update(residentialSocietiesTable)
        .set({
          name: def.name,
          code: def.code,
          branchId: branchId,
          address: def.address,
          pincode: def.pincode,
          latitude: def.latitude,
          longitude: def.longitude,
          totalTowers: def.totalTowers,
          totalFlats: def.totalFlats,
          gateSecurityNotes: def.gateSecurityNotes,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(residentialSocietiesTable.id, socId));
      console.log(`  ✓ Updated Society '${def.name}' (ID: ${socId})`);
    } else {
      const [inserted] = await db
        .insert(residentialSocietiesTable)
        .values({
          cityId: noidaCity.id,
          branchId: branchId,
          name: def.name,
          code: def.code,
          address: def.address,
          pincode: def.pincode,
          latitude: def.latitude,
          longitude: def.longitude,
          totalTowers: def.totalTowers,
          totalFlats: def.totalFlats,
          gateSecurityNotes: def.gateSecurityNotes,
          isActive: true,
        })
        .returning();
      socId = inserted.id;
      console.log(`  ✓ Created Society '${def.name}' (ID: ${socId})`);
    }
    societyMap.set(def.code, socId);

    // Aliases
    for (const alias of def.aliases) {
      const norm = alias.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
      const [existingAlias] = await db
        .select()
        .from(locationAliasesTable)
        .where(
          and(
            eq(locationAliasesTable.entityType, "society"),
            eq(locationAliasesTable.entityId, socId),
            eq(locationAliasesTable.normalizedAlias, norm)
          )
        )
        .limit(1);

      if (!existingAlias) {
        await db.insert(locationAliasesTable).values({
          entityType: "society",
          entityId: socId,
          alias: alias,
          normalizedAlias: norm,
          locale: "en",
          isActive: true,
        });
        aliasCount++;
      }
    }
  }

  // --- STEP 6: ZONE COVERAGE RULES ---
  console.log("\n[6/8] Provisioning Zone Coverage Rules (Society, Locality, Property-Type)...");
  let coverageRulesCount = 0;

  // A. Society-level coverage rules (Priority 100)
  for (const [code, sId] of societyMap.entries()) {
    const [existing] = await db
      .select()
      .from(zoneCoverageRulesTable)
      .where(
        and(
          eq(zoneCoverageRulesTable.zoneId, zoneId),
          eq(zoneCoverageRulesTable.coverageType, "society"),
          eq(zoneCoverageRulesTable.societyId, sId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(zoneCoverageRulesTable)
        .set({
          branchId: branchId,
          propertyType: "GATED_SOCIETY",
          status: "serviceable",
          priority: 100,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(zoneCoverageRulesTable.id, existing.id));
    } else {
      await db.insert(zoneCoverageRulesTable).values({
        zoneId: zoneId,
        branchId: branchId,
        coverageType: "society",
        societyId: sId,
        propertyType: "GATED_SOCIETY",
        status: "serviceable",
        priority: 100,
        isActive: true,
      });
      coverageRulesCount++;
    }
    console.log(`  ✓ Society Coverage Rule for '${code}' (Priority 100)`);
  }

  // B. Locality-level coverage rules (Priority 50)
  for (const [code, lId] of localityMap.entries()) {
    const [existing] = await db
      .select()
      .from(zoneCoverageRulesTable)
      .where(
        and(
          eq(zoneCoverageRulesTable.zoneId, zoneId),
          eq(zoneCoverageRulesTable.coverageType, "locality"),
          eq(zoneCoverageRulesTable.localityId, lId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(zoneCoverageRulesTable)
        .set({
          branchId: branchId,
          propertyType: "ALL",
          status: "serviceable",
          priority: 50,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(zoneCoverageRulesTable.id, existing.id));
    } else {
      await db.insert(zoneCoverageRulesTable).values({
        zoneId: zoneId,
        branchId: branchId,
        coverageType: "locality",
        localityId: lId,
        propertyType: "ALL",
        status: "serviceable",
        priority: 50,
        isActive: true,
      });
      coverageRulesCount++;
    }
    console.log(`  ✓ Locality Coverage Rule for '${code}' (Priority 50)`);
  }

  // C. Zone-wide Individual Home coverage rule (Priority 40)
  const [existingIndRule] = await db
    .select()
    .from(zoneCoverageRulesTable)
    .where(
      and(
        eq(zoneCoverageRulesTable.zoneId, zoneId),
        eq(zoneCoverageRulesTable.coverageType, "property_type"),
        eq(zoneCoverageRulesTable.propertyType, "INDIVIDUAL_HOME")
      )
    )
    .limit(1);

  if (existingIndRule) {
    await db
      .update(zoneCoverageRulesTable)
      .set({
        branchId: branchId,
        status: "serviceable",
        priority: 40,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(zoneCoverageRulesTable.id, existingIndRule.id));
  } else {
    await db.insert(zoneCoverageRulesTable).values({
      zoneId: zoneId,
      branchId: branchId,
      coverageType: "property_type",
      propertyType: "INDIVIDUAL_HOME",
      status: "serviceable",
      priority: 40,
      isActive: true,
    });
    coverageRulesCount++;
  }
  console.log("  ✓ Zone-wide Individual Home Rule (Priority 40)");

  // D. Zone-wide baseline coverage rule (Priority 10)
  const [existingAllRule] = await db
    .select()
    .from(zoneCoverageRulesTable)
    .where(
      and(
        eq(zoneCoverageRulesTable.zoneId, zoneId),
        eq(zoneCoverageRulesTable.coverageType, "all"),
        eq(zoneCoverageRulesTable.propertyType, "ALL")
      )
    )
    .limit(1);

  if (existingAllRule) {
    await db
      .update(zoneCoverageRulesTable)
      .set({
        branchId: branchId,
        status: "serviceable",
        priority: 10,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(zoneCoverageRulesTable.id, existingAllRule.id));
  } else {
    await db.insert(zoneCoverageRulesTable).values({
      zoneId: zoneId,
      branchId: branchId,
      coverageType: "all",
      propertyType: "ALL",
      status: "serviceable",
      priority: 10,
      isActive: true,
    });
    coverageRulesCount++;
  }
  console.log("  ✓ Zone-wide All Coverage Rule (Priority 10)");

  // --- STEP 7: SERVICE RESOLUTION & LOCATION-BASED DIFFERENTIAL PRICING ---
  console.log("\n[7/8] Resolving Daily Car Cleaning Service & Differential Pricing Tiers...");

  let [cleaningService] = await db
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
    console.log("  Bootstrapping canonical Daily Car Cleaning (Monthly) service...");
    [cleaningService] = await db
      .insert(servicesTable)
      .values({
        name: "Daily Car Cleaning (Monthly)",
        code: "DCC-MONTHLY",
        category: "car_cleaning",
        basePrice: "1350.00",
        pricingType: "inclusive",
        gstRate: "18.00",
        isActive: true,
      })
      .returning();
  }
  console.log(`  ✓ Service Resolved: '${cleaningService.name}' (ID: ${cleaningService.id})`);

  let pricingRulesCount = 0;
  let auditLogsCount = 0;

  // Helper for upserting pricing rule + audit log
  async function upsertPricingRule(params: {
    societyId?: number | null;
    zoneId?: number | null;
    branchId?: number | null;
    locationType: string;
    basePrice: string;
    priority: number;
    notes: string;
  }) {
    // Lookup predicate
    const conditions = [
      eq(locationPricingRulesTable.serviceId, cleaningService.id),
      eq(locationPricingRulesTable.cityId, noidaCity.id),
      eq(locationPricingRulesTable.locationType, params.locationType),
    ];

    if (params.societyId != null) {
      conditions.push(eq(locationPricingRulesTable.societyId, params.societyId));
    } else {
      conditions.push(isNull(locationPricingRulesTable.societyId));
    }

    if (params.zoneId != null) {
      conditions.push(eq(locationPricingRulesTable.zoneId, params.zoneId));
    } else {
      conditions.push(isNull(locationPricingRulesTable.zoneId));
    }

    const [existing] = await db
      .select()
      .from(locationPricingRulesTable)
      .where(and(...conditions))
      .limit(1);

    let ruleId: number;
    let isUpdate = false;
    let previousValues: Record<string, unknown> | null = null;

    if (existing) {
      ruleId = existing.id;
      isUpdate = true;
      previousValues = {
        basePrice: existing.basePrice,
        gstRate: existing.gstRate,
        priority: existing.priority,
        status: existing.status,
      };

      await db
        .update(locationPricingRulesTable)
        .set({
          branchId: params.branchId ?? existing.branchId,
          basePrice: params.basePrice,
          gstRate: "18.00",
          pricingType: "inclusive",
          priority: params.priority,
          status: "active",
          notes: params.notes,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(locationPricingRulesTable.id, ruleId));
    } else {
      const [inserted] = await db
        .insert(locationPricingRulesTable)
        .values({
          serviceId: cleaningService.id,
          cityId: noidaCity.id,
          branchId: params.branchId ?? null,
          zoneId: params.zoneId ?? null,
          societyId: params.societyId ?? null,
          locationType: params.locationType,
          basePrice: params.basePrice,
          gstRate: "18.00",
          pricingType: "inclusive",
          status: "active",
          priority: params.priority,
          notes: params.notes,
          isActive: true,
        })
        .returning();
      ruleId = inserted.id;
      pricingRulesCount++;
    }

    // Write audit log
    await db.insert(pricingRuleAuditTable).values({
      ruleId: ruleId,
      action: isUpdate ? "price_changed" : "created",
      previousValues: previousValues,
      newValues: {
        serviceId: cleaningService.id,
        cityId: noidaCity.id,
        branchId: params.branchId ?? null,
        zoneId: params.zoneId ?? null,
        societyId: params.societyId ?? null,
        locationType: params.locationType,
        basePrice: params.basePrice,
        gstRate: "18.00",
        pricingType: "inclusive",
        priority: params.priority,
      },
    });
    auditLogsCount++;

    return ruleId;
  }

  // Tier 1: Society Specific Overrides -> ₹1,200 (Priority 50)
  for (const [code, sId] of societyMap.entries()) {
    const rId = await upsertPricingRule({
      societyId: sId,
      zoneId: zoneId,
      branchId: branchId,
      locationType: "GATED_SOCIETY",
      basePrice: "1200.00",
      priority: 50,
      notes: `Pilot Society ${code} subscription pricing override (Tier 1: ₹1,200)`,
    });
    console.log(`  ✓ Tier 1 Society Rule: '${code}' -> ₹1,200 (Rule ID: ${rId})`);
  }

  // Tier 1b: Zone-wide Gated Society Fallback -> ₹1,200 (Priority 45)
  const rIdZoneGated = await upsertPricingRule({
    societyId: null,
    zoneId: zoneId,
    branchId: branchId,
    locationType: "GATED_SOCIETY",
    basePrice: "1200.00",
    priority: 45,
    notes: "Noida Expressway Zone 1 Gated Society standard subscription pricing (Tier 1: ₹1,200)",
  });
  console.log(`  ✓ Tier 1 Zone Gated Society Fallback -> ₹1,200 (Rule ID: ${rIdZoneGated})`);

  // Tier 2: Zone + Individual Home Override -> ₹1,500 (Priority 40)
  const rIdIndHome = await upsertPricingRule({
    societyId: null,
    zoneId: zoneId,
    branchId: branchId,
    locationType: "INDIVIDUAL_HOME",
    basePrice: "1500.00",
    priority: 40,
    notes: "Noida Expressway Zone 1 Individual Residential Home pricing (Tier 2: ₹1,500)",
  });
  console.log(`  ✓ Tier 2 Zone Individual Home -> ₹1,500 (Rule ID: ${rIdIndHome})`);

  // Tier 3: Noida City Default Baseline -> ₹1,350 (Priority 10)
  const rIdCityDefault = await upsertPricingRule({
    societyId: null,
    zoneId: null,
    branchId: null,
    locationType: "ALL",
    basePrice: "1350.00",
    priority: 10,
    notes: "Noida City-wide catalog fallback baseline pricing (Tier 3: ₹1,350)",
  });
  console.log(`  ✓ Tier 3 Noida City Baseline -> ₹1,350 (Rule ID: ${rIdCityDefault})`);

  // --- STEP 8: FINAL SUMMARY ---
  console.log("\n[8/8] Provisioning Complete & Validated.");
  console.log("===============================================================");
  console.log(`  Noida City ID:            ${noidaCity.id}`);
  console.log(`  Operational Branch:       ${branchName} (${branchCode}, ID: ${branchId})`);
  console.log(`  Operational Zone:         ${zoneName} (${zoneCode}, ID: ${zoneId})`);
  console.log(`  Geographic Localities:    ${localityMap.size} provisioned`);
  console.log(`  Residential Societies:    ${societyMap.size} provisioned`);
  console.log(`  Location Aliases:         ${aliasCount} new aliases indexed`);
  console.log(`  Zone Coverage Rules:      ${coverageRulesCount} new rules`);
  console.log(`  Location Pricing Rules:   ${pricingRulesCount} new rules (₹1,200 / ₹1,500 / ₹1,350)`);
  console.log(`  Audit Logs Written:       ${auditLogsCount} events`);
  console.log("===============================================================\n");

  return {
    cityId: noidaCity.id,
    cityName: noidaCity.name,
    branchId: branchId,
    branchCode: branchCode,
    zoneId: zoneId,
    zoneCode: zoneCode,
    localitiesCount: localityMap.size,
    societiesCount: societyMap.size,
    aliasesCount: aliasCount,
    coverageRulesCount: coverageRulesCount,
    pricingRulesCount: pricingRulesCount,
    auditLogsCount: auditLogsCount,
  };
}

// CLI runner
if (process.argv[1]?.replace(/\\/g, "/").includes("seed-noida-operations")) {
  seedNoidaOperations()
    .then(() => {
      console.log("✅ Noida operations provisioning completed successfully (Exit Code 0).");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Noida operations provisioning failed:", err);
      process.exit(1);
    });
}
