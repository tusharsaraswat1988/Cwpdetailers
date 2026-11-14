import "./load-env.js";
import { db } from "@workspace/db";
import {
  servicesTable,
  citiesTable,
  branchesTable,
  serviceAvailabilityMatrixTable,
  serviceCityAvailabilityTable,
} from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function seedServiceMatrix() {
  console.log("Ensuring homepage_sections schema integrity...");
  // Ensure homepage_sections columns exist
  await db.execute(sql`
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE IF EXISTS homepage_sections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
  `);

  // Ensure default catalog services exist if servicesTable is empty
  let services = await db.select().from(servicesTable);
  if (services.length === 0) {
    console.log("Seeding core services into servicesTable...");
    const coreServices = [
      {
        name: "Doorstep Express Car Wash",
        slug: "doorstep-car-wash",
        code: "CW-EXPRESS",
        category: "car_wash",
        serviceType: "car_wash",
        description: "Complete exterior foam wash, tire dressing, glass cleaning, and doorstep convenience with 100% RO water.",
        shortDescription: "Quick doorstep exterior wash & shine with pure RO water.",
        basePrice: "499.00",
        durationMinutes: 45,
        gstRate: "18.00",
        pricingType: "inclusive" as const,
        bookingModes: ["one_time", "recurring"],
        isActive: true,
        status: "active",
      },
      {
        name: "Daily Car Cleaning (Monthly)",
        slug: "daily-car-cleaning",
        code: "DCC-MONTHLY",
        category: "subscription",
        serviceType: "daily_cleaning",
        description: "Daily morning vehicle dusting & microfiber wash with 2 deep foam washes per month included.",
        shortDescription: "Daily morning vehicle care at your apartment parking.",
        basePrice: "999.00",
        durationMinutes: 30,
        gstRate: "18.00",
        pricingType: "inclusive" as const,
        bookingModes: ["subscription"],
        isActive: true,
        status: "active",
      },
      {
        name: "Deep Interior Detailing & Sanitization",
        slug: "interior-detailing",
        code: "DT-INTERIOR",
        category: "detailing",
        serviceType: "detailing",
        description: "Deep steam shampooing of seats, roof liner, carpets, dashboard conditioning, and AC duct ozone sanitization.",
        shortDescription: "Deep steam sanitization and stain removal for car cabin.",
        basePrice: "1499.00",
        durationMinutes: 120,
        gstRate: "18.00",
        pricingType: "inclusive" as const,
        bookingModes: ["one_time"],
        isActive: true,
        status: "active",
      },
      {
        name: "Ceramic Coating & Paint Correction",
        slug: "ceramic-coating",
        code: "DT-CERAMIC",
        category: "detailing",
        serviceType: "detailing",
        description: "9H German ceramic coating with 3-stage paint correction, swirl removal, and 3-year hydrophobic gloss warranty.",
        shortDescription: "9H German ceramic coating with mirror-gloss shield.",
        basePrice: "4999.00",
        durationMinutes: 240,
        gstRate: "18.00",
        pricingType: "inclusive" as const,
        bookingModes: ["one_time"],
        isActive: true,
        status: "active",
      },
      {
        name: "Solar Panel Soft-Brush Cleaning",
        slug: "solar-cleaning",
        code: "SLR-CLEAN",
        category: "solar_cleaning",
        serviceType: "solar_cleaning",
        description: "Telescopic soft-brush cleaning with deionized RO water, eliminating dust and restoring up to 25% solar efficiency.",
        shortDescription: "Restore power output with deionized RO soft-brush cleaning.",
        basePrice: "799.00",
        durationMinutes: 60,
        gstRate: "18.00",
        pricingType: "inclusive" as const,
        bookingModes: ["one_time", "recurring"],
        isActive: true,
        status: "active",
      },
    ];

    for (const svc of coreServices) {
      await db.insert(servicesTable).values(svc).onConflictDoNothing();
    }
    services = await db.select().from(servicesTable);
    console.log(`Seeded ${services.length} services into servicesTable`);
  }

  console.log("Seeding service availability matrix for Varanasi and Noida...");
  const cities = await db.select().from(citiesTable);
  services = await db.select().from(servicesTable);

  console.log(`Found ${cities.length} cities and ${services.length} services`);

  for (const city of cities) {
    for (const svc of services) {
      const basePriceNum = parseFloat(svc.basePrice?.toString() || "499");

      // City-specific price overrides
      let cityPrice = basePriceNum;
      if (city.slug === "noida") {
        cityPrice = Math.round(basePriceNum * 1.1);
      }

      // Check existing matrix record
      const [existingMatrix] = await db
        .select()
        .from(serviceAvailabilityMatrixTable)
        .where(
          and(
            eq(serviceAvailabilityMatrixTable.serviceId, svc.id),
            eq(serviceAvailabilityMatrixTable.cityId, city.id),
            isNull(serviceAvailabilityMatrixTable.branchId),
          ),
        )
        .limit(1);

      if (existingMatrix) {
        await db
          .update(serviceAvailabilityMatrixTable)
          .set({
            isActive: true,
            basePriceOverride: cityPrice.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(serviceAvailabilityMatrixTable.id, existingMatrix.id));
      } else {
        await db.insert(serviceAvailabilityMatrixTable).values({
          serviceId: svc.id,
          cityId: city.id,
          branchId: null,
          isActive: true,
          bookingModes: ["one_time", "recurring", "subscription"],
          basePriceOverride: cityPrice.toFixed(2),
          effectiveFrom: new Date(Date.now() - 86400000),
        });
      }

      // Check existing legacy city record
      const [existingLegacy] = await db
        .select()
        .from(serviceCityAvailabilityTable)
        .where(
          and(
            eq(serviceCityAvailabilityTable.serviceId, svc.id),
            eq(serviceCityAvailabilityTable.cityId, city.id),
          ),
        )
        .limit(1);

      if (existingLegacy) {
        await db
          .update(serviceCityAvailabilityTable)
          .set({
            isActive: true,
            basePriceOverride: cityPrice.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(serviceCityAvailabilityTable.id, existingLegacy.id));
      } else {
        await db.insert(serviceCityAvailabilityTable).values({
          serviceId: svc.id,
          cityId: city.id,
          isActive: true,
          basePriceOverride: cityPrice.toFixed(2),
        });
      }
    }
  }

  console.log("Service availability matrix seeding completed successfully!");
}

if (process.argv[1]?.endsWith("seed-service-matrix.ts")) {
  seedServiceMatrix()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Failed to seed service matrix:", err);
      process.exit(1);
    });
}
