import "./load-env.js";
import { db } from "@workspace/db";
import {
  usersTable,
  branchesTable,
  customersTable,
  vehiclesTable,
  savedLocationsTable,
  vehicleModelsTable,
  citiesTable,
} from "@workspace/db";
import argon2 from "argon2";
import { eq, or } from "drizzle-orm";

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function ensureDemoCustomer() {
  const phone = "+919876543210";
  const rawPhone = "9876543210";
  const password = "password123";

  // 1. Find or verify branch
  const [branch] = await db.select().from(branchesTable).limit(1);
  const branchId = branch?.id ?? 1;
  const [city] = await db.select().from(citiesTable).limit(1);
  const cityId = city?.id ?? branch?.cityId ?? 1;

  // 2. Check if customer exists
  let [customer] = await db
    .select()
    .from(customersTable)
    .where(or(eq(customersTable.phone, phone), eq(customersTable.phone, rawPhone)))
    .limit(1);

  if (!customer) {
    const [inserted] = await db
      .insert(customersTable)
      .values({
        name: "Demo Customer",
        phone,
        email: "demo.customer@cwpdetailers.com",
        address: "B-12, Sigra, Varanasi, Uttar Pradesh 221002",
        city: "Varanasi",
        cityId,
        branchId,
        status: "active",
        referralCode: "CWP98765",
        loyaltyPointsBalance: 500,
        totalBookings: 2,
        totalSpend: "2499.00",
      })
      .returning();
    customer = inserted;
    console.log("Created demo customer:", customer.id);
  } else {
    await db
      .update(customersTable)
      .set({
        cityId,
        branchId,
        referralCode: customer.referralCode || "CWP98765",
        loyaltyPointsBalance: customer.loyaltyPointsBalance || 500,
      })
      .where(eq(customersTable.id, customer.id));
    console.log("Found existing demo customer:", customer.id);
  }

  // 3. Check or create user login
  let [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.phone, phone), eq(usersTable.phone, rawPhone)))
    .limit(1);

  const passwordHash = await hashPassword(password);

  if (!user) {
    const [insertedUser] = await db
      .insert(usersTable)
      .values({
        name: customer.name,
        phone,
        email: customer.email,
        passwordHash,
        role: "customer",
        branchId,
        cityId,
        customerId: customer.id,
        isActive: true,
      })
      .returning();
    user = insertedUser;
    console.log("Created demo customer user login:", user.id);
  } else {
    await db
      .update(usersTable)
      .set({
        passwordHash,
        role: "customer",
        customerId: customer.id,
        isActive: true,
        cityId,
        branchId,
      })
      .where(eq(usersTable.id, user.id));
    console.log("Updated demo customer user login:", user.id);
  }

  // Update customer userId link
  await db
    .update(customersTable)
    .set({ userId: user.id })
    .where(eq(customersTable.id, customer.id));

  // 4. Ensure demo vehicle exists
  const [existingVehicle] = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.customerId, customer.id))
    .limit(1);

  if (!existingVehicle) {
    const [model] = await db.select().from(vehicleModelsTable).limit(1);
    await db.insert(vehiclesTable).values({
      customerId: customer.id,
      make: model?.name ? "Hyundai" : "Hyundai",
      model: model?.name ?? "Creta",
      registrationNumber: "UP65AB1234",
      year: 2023,
      vehicleType: "suv",
      vehicleModelId: model?.id ?? undefined,
      serviceAddress: "B-12, Sigra, Varanasi, Uttar Pradesh 221002",
      serviceLat: 25.3176,
      serviceLng: 82.9739,
      cityId,
    });
    console.log("Created demo vehicle for customer");
  }

  // 5. Ensure saved location exists
  const [existingLocation] = await db
    .select()
    .from(savedLocationsTable)
    .where(eq(savedLocationsTable.customerId, customer.id))
    .limit(1);

  if (!existingLocation) {
    await db.insert(savedLocationsTable).values({
      customerId: customer.id,
      label: "Home",
      address: "B-12, Sigra, Varanasi, Uttar Pradesh 221002",
      latitude: 25.3176,
      longitude: 82.9739,
      cityId,
      cityName: "Varanasi",
      pincode: "221002",
      isDefault: true,
    });
    console.log("Created demo saved location for customer");
  }

  console.log("Demo customer setup complete: Phone:", phone, "Password:", password);
}

if (process.argv[1]?.endsWith("ensure-demo-customer.ts")) {
  ensureDemoCustomer()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Failed to ensure demo customer:", err);
      process.exit(1);
    });
}
