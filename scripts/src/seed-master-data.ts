import "./load-env.js";
import { db } from "@workspace/db";
import {
  vehicleCategoriesTable, seatCategoriesTable, fuelTypesTable,
  vehicleBrandsTable, vehicleModelsTable,
  statesTable, citiesTable, serviceAreasTable, pincodesTable,
  serviceCategoriesTable, servicePlansTable, servicePricingTable,
  servicesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function upsertBySlug<T extends { slug: string; id: number }>(
  table: any,
  items: Array<Record<string, unknown> & { slug: string }>,
): Promise<T[]> {
  const results: T[] = [];
  for (const item of items) {
    const existing = await db.select().from(table).where(eq(table.slug, item.slug)).limit(1);
    if (existing[0]) {
      const updated = await db.update(table).set({ ...item, updatedAt: new Date() }).where(eq(table.id, (existing[0] as any).id)).returning();
      if (updated[0]) results.push(updated[0] as T);
    } else {
      const created = await db.insert(table).values(item).returning();
      if (created[0]) results.push(created[0] as T);
    }
  }
  return results;
}

async function upsertByCode(items: Array<{ name: string; code: string }>) {
  const results: Array<{ id: number; code: string }> = [];
  for (const item of items) {
    const existing = await db.select().from(statesTable).where(eq(statesTable.code, item.code)).limit(1);
    if (existing[0]) {
      results.push({ id: existing[0].id, code: item.code });
    } else {
      const [row] = await db.insert(statesTable).values(item).returning();
      results.push({ id: row.id, code: item.code });
    }
  }
  return results;
}

async function upsertBrand(name: string, sortOrder: number): Promise<number> {
  const s = slug(name);
  const existing = await db.select().from(vehicleBrandsTable).where(eq(vehicleBrandsTable.slug, s)).limit(1);
  if (existing[0]) return existing[0].id;
  const [b] = await db.insert(vehicleBrandsTable).values({ name, slug: s, sortOrder }).returning();
  return b.id;
}

async function upsertModel(values: {
  brandId: number; name: string; slug: string;
  vehicleCategoryId: number; seatCategoryId: number; fuelTypeId: number | null;
}) {
  const existing = await db.select().from(vehicleModelsTable)
    .where(sql`${vehicleModelsTable.brandId} = ${values.brandId} AND ${vehicleModelsTable.slug} = ${values.slug}`)
    .limit(1);
  if (existing[0]) {
    await db.update(vehicleModelsTable).set({ ...values, updatedAt: new Date() }).where(eq(vehicleModelsTable.id, existing[0].id));
  } else {
    await db.insert(vehicleModelsTable).values(values);
  }
}

async function upsertCity(stateId: number, name: string): Promise<number> {
  const s = slug(name);
  const existing = await db.select().from(citiesTable)
    .where(sql`${citiesTable.stateId} = ${stateId} AND ${citiesTable.slug} = ${s}`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(citiesTable).values({ stateId, name, slug: s }).returning();
  return row.id;
}

async function upsertArea(cityId: number, areaName: string): Promise<number> {
  const existing = await db.select().from(serviceAreasTable)
    .where(sql`${serviceAreasTable.cityId} = ${cityId} AND ${serviceAreasTable.name} = ${areaName}`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(serviceAreasTable).values({ cityId, name: areaName }).returning();
  return row.id;
}

async function upsertPincode(serviceAreaId: number, pincode: string) {
  const existing = await db.select().from(pincodesTable).where(eq(pincodesTable.pincode, pincode)).limit(1);
  if (!existing[0]) {
    await db.insert(pincodesTable).values({ serviceAreaId, pincode });
  }
}

export async function seedMasterData() {
  console.log("Seeding complete India master data...");

  // ─── 1. Vehicle Categories ────────────────────────────────────────────────
  const cats = await upsertBySlug(vehicleCategoriesTable, [
    { name: "Hatchback",   slug: "hatchback",   description: "Compact hatchback cars",          sortOrder: 1 },
    { name: "Sedan",       slug: "sedan",        description: "3-box sedans",                    sortOrder: 2 },
    { name: "SUV",         slug: "suv",          description: "Sport utility vehicles",          sortOrder: 3 },
    { name: "Compact SUV", slug: "compact-suv",  description: "Sub-4m compact SUVs",             sortOrder: 4 },
    { name: "MUV",         slug: "muv",          description: "Multi utility vehicles / MPVs",   sortOrder: 5 },
    { name: "Luxury",      slug: "luxury",       description: "Premium & luxury cars",           sortOrder: 6 },
    { name: "Van",         slug: "van",          description: "Vans & full-size MPVs",           sortOrder: 7 },
    { name: "Pickup",      slug: "pickup",       description: "Pickup trucks",                   sortOrder: 8 },
    { name: "Crossover",   slug: "crossover",    description: "Crossover / coupe SUVs",          sortOrder: 9 },
  ]) as Array<{ id: number; slug: string }>;
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.id]));

  // ─── 2. Seat Categories ───────────────────────────────────────────────────
  const seats = await upsertBySlug(seatCategoriesTable, [
    { name: "4 Seater",  slug: "4-seater",  seatCount: 4, sortOrder: 1 },
    { name: "5 Seater",  slug: "5-seater",  seatCount: 5, sortOrder: 2 },
    { name: "6 Seater",  slug: "6-seater",  seatCount: 6, sortOrder: 3 },
    { name: "7 Seater",  slug: "7-seater",  seatCount: 7, sortOrder: 4 },
    { name: "8 Seater",  slug: "8-seater",  seatCount: 8, sortOrder: 5 },
    { name: "9+ Seater", slug: "9-seater",  seatCount: 9, sortOrder: 6 },
  ]) as Array<{ id: number; slug: string }>;
  const seatMap = Object.fromEntries(seats.map(s => [s.slug, s.id]));

  // ─── 3. Fuel Types ────────────────────────────────────────────────────────
  const fuels = await upsertBySlug(fuelTypesTable, [
    { name: "Petrol",          slug: "petrol",   sortOrder: 1 },
    { name: "Diesel",          slug: "diesel",   sortOrder: 2 },
    { name: "CNG",             slug: "cng",      sortOrder: 3 },
    { name: "Electric (EV)",   slug: "electric", sortOrder: 4 },
    { name: "Petrol Hybrid",   slug: "hybrid",   sortOrder: 5 },
    { name: "LPG",             slug: "lpg",      sortOrder: 6 },
    { name: "Petrol + CNG",    slug: "petrol-cng", sortOrder: 7 },
  ]) as Array<{ id: number; slug: string }>;
  const fuelMap = Object.fromEntries(fuels.map(f => [f.slug, f.id]));

  const p = (key: string) => fuelMap[key] ?? null;
  const c = (key: string) => catMap[key] ?? catMap["suv"];
  const s5 = seatMap["5-seater"];
  const s7 = seatMap["7-seater"];
  const s4 = seatMap["4-seater"];
  const s6 = seatMap["6-seater"];
  const s8 = seatMap["8-seater"];
  const s9 = seatMap["9-seater"];

  // ─── 4. Vehicle Brands & Models ───────────────────────────────────────────
  type M = { name: string; cat: string; seat: number; fuel: string | null };
  type BrandDef = { brand: string; models: M[] };

  const brandDefs: BrandDef[] = [

    // ── MARUTI SUZUKI ──────────────────────────────────────────────────────
    { brand: "Maruti Suzuki", models: [
      { name: "Alto K10",           cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "S-Presso",           cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Celerio",            cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "WagonR",             cat: "hatchback",   seat: s5, fuel: "petrol-cng" },
      { name: "Swift",              cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Baleno",             cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Ignis",              cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Dzire",              cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Ciaz",               cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Brezza",             cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Fronx",              cat: "crossover",   seat: s5, fuel: "petrol" },
      { name: "Grand Vitara",       cat: "suv",         seat: s5, fuel: "hybrid" },
      { name: "Jimny",              cat: "suv",         seat: s4, fuel: "petrol" },
      { name: "Ertiga",             cat: "muv",         seat: s7, fuel: "petrol-cng" },
      { name: "XL6",                cat: "muv",         seat: s7, fuel: "petrol" },
      { name: "Invicto",            cat: "muv",         seat: s7, fuel: "hybrid" },
    ]},

    // ── HYUNDAI ────────────────────────────────────────────────────────────
    { brand: "Hyundai", models: [
      { name: "i10 Nios",           cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "i20",                cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Aura",               cat: "sedan",       seat: s5, fuel: "petrol-cng" },
      { name: "Verna",              cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Exter",              cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Venue",              cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Creta",              cat: "suv",         seat: s5, fuel: "petrol" },
      { name: "Creta N Line",       cat: "suv",         seat: s5, fuel: "petrol" },
      { name: "Creta EV",           cat: "suv",         seat: s5, fuel: "electric" },
      { name: "Alcazar",            cat: "suv",         seat: s7, fuel: "petrol" },
      { name: "Tucson",             cat: "suv",         seat: s5, fuel: "diesel" },
      { name: "Ioniq 5",            cat: "crossover",   seat: s5, fuel: "electric" },
      { name: "Ioniq 6",            cat: "sedan",       seat: s5, fuel: "electric" },
    ]},

    // ── TATA MOTORS ───────────────────────────────────────────────────────
    { brand: "Tata", models: [
      { name: "Tiago",              cat: "hatchback",   seat: s5, fuel: "petrol-cng" },
      { name: "Tiago EV",           cat: "hatchback",   seat: s5, fuel: "electric" },
      { name: "Altroz",             cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Altroz EV",          cat: "hatchback",   seat: s5, fuel: "electric" },
      { name: "Tigor",              cat: "sedan",       seat: s5, fuel: "petrol-cng" },
      { name: "Tigor EV",           cat: "sedan",       seat: s5, fuel: "electric" },
      { name: "Punch",              cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Punch EV",           cat: "compact-suv", seat: s5, fuel: "electric" },
      { name: "Nexon",              cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Nexon EV",           cat: "compact-suv", seat: s5, fuel: "electric" },
      { name: "Harrier",            cat: "suv",         seat: s5, fuel: "diesel" },
      { name: "Safari",             cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Curvv",              cat: "crossover",   seat: s5, fuel: "petrol" },
      { name: "Curvv EV",           cat: "crossover",   seat: s5, fuel: "electric" },
      { name: "Sierra EV",          cat: "suv",         seat: s5, fuel: "electric" },
    ]},

    // ── MAHINDRA ───────────────────────────────────────────────────────────
    { brand: "Mahindra", models: [
      { name: "Thar",               cat: "suv",         seat: s4, fuel: "diesel" },
      { name: "Thar Roxx",          cat: "suv",         seat: s5, fuel: "diesel" },
      { name: "Bolero",             cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Bolero Neo",         cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Scorpio Classic",    cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Scorpio-N",          cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "XUV 3XO",            cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "XUV300",             cat: "compact-suv", seat: s5, fuel: "diesel" },
      { name: "XUV400 EV",          cat: "suv",         seat: s5, fuel: "electric" },
      { name: "XUV700",             cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Marazzo",            cat: "muv",         seat: s8, fuel: "diesel" },
      { name: "Bolero Camper",      cat: "pickup",      seat: s5, fuel: "diesel" },
      { name: "BE 6",               cat: "crossover",   seat: s5, fuel: "electric" },
      { name: "XEV 9e",             cat: "suv",         seat: s5, fuel: "electric" },
    ]},

    // ── TOYOTA ─────────────────────────────────────────────────────────────
    { brand: "Toyota", models: [
      { name: "Glanza",             cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Urban Cruiser Hyryder", cat: "suv",      seat: s5, fuel: "hybrid" },
      { name: "Rumion",             cat: "muv",         seat: s7, fuel: "petrol" },
      { name: "Innova Crysta",      cat: "muv",         seat: s7, fuel: "diesel" },
      { name: "Innova Hycross",     cat: "muv",         seat: s7, fuel: "hybrid" },
      { name: "Fortuner",           cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Legender",           cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Hilux",              cat: "pickup",      seat: s5, fuel: "diesel" },
      { name: "Camry",              cat: "sedan",       seat: s5, fuel: "hybrid" },
      { name: "Vellfire",           cat: "muv",         seat: s7, fuel: "hybrid" },
      { name: "Land Cruiser 300",   cat: "suv",         seat: s7, fuel: "diesel" },
    ]},

    // ── HONDA ──────────────────────────────────────────────────────────────
    { brand: "Honda", models: [
      { name: "Amaze",              cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "City",               cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "City Hybrid",        cat: "sedan",       seat: s5, fuel: "hybrid" },
      { name: "Elevate",            cat: "suv",         seat: s5, fuel: "petrol" },
    ]},

    // ── KIA ────────────────────────────────────────────────────────────────
    { brand: "Kia", models: [
      { name: "Sonet",              cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Seltos",             cat: "suv",         seat: s5, fuel: "petrol" },
      { name: "Carens",             cat: "muv",         seat: s7, fuel: "petrol" },
      { name: "EV6",                cat: "crossover",   seat: s5, fuel: "electric" },
      { name: "EV9",                cat: "suv",         seat: s7, fuel: "electric" },
      { name: "Carnival",           cat: "muv",         seat: s8, fuel: "diesel" },
    ]},

    // ── MG (MORRIS GARAGES) ────────────────────────────────────────────────
    { brand: "MG", models: [
      { name: "Comet EV",           cat: "hatchback",   seat: s4, fuel: "electric" },
      { name: "Astor",              cat: "suv",         seat: s5, fuel: "petrol" },
      { name: "Hector",             cat: "suv",         seat: s5, fuel: "petrol" },
      { name: "Hector Plus",        cat: "suv",         seat: s7, fuel: "petrol" },
      { name: "Gloster",            cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "ZS EV",              cat: "suv",         seat: s5, fuel: "electric" },
      { name: "Windsor EV",         cat: "suv",         seat: s5, fuel: "electric" },
    ]},

    // ── VOLKSWAGEN ────────────────────────────────────────────────────────
    { brand: "Volkswagen", models: [
      { name: "Polo",               cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Vento",              cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Virtus",             cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Taigun",             cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Tiguan",             cat: "suv",         seat: s5, fuel: "petrol" },
      { name: "T-Roc",              cat: "suv",         seat: s5, fuel: "petrol" },
    ]},

    // ── SKODA ─────────────────────────────────────────────────────────────
    { brand: "Skoda", models: [
      { name: "Rapid",              cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Slavia",             cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Kushaq",             cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Octavia",            cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Superb",             cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Kodiaq",             cat: "suv",         seat: s7, fuel: "petrol" },
      { name: "Karoq",              cat: "suv",         seat: s5, fuel: "petrol" },
    ]},

    // ── RENAULT ───────────────────────────────────────────────────────────
    { brand: "Renault", models: [
      { name: "Kwid",               cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Kiger",              cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Triber",             cat: "muv",         seat: s7, fuel: "petrol" },
      { name: "Duster",             cat: "suv",         seat: s5, fuel: "diesel" },
    ]},

    // ── NISSAN ────────────────────────────────────────────────────────────
    { brand: "Nissan", models: [
      { name: "Magnite",            cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "X-Trail",            cat: "suv",         seat: s5, fuel: "hybrid" },
      { name: "GT-R",               cat: "luxury",      seat: s4, fuel: "petrol" },
    ]},

    // ── JEEP ──────────────────────────────────────────────────────────────
    { brand: "Jeep", models: [
      { name: "Compass",            cat: "suv",         seat: s5, fuel: "petrol" },
      { name: "Meridian",           cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Wrangler",           cat: "suv",         seat: s4, fuel: "petrol" },
      { name: "Grand Cherokee",     cat: "suv",         seat: s5, fuel: "diesel" },
    ]},

    // ── CITROEN ───────────────────────────────────────────────────────────
    { brand: "Citroen", models: [
      { name: "C3",                 cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "C3 Aircross",        cat: "compact-suv", seat: s7, fuel: "petrol" },
      { name: "eC3",                cat: "hatchback",   seat: s5, fuel: "electric" },
      { name: "Basalt",             cat: "crossover",   seat: s5, fuel: "petrol" },
    ]},

    // ── FORCE MOTORS ──────────────────────────────────────────────────────
    { brand: "Force", models: [
      { name: "Gurkha",             cat: "suv",         seat: s4, fuel: "diesel" },
      { name: "Gurkha 5-Door",      cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Traveller",          cat: "van",         seat: s9, fuel: "diesel" },
    ]},

    // ── ISUZU ─────────────────────────────────────────────────────────────
    { brand: "Isuzu", models: [
      { name: "D-Max S-Cab",        cat: "pickup",      seat: s5, fuel: "diesel" },
      { name: "D-Max V-Cross",      cat: "pickup",      seat: s5, fuel: "diesel" },
      { name: "MU-X",               cat: "suv",         seat: s7, fuel: "diesel" },
    ]},

    // ── BYD ───────────────────────────────────────────────────────────────
    { brand: "BYD", models: [
      { name: "Atto 3",             cat: "suv",         seat: s5, fuel: "electric" },
      { name: "Seal",               cat: "sedan",       seat: s5, fuel: "electric" },
      { name: "e6",                 cat: "muv",         seat: s5, fuel: "electric" },
    ]},

    // ── BMW ───────────────────────────────────────────────────────────────
    { brand: "BMW", models: [
      { name: "1 Series",           cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "2 Series Gran Coupe",cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "3 Series",           cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "5 Series",           cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "7 Series",           cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "X1",                 cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "X3",                 cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "X5",                 cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "X6",                 cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "X7",                 cat: "luxury",      seat: s7, fuel: "diesel" },
      { name: "iX",                 cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "i4",                 cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "M3",                 cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "M5",                 cat: "luxury",      seat: s5, fuel: "petrol" },
    ]},

    // ── MERCEDES-BENZ ─────────────────────────────────────────────────────
    { brand: "Mercedes-Benz", models: [
      { name: "A-Class Limousine",  cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "C-Class",            cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "E-Class",            cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "S-Class",            cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "GLA",                cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "GLB",                cat: "luxury",      seat: s7, fuel: "petrol" },
      { name: "GLC",                cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "GLE",                cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "GLS",                cat: "luxury",      seat: s7, fuel: "diesel" },
      { name: "G-Class",            cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "EQS",                cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "EQB",                cat: "luxury",      seat: s7, fuel: "electric" },
      { name: "AMG GT",             cat: "luxury",      seat: s4, fuel: "petrol" },
    ]},

    // ── AUDI ──────────────────────────────────────────────────────────────
    { brand: "Audi", models: [
      { name: "A4",                 cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "A6",                 cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "A8 L",               cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Q3",                 cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Q5",                 cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "Q7",                 cat: "luxury",      seat: s7, fuel: "petrol" },
      { name: "Q8",                 cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "e-tron",             cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "e-tron GT",          cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "RS7",                cat: "luxury",      seat: s5, fuel: "petrol" },
    ]},

    // ── VOLVO ─────────────────────────────────────────────────────────────
    { brand: "Volvo", models: [
      { name: "S60",                cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "S90",                cat: "luxury",      seat: s5, fuel: "hybrid" },
      { name: "XC40",               cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "XC40 Recharge",      cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "XC60",               cat: "luxury",      seat: s5, fuel: "hybrid" },
      { name: "XC90",               cat: "luxury",      seat: s7, fuel: "hybrid" },
      { name: "EX40",               cat: "luxury",      seat: s5, fuel: "electric" },
    ]},

    // ── LAND ROVER ────────────────────────────────────────────────────────
    { brand: "Land Rover", models: [
      { name: "Defender 90",        cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "Defender 110",       cat: "luxury",      seat: s7, fuel: "diesel" },
      { name: "Discovery Sport",    cat: "luxury",      seat: s7, fuel: "diesel" },
      { name: "Discovery",          cat: "luxury",      seat: s7, fuel: "diesel" },
      { name: "Range Rover Evoque", cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "Range Rover Velar",  cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "Range Rover Sport",  cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "Range Rover",        cat: "luxury",      seat: s5, fuel: "diesel" },
    ]},

    // ── JAGUAR ────────────────────────────────────────────────────────────
    { brand: "Jaguar", models: [
      { name: "XE",                 cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "XF",                 cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "F-Pace",             cat: "luxury",      seat: s5, fuel: "diesel" },
      { name: "I-Pace",             cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "F-Type",             cat: "luxury",      seat: s4, fuel: "petrol" },
    ]},

    // ── PORSCHE ───────────────────────────────────────────────────────────
    { brand: "Porsche", models: [
      { name: "Cayenne",            cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Cayenne E-Hybrid",   cat: "luxury",      seat: s5, fuel: "hybrid" },
      { name: "Macan",              cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Macan EV",           cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "Panamera",           cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Taycan",             cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "911",                cat: "luxury",      seat: s4, fuel: "petrol" },
    ]},

    // ── LEXUS ─────────────────────────────────────────────────────────────
    { brand: "Lexus", models: [
      { name: "UX 300e",            cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "NX",                 cat: "luxury",      seat: s5, fuel: "hybrid" },
      { name: "RX",                 cat: "luxury",      seat: s5, fuel: "hybrid" },
      { name: "ES",                 cat: "luxury",      seat: s5, fuel: "hybrid" },
      { name: "LS",                 cat: "luxury",      seat: s5, fuel: "hybrid" },
      { name: "LX",                 cat: "luxury",      seat: s7, fuel: "petrol" },
    ]},

    // ── MINI ──────────────────────────────────────────────────────────────
    { brand: "MINI", models: [
      { name: "Cooper",             cat: "luxury",      seat: s4, fuel: "petrol" },
      { name: "Cooper S",           cat: "luxury",      seat: s4, fuel: "petrol" },
      { name: "Countryman",         cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Countryman EV",      cat: "luxury",      seat: s5, fuel: "electric" },
      { name: "Clubman",            cat: "luxury",      seat: s5, fuel: "petrol" },
    ]},

    // ── BENTLEY ───────────────────────────────────────────────────────────
    { brand: "Bentley", models: [
      { name: "Bentayga",           cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Continental GT",     cat: "luxury",      seat: s4, fuel: "petrol" },
      { name: "Flying Spur",        cat: "luxury",      seat: s5, fuel: "petrol" },
    ]},

    // ── ROLLS-ROYCE ───────────────────────────────────────────────────────
    { brand: "Rolls-Royce", models: [
      { name: "Cullinan",           cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Ghost",              cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Phantom",            cat: "luxury",      seat: s5, fuel: "petrol" },
      { name: "Wraith",             cat: "luxury",      seat: s4, fuel: "petrol" },
      { name: "Spectre",            cat: "luxury",      seat: s4, fuel: "electric" },
    ]},

    // ── CHEVROLET (discontinued in India, cars still on roads) ─────────────
    { brand: "Chevrolet", models: [
      { name: "Beat",               cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Sail",               cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "Cruze",              cat: "sedan",       seat: s5, fuel: "diesel" },
      { name: "Trailblazer",        cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Tavera",             cat: "muv",         seat: s7, fuel: "diesel" },
      { name: "Captiva",            cat: "suv",         seat: s7, fuel: "diesel" },
    ]},

    // ── FORD (discontinued in India, cars still on roads) ─────────────────
    { brand: "Ford", models: [
      { name: "Figo",               cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Freestyle",          cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "Aspire",             cat: "sedan",       seat: s5, fuel: "petrol" },
      { name: "EcoSport",           cat: "compact-suv", seat: s5, fuel: "petrol" },
      { name: "Endeavour",          cat: "suv",         seat: s7, fuel: "diesel" },
      { name: "Mustang",            cat: "luxury",      seat: s4, fuel: "petrol" },
    ]},

    // ── DATSUN (discontinued) ─────────────────────────────────────────────
    { brand: "Datsun", models: [
      { name: "Redi-GO",            cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "GO",                 cat: "hatchback",   seat: s5, fuel: "petrol" },
      { name: "GO+",                cat: "muv",         seat: s7, fuel: "petrol" },
    ]},

    // ── MITSUBISHI ────────────────────────────────────────────────────────
    { brand: "Mitsubishi", models: [
      { name: "Outlander",          cat: "suv",         seat: s7, fuel: "petrol" },
      { name: "Eclipse Cross",      cat: "crossover",   seat: s5, fuel: "petrol" },
    ]},
  ];

  let brandSortOrder = 1;
  for (const bd of brandDefs) {
    const brandId = await upsertBrand(bd.brand, brandSortOrder++);
    for (const m of bd.models) {
      const modelSlug = slug(`${bd.brand}-${m.name}`);
      const catId = catMap[m.cat] ?? catMap["suv"];
      const fuelId = m.fuel ? (fuelMap[m.fuel] ?? null) : null;
      await upsertModel({
        brandId,
        name: m.name,
        slug: modelSlug,
        vehicleCategoryId: catId,
        seatCategoryId: m.seat,
        fuelTypeId: fuelId,
      });
    }
  }
  console.log("  ✓ Vehicle brands & models seeded");

  // ─── 5. States (All 28 states + 8 UTs) ───────────────────────────────────
  const stateRows = await upsertByCode([
    // States
    { name: "Andhra Pradesh",           code: "AP" },
    { name: "Arunachal Pradesh",        code: "AR" },
    { name: "Assam",                    code: "AS" },
    { name: "Bihar",                    code: "BR" },
    { name: "Chhattisgarh",             code: "CG" },
    { name: "Goa",                      code: "GA" },
    { name: "Gujarat",                  code: "GJ" },
    { name: "Haryana",                  code: "HR" },
    { name: "Himachal Pradesh",         code: "HP" },
    { name: "Jharkhand",                code: "JH" },
    { name: "Karnataka",                code: "KA" },
    { name: "Kerala",                   code: "KL" },
    { name: "Madhya Pradesh",           code: "MP" },
    { name: "Maharashtra",              code: "MH" },
    { name: "Manipur",                  code: "MN" },
    { name: "Meghalaya",                code: "ML" },
    { name: "Mizoram",                  code: "MZ" },
    { name: "Nagaland",                 code: "NL" },
    { name: "Odisha",                   code: "OD" },
    { name: "Punjab",                   code: "PB" },
    { name: "Rajasthan",                code: "RJ" },
    { name: "Sikkim",                   code: "SK" },
    { name: "Tamil Nadu",               code: "TN" },
    { name: "Telangana",                code: "TS" },
    { name: "Tripura",                  code: "TR" },
    { name: "Uttar Pradesh",            code: "UP" },
    { name: "Uttarakhand",              code: "UK" },
    { name: "West Bengal",              code: "WB" },
    // Union Territories
    { name: "Andaman & Nicobar Islands",code: "AN" },
    { name: "Chandigarh",               code: "CH" },
    { name: "Dadra & NH and Daman & Diu", code: "DN" },
    { name: "Delhi",                    code: "DL" },
    { name: "Jammu & Kashmir",          code: "JK" },
    { name: "Ladakh",                   code: "LA" },
    { name: "Lakshadweep",              code: "LD" },
    { name: "Puducherry",               code: "PY" },
  ]);
  const stateMap = Object.fromEntries(stateRows.map(r => [r.code, r.id]));
  console.log("  ✓ States & UTs seeded");

  // ─── 6. Cities with Areas & Pincodes ─────────────────────────────────────
  type AreaDef = { area: string; pins: string[] };
  type CityDef = { state: string; name: string; areas: AreaDef[] };

  const cityDefs: CityDef[] = [

    // ── UTTAR PRADESH ──────────────────────────────────────────────────────
    { state: "UP", name: "Varanasi", areas: [
      { area: "Lanka",          pins: ["221005"] },
      { area: "Sigra",          pins: ["221010"] },
      { area: "Bhelupur",       pins: ["221001"] },
      { area: "Cantonment",     pins: ["221002"] },
      { area: "Sarnath",        pins: ["221007"] },
      { area: "Shivpur",        pins: ["221003"] },
      { area: "Rohaniya",       pins: ["221109"] },
      { area: "Assi",           pins: ["221005"] },
      { area: "Nagwa",          pins: ["221005"] },
      { area: "Kamachha",       pins: ["221010"] },
      { area: "Mahmoorganj",    pins: ["221010"] },
      { area: "Orderly Bazar",  pins: ["221002"] },
    ]},
    { state: "UP", name: "Lucknow", areas: [
      { area: "Hazratganj",     pins: ["226001"] },
      { area: "Gomti Nagar",    pins: ["226010"] },
      { area: "Aliganj",        pins: ["226024"] },
      { area: "Indira Nagar",   pins: ["226016"] },
      { area: "Ashiyana",       pins: ["226012"] },
      { area: "Cantonment",     pins: ["226002"] },
      { area: "Alambagh",       pins: ["226005"] },
      { area: "Mahanagar",      pins: ["226006"] },
      { area: "Vikas Nagar",    pins: ["226022"] },
      { area: "Rajajipuram",    pins: ["226017"] },
    ]},
    { state: "UP", name: "Prayagraj", areas: [
      { area: "Civil Lines",    pins: ["211001"] },
      { area: "George Town",    pins: ["211002"] },
      { area: "Naini",          pins: ["211008"] },
      { area: "Phaphamau",      pins: ["211013"] },
      { area: "Jhusi",          pins: ["211015"] },
      { area: "Allahpur",       pins: ["211006"] },
    ]},
    { state: "UP", name: "Kanpur", areas: [
      { area: "Civil Lines",    pins: ["208001"] },
      { area: "Kakadeo",        pins: ["208025"] },
      { area: "Swaroop Nagar",  pins: ["208002"] },
      { area: "Kidwai Nagar",   pins: ["208011"] },
      { area: "Armapur",        pins: ["208009"] },
      { area: "Govind Nagar",   pins: ["208006"] },
    ]},
    { state: "UP", name: "Agra", areas: [
      { area: "Sadar",          pins: ["282001"] },
      { area: "Taj Mahal Area", pins: ["282003"] },
      { area: "Sikandra",       pins: ["282007"] },
      { area: "Fatehabad Road", pins: ["282001"] },
    ]},
    { state: "UP", name: "Meerut", areas: [
      { area: "Shastri Nagar",  pins: ["250004"] },
      { area: "Pallavpuram",    pins: ["250110"] },
      { area: "Cantonment",     pins: ["250001"] },
    ]},
    { state: "UP", name: "Noida", areas: [
      { area: "Sector 18",      pins: ["201301"] },
      { area: "Sector 62",      pins: ["201309"] },
      { area: "Sector 137",     pins: ["201304"] },
      { area: "Expressway",     pins: ["201307"] },
      { area: "Greater Noida",  pins: ["201310"] },
      { area: "Sector 50",      pins: ["201301"] },
    ]},
    { state: "UP", name: "Ghaziabad", areas: [
      { area: "Vaishali",       pins: ["201010"] },
      { area: "Indirapuram",    pins: ["201014"] },
      { area: "Raj Nagar",      pins: ["201001"] },
      { area: "Kaushambi",      pins: ["201010"] },
      { area: "Crossing Republik", pins: ["201016"] },
    ]},
    { state: "UP", name: "Gorakhpur", areas: [
      { area: "Civil Lines",    pins: ["273001"] },
      { area: "Rustampur",      pins: ["273016"] },
    ]},
    { state: "UP", name: "Mathura", areas: [
      { area: "Krishna Nagar",  pins: ["281003"] },
      { area: "Vrindavan",      pins: ["281121"] },
    ]},

    // ── DELHI ──────────────────────────────────────────────────────────────
    { state: "DL", name: "New Delhi", areas: [
      { area: "Connaught Place",pins: ["110001"] },
      { area: "Karol Bagh",     pins: ["110005"] },
      { area: "Dwarka",         pins: ["110075"] },
      { area: "Rohini",         pins: ["110085"] },
      { area: "Pitampura",      pins: ["110034"] },
      { area: "Janakpuri",      pins: ["110058"] },
      { area: "Saket",          pins: ["110017"] },
      { area: "Vasant Kunj",    pins: ["110070"] },
      { area: "Lajpat Nagar",   pins: ["110024"] },
      { area: "East Delhi",     pins: ["110092"] },
      { area: "South Extension",pins: ["110049"] },
      { area: "Greater Kailash",pins: ["110048"] },
      { area: "Preet Vihar",    pins: ["110092"] },
      { area: "Mayur Vihar",    pins: ["110091"] },
    ]},

    // ── MAHARASHTRA ────────────────────────────────────────────────────────
    { state: "MH", name: "Mumbai", areas: [
      { area: "Andheri West",   pins: ["400058"] },
      { area: "Bandra West",    pins: ["400050"] },
      { area: "Powai",          pins: ["400076"] },
      { area: "Lower Parel",    pins: ["400013"] },
      { area: "Borivali",       pins: ["400066"] },
      { area: "Malad",          pins: ["400064"] },
      { area: "Dadar",          pins: ["400014"] },
      { area: "Kurla",          pins: ["400070"] },
      { area: "Mulund",         pins: ["400080"] },
      { area: "Kandivali",      pins: ["400067"] },
    ]},
    { state: "MH", name: "Thane", areas: [
      { area: "Thane West",     pins: ["400601"] },
      { area: "Thane East",     pins: ["400603"] },
      { area: "Kalyan",         pins: ["421301"] },
    ]},
    { state: "MH", name: "Pune", areas: [
      { area: "Koregaon Park",  pins: ["411001"] },
      { area: "Hinjewadi",      pins: ["411057"] },
      { area: "Kothrud",        pins: ["411038"] },
      { area: "Aundh",          pins: ["411007"] },
      { area: "Wakad",          pins: ["411057"] },
      { area: "Baner",          pins: ["411045"] },
      { area: "Hadapsar",       pins: ["411028"] },
      { area: "Viman Nagar",    pins: ["411014"] },
    ]},
    { state: "MH", name: "Nagpur", areas: [
      { area: "Dharampeth",     pins: ["440010"] },
      { area: "Sitabuldi",      pins: ["440001"] },
      { area: "Sadar",          pins: ["440001"] },
    ]},
    { state: "MH", name: "Nashik", areas: [
      { area: "Gangapur Road",  pins: ["422005"] },
      { area: "Canada Corner",  pins: ["422002"] },
    ]},

    // ── KARNATAKA ──────────────────────────────────────────────────────────
    { state: "KA", name: "Bengaluru", areas: [
      { area: "Indiranagar",    pins: ["560038"] },
      { area: "Koramangala",    pins: ["560034"] },
      { area: "Whitefield",     pins: ["560066"] },
      { area: "HSR Layout",     pins: ["560102"] },
      { area: "Jayanagar",      pins: ["560041"] },
      { area: "Malleswaram",    pins: ["560003"] },
      { area: "Hebbal",         pins: ["560024"] },
      { area: "Sarjapur",       pins: ["562125"] },
      { area: "Electronic City",pins: ["560100"] },
      { area: "Bannerghatta",   pins: ["560076"] },
      { area: "BTM Layout",     pins: ["560076"] },
      { area: "Marathahalli",   pins: ["560037"] },
    ]},
    { state: "KA", name: "Mysuru", areas: [
      { area: "Saraswathipuram",pins: ["570009"] },
      { area: "Jayalakshmipuram", pins: ["570012"] },
    ]},
    { state: "KA", name: "Mangaluru", areas: [
      { area: "Hampankatta",    pins: ["575001"] },
      { area: "Kadri",          pins: ["575002"] },
    ]},

    // ── TELANGANA ──────────────────────────────────────────────────────────
    { state: "TS", name: "Hyderabad", areas: [
      { area: "Banjara Hills",  pins: ["500034"] },
      { area: "Jubilee Hills",  pins: ["500033"] },
      { area: "Hitech City",    pins: ["500081"] },
      { area: "Gachibowli",     pins: ["500032"] },
      { area: "Madhapur",       pins: ["500081"] },
      { area: "Kukatpally",     pins: ["500072"] },
      { area: "Secunderabad",   pins: ["500003"] },
      { area: "Ameerpet",       pins: ["500016"] },
      { area: "Kondapur",       pins: ["500084"] },
      { area: "LB Nagar",       pins: ["500074"] },
    ]},
    { state: "TS", name: "Warangal", areas: [
      { area: "Hanamkonda",     pins: ["506001"] },
    ]},

    // ── ANDHRA PRADESH ────────────────────────────────────────────────────
    { state: "AP", name: "Visakhapatnam", areas: [
      { area: "Dwaraka Nagar",  pins: ["530016"] },
      { area: "Rushikonda",     pins: ["530045"] },
      { area: "Madhurawada",    pins: ["530041"] },
    ]},
    { state: "AP", name: "Vijayawada", areas: [
      { area: "Benz Circle",    pins: ["520010"] },
      { area: "Moghalrajpuram", pins: ["520010"] },
    ]},
    { state: "AP", name: "Tirupati", areas: [
      { area: "Renigunta Road", pins: ["517501"] },
    ]},

    // ── TAMIL NADU ────────────────────────────────────────────────────────
    { state: "TN", name: "Chennai", areas: [
      { area: "T Nagar",        pins: ["600017"] },
      { area: "Adyar",          pins: ["600020"] },
      { area: "Anna Nagar",     pins: ["600040"] },
      { area: "Velachery",      pins: ["600042"] },
      { area: "OMR",            pins: ["600097"] },
      { area: "Nungambakkam",   pins: ["600034"] },
      { area: "Guindy",         pins: ["600032"] },
      { area: "Perambur",       pins: ["600011"] },
    ]},
    { state: "TN", name: "Coimbatore", areas: [
      { area: "Gandhipuram",    pins: ["641012"] },
      { area: "Peelamedu",      pins: ["641004"] },
    ]},
    { state: "TN", name: "Madurai", areas: [
      { area: "Anna Nagar",     pins: ["625020"] },
    ]},

    // ── KERALA ────────────────────────────────────────────────────────────
    { state: "KL", name: "Thiruvananthapuram", areas: [
      { area: "Kowdiar",        pins: ["695003"] },
      { area: "Vanchiyoor",     pins: ["695035"] },
    ]},
    { state: "KL", name: "Kochi", areas: [
      { area: "Ernakulam",      pins: ["682011"] },
      { area: "Kakkanad",       pins: ["682030"] },
      { area: "Edappally",      pins: ["682024"] },
      { area: "Aluva",          pins: ["683101"] },
    ]},
    { state: "KL", name: "Kozhikode", areas: [
      { area: "Calicut Town",   pins: ["673001"] },
    ]},

    // ── WEST BENGAL ───────────────────────────────────────────────────────
    { state: "WB", name: "Kolkata", areas: [
      { area: "Park Street",    pins: ["700016"] },
      { area: "Salt Lake",      pins: ["700091"] },
      { area: "New Town",       pins: ["700156"] },
      { area: "Howrah",         pins: ["711101"] },
      { area: "Gariahat",       pins: ["700029"] },
      { area: "Jadavpur",       pins: ["700032"] },
    ]},
    { state: "WB", name: "Asansol", areas: [
      { area: "Court Road",     pins: ["713301"] },
    ]},
    { state: "WB", name: "Siliguri", areas: [
      { area: "Sevoke Road",    pins: ["734001"] },
    ]},

    // ── GUJARAT ───────────────────────────────────────────────────────────
    { state: "GJ", name: "Ahmedabad", areas: [
      { area: "CG Road",        pins: ["380006"] },
      { area: "Navrangpura",    pins: ["380009"] },
      { area: "Vastrapur",      pins: ["380015"] },
      { area: "Bopal",          pins: ["380058"] },
      { area: "Maninagar",      pins: ["380008"] },
      { area: "SG Highway",     pins: ["380051"] },
      { area: "Prahlad Nagar",  pins: ["380015"] },
    ]},
    { state: "GJ", name: "Surat", areas: [
      { area: "Athwa Lines",    pins: ["395001"] },
      { area: "Vesu",           pins: ["395007"] },
      { area: "Adajan",         pins: ["395009"] },
    ]},
    { state: "GJ", name: "Vadodara", areas: [
      { area: "Alkapuri",       pins: ["390007"] },
      { area: "Fatehgunj",      pins: ["390002"] },
    ]},
    { state: "GJ", name: "Rajkot", areas: [
      { area: "Kotecha Chowk",  pins: ["360001"] },
    ]},

    // ── RAJASTHAN ─────────────────────────────────────────────────────────
    { state: "RJ", name: "Jaipur", areas: [
      { area: "C Scheme",       pins: ["302001"] },
      { area: "Malviya Nagar",  pins: ["302017"] },
      { area: "Vaishali Nagar", pins: ["302021"] },
      { area: "Mansarovar",     pins: ["302020"] },
      { area: "Tonk Road",      pins: ["302018"] },
    ]},
    { state: "RJ", name: "Jodhpur", areas: [
      { area: "Sardarpura",     pins: ["342001"] },
      { area: "Ratanada",       pins: ["342001"] },
    ]},
    { state: "RJ", name: "Udaipur", areas: [
      { area: "Hiran Magri",    pins: ["313001"] },
    ]},
    { state: "RJ", name: "Kota", areas: [
      { area: "Talwandi",       pins: ["324005"] },
    ]},

    // ── MADHYA PRADESH ────────────────────────────────────────────────────
    { state: "MP", name: "Bhopal", areas: [
      { area: "MP Nagar",       pins: ["462011"] },
      { area: "Arera Colony",   pins: ["462016"] },
      { area: "New Market",     pins: ["462003"] },
      { area: "Kolar Road",     pins: ["462042"] },
    ]},
    { state: "MP", name: "Indore", areas: [
      { area: "Vijay Nagar",    pins: ["452010"] },
      { area: "MG Road",        pins: ["452001"] },
      { area: "Palasia",        pins: ["452001"] },
      { area: "Scheme 78",      pins: ["452010"] },
    ]},
    { state: "MP", name: "Gwalior", areas: [
      { area: "Lashkar",        pins: ["474001"] },
    ]},
    { state: "MP", name: "Jabalpur", areas: [
      { area: "Napier Town",    pins: ["482001"] },
    ]},

    // ── BIHAR ─────────────────────────────────────────────────────────────
    { state: "BR", name: "Patna", areas: [
      { area: "Bailey Road",    pins: ["800014"] },
      { area: "Boring Road",    pins: ["800001"] },
      { area: "Kankarbagh",     pins: ["800020"] },
      { area: "Rajendra Nagar", pins: ["800016"] },
      { area: "Patliputra",     pins: ["800013"] },
    ]},
    { state: "BR", name: "Gaya", areas: [
      { area: "Civil Lines",    pins: ["823001"] },
    ]},
    { state: "BR", name: "Muzaffarpur", areas: [
      { area: "Brahmpura",      pins: ["842001"] },
    ]},

    // ── HARYANA ───────────────────────────────────────────────────────────
    { state: "HR", name: "Gurugram", areas: [
      { area: "DLF Cyber City", pins: ["122002"] },
      { area: "Sohna Road",     pins: ["122018"] },
      { area: "MG Road",        pins: ["122001"] },
      { area: "Sector 56",      pins: ["122003"] },
      { area: "Golf Course Road", pins: ["122010"] },
    ]},
    { state: "HR", name: "Faridabad", areas: [
      { area: "Sector 15",      pins: ["121007"] },
      { area: "NIT",            pins: ["121001"] },
    ]},
    { state: "HR", name: "Ambala", areas: [
      { area: "Ambala City",    pins: ["134003"] },
      { area: "Ambala Cantt",   pins: ["133001"] },
    ]},

    // ── PUNJAB ────────────────────────────────────────────────────────────
    { state: "PB", name: "Ludhiana", areas: [
      { area: "Model Town",     pins: ["141002"] },
      { area: "Sarabha Nagar",  pins: ["141001"] },
    ]},
    { state: "PB", name: "Amritsar", areas: [
      { area: "Lawrence Road",  pins: ["143001"] },
      { area: "Ranjit Avenue",  pins: ["143001"] },
    ]},
    { state: "PB", name: "Chandigarh (PB)", areas: [
      { area: "Sector 17",      pins: ["160017"] },
      { area: "Sector 22",      pins: ["160022"] },
    ]},

    // ── CHANDIGARH UT ─────────────────────────────────────────────────────
    { state: "CH", name: "Chandigarh", areas: [
      { area: "Sector 17",      pins: ["160017"] },
      { area: "Sector 22",      pins: ["160022"] },
      { area: "Sector 35",      pins: ["160035"] },
      { area: "Mohali",         pins: ["160059"] },
    ]},

    // ── UTTARAKHAND ───────────────────────────────────────────────────────
    { state: "UK", name: "Dehradun", areas: [
      { area: "Rajpur Road",    pins: ["248001"] },
      { area: "Patel Nagar",    pins: ["248001"] },
      { area: "Raipur",         pins: ["248008"] },
    ]},
    { state: "UK", name: "Haridwar", areas: [
      { area: "Upper Road",     pins: ["249401"] },
    ]},
    { state: "UK", name: "Nainital", areas: [
      { area: "Mall Road",      pins: ["263001"] },
    ]},

    // ── HIMACHAL PRADESH ──────────────────────────────────────────────────
    { state: "HP", name: "Shimla", areas: [
      { area: "Mall Road",      pins: ["171001"] },
      { area: "Sanjauli",       pins: ["171006"] },
    ]},

    // ── JHARKHAND ─────────────────────────────────────────────────────────
    { state: "JH", name: "Ranchi", areas: [
      { area: "Doranda",        pins: ["834002"] },
      { area: "Harmu",          pins: ["834002"] },
    ]},
    { state: "JH", name: "Jamshedpur", areas: [
      { area: "Bistupur",       pins: ["831001"] },
      { area: "Sakchi",         pins: ["831001"] },
    ]},

    // ── ODISHA ────────────────────────────────────────────────────────────
    { state: "OD", name: "Bhubaneswar", areas: [
      { area: "Saheed Nagar",   pins: ["751007"] },
      { area: "Nayapalli",      pins: ["751012"] },
      { area: "Patia",          pins: ["751024"] },
    ]},
    { state: "OD", name: "Cuttack", areas: [
      { area: "Bidanasi",       pins: ["753014"] },
    ]},

    // ── CHHATTISGARH ──────────────────────────────────────────────────────
    { state: "CG", name: "Raipur", areas: [
      { area: "Shankar Nagar",  pins: ["492007"] },
      { area: "Pandri",         pins: ["492001"] },
    ]},

    // ── GOA ───────────────────────────────────────────────────────────────
    { state: "GA", name: "Panaji", areas: [
      { area: "Altinho",        pins: ["403001"] },
      { area: "Campal",         pins: ["403001"] },
    ]},
    { state: "GA", name: "Vasco", areas: [
      { area: "Mormugao",       pins: ["403802"] },
    ]},

    // ── ASSAM ─────────────────────────────────────────────────────────────
    { state: "AS", name: "Guwahati", areas: [
      { area: "Dispur",         pins: ["781005"] },
      { area: "Chandmari",      pins: ["781003"] },
      { area: "Beltola",        pins: ["781028"] },
    ]},

    // ── JAMMU & KASHMIR ───────────────────────────────────────────────────
    { state: "JK", name: "Jammu", areas: [
      { area: "Gandhinagar",    pins: ["180004"] },
      { area: "Bakshi Nagar",   pins: ["180001"] },
    ]},
    { state: "JK", name: "Srinagar", areas: [
      { area: "Lal Chowk",      pins: ["190001"] },
      { area: "Jawahar Nagar",  pins: ["190011"] },
    ]},

    // ── PUDUCHERRY ────────────────────────────────────────────────────────
    { state: "PY", name: "Puducherry", areas: [
      { area: "White Town",     pins: ["605001"] },
      { area: "MG Road",        pins: ["605001"] },
    ]},
  ];

  for (const c of cityDefs) {
    if (!stateMap[c.state]) continue;
    const cityId = await upsertCity(stateMap[c.state], c.name);
    for (const a of c.areas) {
      const areaId = await upsertArea(cityId, a.area);
      for (const pin of a.pins) {
        await upsertPincode(areaId, pin);
      }
    }
  }
  console.log("  ✓ Cities, areas & pincodes seeded");

  // ─── 7. Service Categories ────────────────────────────────────────────────
  await upsertBySlug(serviceCategoriesTable, [
    { name: "Car Wash",        slug: "car-wash",        legacyCategory: "car_wash",       sortOrder: 1 },
    { name: "Detailing",       slug: "detailing",       legacyCategory: "detailing",      sortOrder: 2 },
    { name: "Ceramic Coating", slug: "ceramic-coating", legacyCategory: "ceramic_coating",sortOrder: 3 },
    { name: "PPF",             slug: "ppf",             legacyCategory: "ppf",            sortOrder: 4 },
    { name: "Interior",        slug: "interior",        legacyCategory: "interior",       sortOrder: 5 },
    { name: "Solar Cleaning",  slug: "solar-cleaning",  legacyCategory: "solar_cleaning", sortOrder: 6 },
    { name: "AMC",             slug: "amc",             legacyCategory: "amc",            sortOrder: 7 },
    { name: "Subscription",    slug: "subscription",    legacyCategory: "subscription",   sortOrder: 8 },
  ]);

  // ─── 8. Link existing services to categories & seed pricing ──────────────
  const svcCats = await db.select().from(serviceCategoriesTable);
  const svcCatMap = Object.fromEntries(svcCats.map(c => [(c as any).legacyCategory, (c as any).id]));
  const allServices = await db.select().from(servicesTable);

  for (const svc of allServices) {
    const catId = svcCatMap[svc.category];
    if (catId && !(svc as any).serviceCategoryId) {
      await db.update(servicesTable).set({ serviceCategoryId: catId }).where(eq(servicesTable.id, svc.id));
    }
  }

  // Seed car-wash pricing matrix
  const carWash = allServices.find(s => s.category === "car_wash");
  if (carWash) {
    const pricingDefs: Array<{ catSlug?: string; seatSlug: string; price: string; dur: number }> = [
      { seatSlug: "5-seater",  price: "299", dur: 45 },
      { seatSlug: "7-seater",  price: "449", dur: 60 },
      { seatSlug: "8-seater",  price: "549", dur: 70 },
      { catSlug: "luxury",     seatSlug: "5-seater", price: "799", dur: 60 },
      { catSlug: "suv",        seatSlug: "5-seater", price: "399", dur: 50 },
      { catSlug: "compact-suv",seatSlug: "5-seater", price: "349", dur: 45 },
    ];
    for (const p of pricingDefs) {
      const existing = await db.select().from(servicePricingTable)
        .where(sql`${servicePricingTable.serviceId} = ${carWash.id} AND ${servicePricingTable.seatCategoryId} = ${seatMap[p.seatSlug]} AND ${servicePricingTable.vehicleCategoryId} IS NOT DISTINCT FROM ${p.catSlug ? catMap[p.catSlug] : null}`)
        .limit(1)
        .catch(() => []);
      if (!(existing as any[])[0]) {
        await db.insert(servicePricingTable).values({
          serviceId: carWash.id,
          vehicleCategoryId: p.catSlug ? catMap[p.catSlug] : null,
          seatCategoryId: seatMap[p.seatSlug],
          price: p.price,
          durationMinutes: p.dur,
        }).catch(() => {});
      }
    }

    // Homepage subscription plans
    const plans = [
      { name: "Daily Exterior Clean",        price: "1000", months: 1,  tag: null,         hi: false, features: ["Daily exterior foam wash", "Tyre shine", "Window wipe", "Available 8–10 AM"] },
      { name: "1 Time Wash",                 price: "600",  months: 1,  tag: null,         hi: false, features: ["1 full wash/month", "Exterior foam wash", "Interior vacuum", "Glass cleaning"] },
      { name: "Daily Clean + 1 Full Wash",   price: "1300", months: 1,  tag: "POPULAR",    hi: true,  features: ["Daily exterior wash", "1 full wash/month", "Interior vacuum & polish", "Foam wash + glass clean"] },
      { name: "Daily Clean + 2 Full Washes", price: "1600", months: 1,  tag: "BEST VALUE", hi: false, features: ["Daily exterior wash", "2 full washes/month", "Interior vacuum & polish"] },
      { name: "Wash Card",                   price: "1600", months: 4,  tag: "FLEXIBLE",   hi: false, features: ["4 full washes", "4 month validity", "No monthly commitment"] },
    ];
    for (let i = 0; i < plans.length; i++) {
      const pl = plans[i];
      const ex = await db.select().from(servicePlansTable)
        .where(sql`${servicePlansTable.serviceId} = ${carWash.id} AND ${servicePlansTable.name} = ${pl.name}`)
        .limit(1);
      if (!ex[0]) {
        await db.insert(servicePlansTable).values({
          serviceId: carWash.id,
          name: pl.name,
          price: pl.price,
          durationMonths: pl.months,
          tag: pl.tag,
          isHighlighted: pl.hi,
          features: pl.features,
          sortOrder: i + 1,
        });
      }
    }
  }

  // ─── 9. Backfill vehicle_model_id on existing vehicle rows ───────────────
  await db.execute(sql`
    UPDATE vehicles v
    SET vehicle_model_id = vm.id
    FROM vehicle_models vm
    JOIN vehicle_brands vb ON vb.id = vm.brand_id
    WHERE LOWER(v.make) = LOWER(vb.name)
      AND LOWER(v.model) = LOWER(vm.name)
      AND v.vehicle_model_id IS NULL
  `);

  console.log("  ✓ Existing vehicles backfilled");
  console.log("✅ Master data seeding complete.");
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.includes("seed-master-data")
) {
  seedMasterData()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
