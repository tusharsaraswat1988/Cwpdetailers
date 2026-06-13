import { db } from "@workspace/db";
import {
  vehicleCategoriesTable, seatCategoriesTable, fuelTypesTable,
  vehicleBrandsTable, vehicleModelsTable,
  statesTable, citiesTable, serviceAreasTable, pincodesTable,
  serviceCategoriesTable, servicePlansTable, servicePricingTable,
  servicesTable, vehiclesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function upsertBySlug<T extends { slug: string; id: number }>(
  table: typeof vehicleCategoriesTable,
  items: Array<Record<string, unknown> & { slug: string }>,
): Promise<T[]> {
  const results: T[] = [];
  for (const item of items) {
    const existing = await db.select().from(table).where(eq(table.slug, item.slug)).limit(1);
    if (existing[0]) {
      const updated = await db.update(table).set({ ...item, updatedAt: new Date() }).where(eq(table.id, existing[0].id)).returning();
      if (updated[0]) results.push(updated[0] as T);
    } else {
      const created = await db.insert(table).values(item).returning();
      if (created[0]) results.push(created[0] as T);
    }
  }
  return results;
}

export async function seedMasterData() {
  console.log("Seeding master data...");

  const categories = await upsertBySlug(vehicleCategoriesTable, [
    { name: "Hatchback", slug: "hatchback", description: "Compact city cars", sortOrder: 1 },
    { name: "Sedan", slug: "sedan", description: "Mid-size sedans", sortOrder: 2 },
    { name: "SUV", slug: "suv", description: "Sport utility vehicles", sortOrder: 3 },
    { name: "MUV", slug: "muv", description: "Multi utility vehicles", sortOrder: 4 },
    { name: "Luxury", slug: "luxury", description: "Premium luxury cars", sortOrder: 5 },
    { name: "Van", slug: "van", description: "Vans and MPVs", sortOrder: 6 },
    { name: "Pickup", slug: "pickup", description: "Pickup trucks", sortOrder: 7 },
  ]);
  const catMap = Object.fromEntries(categories.map(c => [c.slug, c.id]));

  const seats = await upsertBySlug(seatCategoriesTable, [
    { name: "5 Seater", slug: "5-seater", seatCount: 5, sortOrder: 1 },
    { name: "6 Seater", slug: "6-seater", seatCount: 6, sortOrder: 2 },
    { name: "7 Seater", slug: "7-seater", seatCount: 7, sortOrder: 3 },
    { name: "8+ Seater", slug: "8-seater", seatCount: 8, sortOrder: 4 },
  ]);
  const seatMap = Object.fromEntries(seats.map(s => [s.slug, s.id]));

  const fuels = await upsertBySlug(fuelTypesTable, [
    { name: "Petrol", slug: "petrol", sortOrder: 1 },
    { name: "Diesel", slug: "diesel", sortOrder: 2 },
    { name: "CNG", slug: "cng", sortOrder: 3 },
    { name: "Electric", slug: "electric", sortOrder: 4 },
    { name: "Hybrid", slug: "hybrid", sortOrder: 5 },
  ]);
  const fuelMap = Object.fromEntries(fuels.map(f => [f.slug, f.id]));

  const brandDefs = [
    "Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Toyota", "Honda",
    "Kia", "MG", "Volkswagen", "Skoda", "Renault", "Nissan", "Jeep",
    "BMW", "Mercedes-Benz", "Audi", "Volvo", "Citroen", "Force",
  ];
  const brands: Record<string, number> = {};
  for (let i = 0; i < brandDefs.length; i++) {
    const name = brandDefs[i];
    const s = slug(name);
    const existing = await db.select().from(vehicleBrandsTable).where(eq(vehicleBrandsTable.slug, s)).limit(1);
    if (existing[0]) {
      brands[name] = existing[0].id;
    } else {
      const [b] = await db.insert(vehicleBrandsTable).values({ name, slug: s, sortOrder: i + 1 }).returning();
      brands[name] = b.id;
    }
  }

  type ModelDef = { brand: string; name: string; cat: string; seat: string; fuel?: string };
  const modelDefs: ModelDef[] = [
    // Maruti Suzuki
    { brand: "Maruti Suzuki", name: "Alto", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "S-Presso", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "WagonR", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Swift", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Baleno", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Dzire", cat: "sedan", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Ciaz", cat: "sedan", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Brezza", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Fronx", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Grand Vitara", cat: "suv", seat: "5-seater", fuel: "hybrid" },
    { brand: "Maruti Suzuki", name: "Jimny", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Ertiga", cat: "muv", seat: "7-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "XL6", cat: "muv", seat: "7-seater", fuel: "petrol" },
    { brand: "Maruti Suzuki", name: "Invicto", cat: "muv", seat: "7-seater", fuel: "hybrid" },
    // Hyundai
    { brand: "Hyundai", name: "i10 Nios", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Hyundai", name: "i20", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Hyundai", name: "Aura", cat: "sedan", seat: "5-seater", fuel: "petrol" },
    { brand: "Hyundai", name: "Verna", cat: "sedan", seat: "5-seater", fuel: "petrol" },
    { brand: "Hyundai", name: "Venue", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Hyundai", name: "Creta", cat: "suv", seat: "5-seater", fuel: "diesel" },
    { brand: "Hyundai", name: "Alcazar", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Hyundai", name: "Tucson", cat: "suv", seat: "5-seater", fuel: "diesel" },
    { brand: "Hyundai", name: "Exter", cat: "suv", seat: "5-seater", fuel: "petrol" },
    // Tata
    { brand: "Tata", name: "Tiago", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Tata", name: "Altroz", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Tata", name: "Tigor", cat: "sedan", seat: "5-seater", fuel: "petrol" },
    { brand: "Tata", name: "Nexon", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Tata", name: "Punch", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Tata", name: "Harrier", cat: "suv", seat: "5-seater", fuel: "diesel" },
    { brand: "Tata", name: "Safari", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Tata", name: "Curvv", cat: "suv", seat: "5-seater", fuel: "petrol" },
    // Mahindra
    { brand: "Mahindra", name: "Bolero", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Mahindra", name: "Bolero Neo", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Mahindra", name: "Scorpio Classic", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Mahindra", name: "Scorpio-N", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Mahindra", name: "XUV300", cat: "suv", seat: "5-seater", fuel: "diesel" },
    { brand: "Mahindra", name: "XUV3XO", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Mahindra", name: "XUV700", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Mahindra", name: "Thar", cat: "suv", seat: "4-seater" as string, fuel: "diesel" },
    { brand: "Mahindra", name: "Marazzo", cat: "muv", seat: "8-seater", fuel: "diesel" },
    // Toyota
    { brand: "Toyota", name: "Glanza", cat: "hatchback", seat: "5-seater", fuel: "petrol" },
    { brand: "Toyota", name: "Urban Cruiser Hyryder", cat: "suv", seat: "5-seater", fuel: "hybrid" },
    { brand: "Toyota", name: "Innova Crysta", cat: "muv", seat: "7-seater", fuel: "diesel" },
    { brand: "Toyota", name: "Innova Hycross", cat: "muv", seat: "7-seater", fuel: "hybrid" },
    { brand: "Toyota", name: "Fortuner", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "Toyota", name: "Camry", cat: "sedan", seat: "5-seater", fuel: "hybrid" },
    { brand: "Toyota", name: "Vellfire", cat: "muv", seat: "7-seater", fuel: "hybrid" },
    // Honda
    { brand: "Honda", name: "Amaze", cat: "sedan", seat: "5-seater", fuel: "petrol" },
    { brand: "Honda", name: "City", cat: "sedan", seat: "5-seater", fuel: "petrol" },
    { brand: "Honda", name: "Elevate", cat: "suv", seat: "5-seater", fuel: "petrol" },
    // Kia
    { brand: "Kia", name: "Sonet", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "Kia", name: "Seltos", cat: "suv", seat: "5-seater", fuel: "diesel" },
    { brand: "Kia", name: "Carens", cat: "muv", seat: "7-seater", fuel: "diesel" },
    { brand: "Kia", name: "EV6", cat: "suv", seat: "5-seater", fuel: "electric" },
    // MG
    { brand: "MG", name: "Hector", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "MG", name: "Astor", cat: "suv", seat: "5-seater", fuel: "petrol" },
    { brand: "MG", name: "Gloster", cat: "suv", seat: "7-seater", fuel: "diesel" },
    { brand: "MG", name: "Comet EV", cat: "hatchback", seat: "5-seater", fuel: "electric" },
    // Luxury
    { brand: "BMW", name: "3 Series", cat: "luxury", seat: "5-seater", fuel: "petrol" },
    { brand: "BMW", name: "5 Series", cat: "luxury", seat: "5-seater", fuel: "petrol" },
    { brand: "BMW", name: "X1", cat: "luxury", seat: "5-seater", fuel: "petrol" },
    { brand: "BMW", name: "X5", cat: "luxury", seat: "5-seater", fuel: "diesel" },
    { brand: "Mercedes-Benz", name: "C-Class", cat: "luxury", seat: "5-seater", fuel: "petrol" },
    { brand: "Mercedes-Benz", name: "E-Class", cat: "luxury", seat: "5-seater", fuel: "petrol" },
    { brand: "Mercedes-Benz", name: "GLC", cat: "luxury", seat: "5-seater", fuel: "diesel" },
    { brand: "Audi", name: "A4", cat: "luxury", seat: "5-seater", fuel: "petrol" },
    { brand: "Audi", name: "Q5", cat: "luxury", seat: "5-seater", fuel: "diesel" },
    { brand: "Jeep", name: "Compass", cat: "suv", seat: "5-seater", fuel: "diesel" },
    { brand: "Jeep", name: "Meridian", cat: "suv", seat: "7-seater", fuel: "diesel" },
  ];

  for (const m of modelDefs) {
    const brandId = brands[m.brand];
    if (!brandId) continue;
    const modelSlug = slug(`${m.brand}-${m.name}`);
    const seatKey = m.seat === "4-seater" ? "5-seater" : m.seat;
    const existing = await db.select().from(vehicleModelsTable)
      .where(sql`${vehicleModelsTable.brandId} = ${brandId} AND ${vehicleModelsTable.slug} = ${modelSlug}`)
      .limit(1);
    const values = {
      brandId,
      name: m.name,
      slug: modelSlug,
      vehicleCategoryId: catMap[m.cat],
      seatCategoryId: seatMap[seatKey],
      fuelTypeId: m.fuel ? fuelMap[m.fuel] : null,
    };
    if (existing[0]) {
      await db.update(vehicleModelsTable).set({ ...values, updatedAt: new Date() }).where(eq(vehicleModelsTable.id, existing[0].id));
    } else {
      await db.insert(vehicleModelsTable).values(values);
    }
  }

  // States & Cities (UP focus + major metros)
  const stateDefs = [
    { name: "Uttar Pradesh", code: "UP" },
    { name: "Delhi", code: "DL" },
    { name: "Maharashtra", code: "MH" },
    { name: "Karnataka", code: "KA" },
    { name: "Telangana", code: "TS" },
    { name: "West Bengal", code: "WB" },
    { name: "Rajasthan", code: "RJ" },
    { name: "Gujarat", code: "GJ" },
    { name: "Madhya Pradesh", code: "MP" },
    { name: "Bihar", code: "BR" },
  ];
  const stateMap: Record<string, number> = {};
  for (const s of stateDefs) {
    const existing = await db.select().from(statesTable).where(eq(statesTable.code, s.code)).limit(1);
    if (existing[0]) stateMap[s.code] = existing[0].id;
    else {
      const [row] = await db.insert(statesTable).values(s).returning();
      stateMap[s.code] = row.id;
    }
  }

  const cityDefs = [
    { state: "UP", name: "Varanasi", areas: ["Lanka", "Sigra", "Bhelupur", "Cantt", "Sarnath", "Shivpur", "Rohaniya"] },
    { state: "UP", name: "Lucknow", areas: ["Gomti Nagar", "Hazratganj", "Aliganj", "Indira Nagar"] },
    { state: "UP", name: "Prayagraj", areas: ["Civil Lines", "George Town", "Naini"] },
    { state: "UP", name: "Kanpur", areas: ["Civil Lines", "Kakadeo", "Swaroop Nagar"] },
    { state: "UP", name: "Noida", areas: ["Sector 18", "Sector 62", "Greater Noida"] },
    { state: "UP", name: "Ghaziabad", areas: ["Vaishali", "Indirapuram", "Raj Nagar"] },
    { state: "DL", name: "New Delhi", areas: ["South Delhi", "Central Delhi", "Dwarka", "Rohini"] },
    { state: "MH", name: "Mumbai", areas: ["Andheri", "Bandra", "Powai", "Thane"] },
    { state: "MH", name: "Pune", areas: ["Koregaon Park", "Hinjewadi", "Kothrud"] },
    { state: "KA", name: "Bengaluru", areas: ["Indiranagar", "Koramangala", "Whitefield", "HSR Layout"] },
  ];

  const pincodeSamples: Record<string, string[]> = {
    Varanasi: ["221005", "221002", "221010", "221007", "221003"],
    Lucknow: ["226001", "226010", "226016", "226024"],
    "New Delhi": ["110001", "110017", "110075", "110085"],
    Mumbai: ["400001", "400050", "400076", "400607"],
    Bengaluru: ["560001", "560034", "560066", "560102"],
    Pune: ["411001", "411014", "411057"],
    Noida: ["201301", "201304", "201310"],
  };

  for (const c of cityDefs) {
    const citySlug = slug(c.name);
    let cityId: number;
    const existingCity = await db.select().from(citiesTable)
      .where(sql`${citiesTable.stateId} = ${stateMap[c.state]} AND ${citiesTable.slug} = ${citySlug}`)
      .limit(1);
    if (existingCity[0]) cityId = existingCity[0].id;
    else {
      const [row] = await db.insert(citiesTable).values({ stateId: stateMap[c.state], name: c.name, slug: citySlug }).returning();
      cityId = row.id;
    }

    for (const areaName of c.areas) {
      const existingArea = await db.select().from(serviceAreasTable)
        .where(sql`${serviceAreasTable.cityId} = ${cityId} AND ${serviceAreasTable.name} = ${areaName}`)
        .limit(1);
      let areaId: number;
      if (existingArea[0]) areaId = existingArea[0].id;
      else {
        const [row] = await db.insert(serviceAreasTable).values({ cityId, name: areaName }).returning();
        areaId = row.id;
      }

      const pins = pincodeSamples[c.name] ?? [`${221000 + areaId}`];
      for (const pin of pins) {
        const existingPin = await db.select().from(pincodesTable).where(eq(pincodesTable.pincode, pin)).limit(1);
        if (!existingPin[0]) {
          await db.insert(pincodesTable).values({ serviceAreaId: areaId, pincode: pin });
        }
      }
    }
  }

  // Service categories
  const svcCats = await upsertBySlug(serviceCategoriesTable, [
    { name: "Car Wash", slug: "car-wash", legacyCategory: "car_wash", sortOrder: 1 },
    { name: "Detailing", slug: "detailing", legacyCategory: "detailing", sortOrder: 2 },
    { name: "Ceramic Coating", slug: "ceramic-coating", legacyCategory: "ceramic_coating", sortOrder: 3 },
    { name: "PPF", slug: "ppf", legacyCategory: "ppf", sortOrder: 4 },
    { name: "Interior", slug: "interior", legacyCategory: "interior", sortOrder: 5 },
    { name: "Solar Cleaning", slug: "solar-cleaning", legacyCategory: "solar_cleaning", sortOrder: 6 },
    { name: "AMC", slug: "amc", legacyCategory: "amc", sortOrder: 7 },
    { name: "Subscription", slug: "subscription", legacyCategory: "subscription", sortOrder: 8 },
  ]);
  const svcCatMap = Object.fromEntries(svcCats.map(c => [c.legacyCategory, c.id]));

  // Link existing services to categories
  const allServices = await db.select().from(servicesTable);
  for (const svc of allServices) {
    const catId = svcCatMap[svc.category];
    if (catId && !svc.serviceCategoryId) {
      await db.update(servicesTable).set({ serviceCategoryId: catId }).where(eq(servicesTable.id, svc.id));
    }
  }

  // Service pricing matrix for car wash
  const carWash = allServices.find(s => s.category === "car_wash" || s.name.toLowerCase().includes("basic"));
  if (carWash) {
    const pricingDefs = [
      { seat: "5-seater", price: "299" },
      { seat: "7-seater", price: "449" },
      { seat: "8-seater", price: "549" },
      { cat: "luxury", seat: "5-seater", price: "799" },
      { cat: "suv", seat: "5-seater", price: "399" },
    ];
    for (const p of pricingDefs) {
      const conditions = [eq(servicePricingTable.serviceId, carWash.id)];
      const existing = await db.select().from(servicePricingTable).where(eq(servicePricingTable.serviceId, carWash.id));
      const match = existing.find(e =>
        (p.seat ? e.seatCategoryId === seatMap[p.seat] : true) &&
        (p.cat ? e.vehicleCategoryId === catMap[p.cat] : !e.vehicleCategoryId),
      );
      if (!match) {
        await db.insert(servicePricingTable).values({
          serviceId: carWash.id,
          vehicleCategoryId: p.cat ? catMap[p.cat] : null,
          seatCategoryId: p.seat ? seatMap[p.seat] : null,
          price: p.price,
          durationMinutes: 45,
        });
      }
    }
  }

  const premiumWash = allServices.find(s => s.name.toLowerCase().includes("premium"));
  if (premiumWash) {
    for (const [seatKey, price] of [["5-seater", "599"], ["7-seater", "799"]] as const) {
      const existing = await db.select().from(servicePricingTable)
        .where(sql`${servicePricingTable.serviceId} = ${premiumWash.id} AND ${servicePricingTable.seatCategoryId} = ${seatMap[seatKey]}`)
        .limit(1);
      if (!existing[0]) {
        await db.insert(servicePricingTable).values({
          serviceId: premiumWash.id,
          seatCategoryId: seatMap[seatKey],
          price,
          durationMinutes: 60,
        });
      }
    }
  }

  // Service plans for homepage
  if (carWash) {
    const planDefs = [
      { name: "Daily Exterior Clean", price: "1000", durationMonths: 1, tag: null, isHighlighted: false, features: ["Daily exterior foam wash", "Tyre shine", "Window wipe", "Available 8–10 AM"] },
      { name: "1 Time Wash", price: "600", durationMonths: 1, tag: null, isHighlighted: false, features: ["1 full wash/month", "Exterior foam wash", "Interior vacuum", "Glass cleaning"] },
      { name: "Daily Clean + 1 Full Wash", price: "1300", durationMonths: 1, tag: "POPULAR", isHighlighted: true, features: ["Daily exterior wash", "1 full wash/month", "Interior vacuum & polish"] },
      { name: "Daily Clean + 2 Full Washes", price: "1600", durationMonths: 1, tag: "BEST VALUE", isHighlighted: false, features: ["Daily exterior wash", "2 full washes/month", "Interior vacuum & polish"] },
      { name: "Wash Card", price: "1600", durationMonths: 4, tag: "FLEXIBLE", isHighlighted: false, features: ["4 full washes", "4 month validity", "No monthly commitment"] },
    ];
    for (let i = 0; i < planDefs.length; i++) {
      const p = planDefs[i];
      const existing = await db.select().from(servicePlansTable)
        .where(sql`${servicePlansTable.serviceId} = ${carWash.id} AND ${servicePlansTable.name} = ${p.name}`)
        .limit(1);
      if (!existing[0]) {
        await db.insert(servicePlansTable).values({
          serviceId: carWash.id,
          ...p,
          sortOrder: i + 1,
        });
      }
    }
  }

  // Backfill vehicle_model_id on existing vehicles
  await db.execute(sql`
    UPDATE vehicles v
    SET vehicle_model_id = vm.id
    FROM vehicle_models vm
    JOIN vehicle_brands vb ON vb.id = vm.brand_id
    WHERE LOWER(v.make) = LOWER(vb.name)
      AND LOWER(v.model) = LOWER(vm.name)
      AND v.vehicle_model_id IS NULL
  `);

  console.log("Master data seeded successfully.");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.includes("seed-master-data")) {
  seedMasterData()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
