import { db } from "@workspace/db";
import {
  usersTable, branchesTable, customersTable, vehiclesTable,
  servicesTable, subscriptionsTable, staffTable, bookingsTable, attendanceTable,
  complaintsTable, invoicesTable, paymentsTable, notificationsTable,
  walletTransactionsTable,
} from "@workspace/db";
import argon2 from "argon2";
import { and, eq, sql } from "drizzle-orm";
import { seedPermissions } from "./seed-permissions";
import { seedMasterData } from "./seed-master-data";

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function getOrCreateVaranasiBranch() {
  const existing = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.city, "Varanasi"))
    .limit(1);
  if (existing[0]) return existing[0];

  const [branch] = await db
    .insert(branchesTable)
    .values({
      name: "CWP Varanasi",
      city: "Varanasi",
      address: "Lanka, Varanasi - 221005",
      phone: "0542-2500001",
      managerName: "Rajesh Kumar",
    })
    .returning();
  return branch;
}

async function getOrCreateService(input: {
  name: string;
  description: string;
  category: string;
  basePrice: string;
  durationMinutes: number;
  features: string[];
}) {
  const existing = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.name, input.name))
    .limit(1);
  if (existing[0]) return existing[0];

  const [service] = await db.insert(servicesTable).values(input).returning();
  return service;
}

async function getOrCreateCustomer(input: {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  branchId: number;
  walletBalance?: string;
  totalDues?: string;
}) {
  const existing = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.phone, input.phone), eq(customersTable.branchId, input.branchId)))
    .limit(1);
  if (existing[0]) {
    const [updated] = await db
      .update(customersTable)
      .set({
        name: input.name,
        email: input.email,
        address: input.address,
        city: input.city,
        walletBalance: input.walletBalance ?? existing[0].walletBalance,
        totalDues: input.totalDues ?? existing[0].totalDues,
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, existing[0].id))
      .returning();
    return updated;
  }

  const [customer] = await db
    .insert(customersTable)
    .values({
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      city: input.city,
      branchId: input.branchId,
      walletBalance: input.walletBalance ?? "0",
      totalDues: input.totalDues ?? "0",
    })
    .returning();
  return customer;
}

async function getOrCreateStaff(input: {
  name: string;
  phone: string;
  email: string;
  role: "technician" | "supervisor" | "driver" | "solar_technician";
  branchId: number;
  monthlySalary: string;
  joiningDate: string;
}) {
  const existing = await db
    .select()
    .from(staffTable)
    .where(and(eq(staffTable.phone, input.phone), eq(staffTable.branchId, input.branchId)))
    .limit(1);
  if (existing[0]) {
    const [updated] = await db
      .update(staffTable)
      .set({
        name: input.name,
        email: input.email,
        role: input.role,
        verificationStatus: "verified",
        verifiedAt: existing[0].verifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staffTable.id, existing[0].id))
      .returning();
    return updated;
  }

  const [staff] = await db
    .insert(staffTable)
    .values({
      ...input,
      verificationStatus: "verified",
      verifiedAt: new Date(),
    })
    .returning();
  return staff;
}

async function upsertUser(input: {
  name: string;
  phone: string;
  email: string | null;
  passwordHash: string;
  role: "admin" | "customer" | "staff";
  branchId: number;
  customerId?: number | null;
  staffId?: number | null;
}) {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, input.phone))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(usersTable)
      .set({
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        branchId: input.branchId,
        customerId: input.customerId ?? null,
        staffId: input.staffId ?? null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing[0].id))
      .returning();
    return updated;
  }

  const [user] = await db.insert(usersTable).values(input).returning();
  return user;
}

async function getOrCreateVehicle(input: {
  customerId: number;
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  vehicleType: string;
}) {
  const existing = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.registrationNumber, input.registrationNumber))
    .limit(1);
  if (existing[0]) return existing[0];

  const [vehicle] = await db.insert(vehiclesTable).values(input).returning();
  return vehicle;
}

/**
 * Idempotent Varanasi pilot seed — safe to re-run on an existing dev database.
 */
async function seedWalletLedger() {
  const customers = await db.select().from(customersTable);
  for (const c of customers) {
    const bal = parseFloat(c.walletBalance);
    if (bal <= 0) continue;
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.customerId, c.id));
    if (Number(row?.count ?? 0) > 0) continue;

    await db.insert(walletTransactionsTable).values({
      customerId: c.id,
      companyId: c.companyId,
      type: "credit",
      amount: bal.toFixed(2),
      balanceAfter: bal.toFixed(2),
      reference: "wallet_recharge",
      paymentMode: "cash",
      notes: "Opening balance (seed migration)",
    });
    console.log(`Wallet ledger seeded for customer ${c.id} (₹${bal})`);
  }
}

async function seed() {
  console.log("Seeding Varanasi pilot database (idempotent)...");

  const varanasi = await getOrCreateVaranasiBranch();
  console.log(`Branch: ${varanasi.name} (id=${varanasi.id})`);

  const basicWash = await getOrCreateService({
    name: "Basic Car Wash",
    description: "Exterior wash with foam, rinse, and dry.",
    category: "car_wash",
    basePrice: "299",
    durationMinutes: 45,
    features: ["Foam wash", "Rinse & dry", "Tire cleaning"],
  });
  const premiumWash = await getOrCreateService({
    name: "Premium Car Wash",
    description: "Full exterior wash with wax polish and interior vacuum.",
    category: "car_wash",
    basePrice: "599",
    durationMinutes: 90,
    features: ["Foam wash", "Premium wax", "Interior vacuum"],
  });
  await getOrCreateService({
    name: "Interior Detailing",
    description: "Deep interior cleaning with steam and shampoo.",
    category: "detailing",
    basePrice: "2499",
    durationMinutes: 240,
    features: ["Steam cleaning", "Carpet shampoo", "Leather conditioning"],
  });
  await getOrCreateService({
    name: "Solar Panel Cleaning",
    description: "Professional solar panel cleaning.",
    category: "solar_cleaning",
    basePrice: "1499",
    durationMinutes: 120,
    features: ["Soft brush cleaning", "DM water rinse"],
  });
  await getOrCreateService({
    name: "Solar AMC (Annual)",
    description: "Annual maintenance contract for solar panels.",
    category: "amc",
    basePrice: "14999",
    durationMinutes: 120,
    features: ["12 cleanings/year", "Priority scheduling"],
  });
  console.log("Services ready");

  const arjun = await getOrCreateCustomer({
    name: "Arjun Sharma",
    phone: "9001001001",
    email: "arjun@gmail.com",
    address: "Lanka, Varanasi",
    city: "Varanasi",
    branchId: varanasi.id,
    walletBalance: "500",
    totalDues: "0",
  });
  const sunita = await getOrCreateCustomer({
    name: "Sunita Patel",
    phone: "9001001002",
    email: "sunita@gmail.com",
    address: "Sigra, Varanasi",
    city: "Varanasi",
    branchId: varanasi.id,
    walletBalance: "0",
    totalDues: "2499",
  });
  const rohit = await getOrCreateCustomer({
    name: "Rohit Agarwal",
    phone: "9001001005",
    email: "rohit@gmail.com",
    address: "BHU Campus, Varanasi",
    city: "Varanasi",
    branchId: varanasi.id,
    walletBalance: "2000",
    totalDues: "0",
  });

  const ravi = await getOrCreateStaff({
    name: "Ravi Kumar",
    phone: "9011001001",
    email: "ravi@cwp.com",
    role: "technician",
    branchId: varanasi.id,
    monthlySalary: "18000",
    joiningDate: "2023-06-01",
  });
  const suresh = await getOrCreateStaff({
    name: "Suresh Yadav",
    phone: "9011001002",
    email: "suresh@cwp.com",
    role: "technician",
    branchId: varanasi.id,
    monthlySalary: "18000",
    joiningDate: "2023-08-15",
  });

  const adminHash = await hashPassword("admin123");
  const customerHash = await hashPassword("customer123");
  const staffHash = await hashPassword("staff123");

  const adminUser = await upsertUser({
    name: "Admin CWP",
    phone: "9999999999",
    email: "admin@cwpdetailers.com",
    passwordHash: adminHash,
    role: "admin",
    branchId: varanasi.id,
  });

  const arjunUser = await upsertUser({
    name: arjun.name,
    phone: arjun.phone,
    email: arjun.email,
    passwordHash: customerHash,
    role: "customer",
    branchId: varanasi.id,
    customerId: arjun.id,
  });
  const sunitaUser = await upsertUser({
    name: sunita.name,
    phone: sunita.phone,
    email: sunita.email,
    passwordHash: customerHash,
    role: "customer",
    branchId: varanasi.id,
    customerId: sunita.id,
  });
  const rohitUser = await upsertUser({
    name: rohit.name,
    phone: rohit.phone,
    email: rohit.email,
    passwordHash: customerHash,
    role: "customer",
    branchId: varanasi.id,
    customerId: rohit.id,
  });

  const raviUser = await upsertUser({
    name: ravi.name,
    phone: ravi.phone,
    email: ravi.email,
    passwordHash: staffHash,
    role: "staff",
    branchId: varanasi.id,
    staffId: ravi.id,
  });
  const sureshUser = await upsertUser({
    name: suresh.name,
    phone: suresh.phone,
    email: suresh.email,
    passwordHash: staffHash,
    role: "staff",
    branchId: varanasi.id,
    staffId: suresh.id,
  });

  await db.update(customersTable).set({ userId: arjunUser.id, updatedAt: new Date() }).where(eq(customersTable.id, arjun.id));
  await db.update(customersTable).set({ userId: sunitaUser.id, updatedAt: new Date() }).where(eq(customersTable.id, sunita.id));
  await db.update(customersTable).set({ userId: rohitUser.id, updatedAt: new Date() }).where(eq(customersTable.id, rohit.id));
  await db.update(staffTable).set({ userId: raviUser.id, updatedAt: new Date() }).where(eq(staffTable.id, ravi.id));
  await db.update(staffTable).set({ userId: sureshUser.id, updatedAt: new Date() }).where(eq(staffTable.id, suresh.id));

  console.log("Pilot accounts linked");

  const v1 = await getOrCreateVehicle({
    customerId: arjun.id,
    make: "Maruti",
    model: "Swift",
    year: 2021,
    color: "Red",
    registrationNumber: "UP65AA1234",
    vehicleType: "hatchback",
  });
  const v2 = await getOrCreateVehicle({
    customerId: arjun.id,
    make: "Honda",
    model: "City",
    year: 2022,
    color: "White",
    registrationNumber: "UP65AB5678",
    vehicleType: "sedan",
  });
  const v3 = await getOrCreateVehicle({
    customerId: sunita.id,
    make: "Hyundai",
    model: "Creta",
    year: 2023,
    color: "Black",
    registrationNumber: "UP65AC9012",
    vehicleType: "suv",
  });
  const v4 = await getOrCreateVehicle({
    customerId: rohit.id,
    make: "BMW",
    model: "3 Series",
    year: 2023,
    color: "Silver",
    registrationNumber: "UP65GH2345",
    vehicleType: "luxury",
  });

  await db.update(vehiclesTable).set({ assignedStaffId: ravi.id }).where(eq(vehiclesTable.id, v1.id));
  await db.update(vehiclesTable).set({ assignedStaffId: ravi.id }).where(eq(vehiclesTable.id, v2.id));
  await db.update(vehiclesTable).set({ assignedStaffId: suresh.id }).where(eq(vehiclesTable.id, v4.id));

  const today = new Date().toISOString().split("T")[0];
  const endDate90 = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
  const endDate30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [{ count: bookingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(eq(bookingsTable.branchId, varanasi.id));

  if (bookingCount === 0) {
    await db.insert(subscriptionsTable).values([
      { customerId: arjun.id, vehicleId: v1.id, serviceId: basicWash.id, type: "daily_wash", status: "active", startDate: today, endDate: endDate90, frequencyDays: 1, price: "8999", dailyRate: "300", paidAmount: "8999", dueAmount: "0", nextServiceDate: today, branchId: varanasi.id },
      { customerId: sunita.id, vehicleId: v3.id, serviceId: premiumWash.id, type: "monthly_wash", status: "active", startDate: today, endDate: endDate30, frequencyDays: 7, price: "2499", paidAmount: "0", dueAmount: "2499", nextServiceDate: today, branchId: varanasi.id },
      { customerId: rohit.id, vehicleId: v4.id, serviceId: basicWash.id, type: "daily_wash", status: "active", startDate: today, endDate: endDate30, frequencyDays: 1, price: "999", dailyRate: "33.30", paidAmount: "999", dueAmount: "0", nextServiceDate: today, branchId: varanasi.id },
    ]);

    await db.insert(bookingsTable).values([
      { customerId: arjun.id, vehicleId: v1.id, serviceId: basicWash.id, staffId: ravi.id, branchId: varanasi.id, scheduledDate: today, scheduledTime: "09:00", status: "scheduled", serviceType: "car_wash", amount: "299" },
      { customerId: sunita.id, vehicleId: v3.id, serviceId: premiumWash.id, staffId: suresh.id, branchId: varanasi.id, scheduledDate: today, scheduledTime: "10:30", status: "in_progress", serviceType: "car_wash", amount: "599" },
      { customerId: arjun.id, vehicleId: v2.id, serviceId: premiumWash.id, staffId: ravi.id, branchId: varanasi.id, scheduledDate: yesterday, scheduledTime: "16:00", status: "completed", serviceType: "car_wash", amount: "599", rating: 5, completedAt: new Date(Date.now() - 64800000) },
      { customerId: rohit.id, vehicleId: v4.id, serviceId: basicWash.id, staffId: suresh.id, branchId: varanasi.id, scheduledDate: tomorrow, scheduledTime: "11:00", status: "confirmed", serviceType: "car_wash", amount: "299" },
    ]);

    await db.insert(attendanceTable).values([
      { staffId: ravi.id, date: yesterday, status: "present", checkInTime: "09:00", checkOutTime: "18:00" },
      { staffId: suresh.id, date: yesterday, status: "present", checkInTime: "09:05", checkOutTime: "18:15" },
      { staffId: ravi.id, date: today, status: "present", checkInTime: "09:00" },
      { staffId: suresh.id, date: today, status: "present", checkInTime: "09:10" },
    ]);

    await db.insert(complaintsTable).values([
      { customerId: sunita.id, type: "quality", title: "Missed interior cleaning", description: "Dashboard was not cleaned properly.", status: "open", priority: "medium" },
      { customerId: arjun.id, type: "reclean", title: "Water spots on car body", description: "Water spots appeared after wash.", status: "open", priority: "low" },
    ]);

    const existingInv = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.invoiceNumber, "CWP-2026-1001"))
      .limit(1);

    if (!existingInv[0]) {
      const [inv1] = await db.insert(invoicesTable).values({
        invoiceNumber: "CWP-2026-1001",
        customerId: arjun.id,
        items: [{ description: "Daily Wash Subscription (3 months)", quantity: 1, unitPrice: 8999, total: 8999 }],
        subtotal: "8999", tax: "0", discount: "0", totalAmount: "8999", paidAmount: "8999", dueAmount: "0",
        status: "paid", issuedAt: new Date(Date.now() - 7 * 86400000), paidAt: new Date(Date.now() - 7 * 86400000),
      }).returning();

      await db.insert(invoicesTable).values({
        invoiceNumber: "CWP-2026-1002",
        customerId: sunita.id,
        items: [{ description: "Monthly Wash Subscription", quantity: 1, unitPrice: 2499, total: 2499 }],
        subtotal: "2499", tax: "0", discount: "0", totalAmount: "2499", paidAmount: "0", dueAmount: "2499",
        status: "sent", issuedAt: new Date(Date.now() - 3 * 86400000),
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      });

      await db.insert(paymentsTable).values([
        { customerId: arjun.id, invoiceId: inv1.id, amount: "8999", method: "upi", transactionId: "TXN20260430001", status: "completed" },
      ]);
    }

    console.log("Demo bookings and billing seeded");
  } else {
    console.log(`Skipping demo data (${bookingCount} bookings already exist for Varanasi)`);
  }

  const existingNotice = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.title, "Varanasi pilot ready"))
    .limit(1);
  if (!existingNotice[0]) {
    await db.insert(notificationsTable).values({
      userId: adminUser.id,
      title: "Varanasi pilot ready",
      message: "Pilot seed complete. Use admin login to manage operations.",
      type: "broadcast",
      channel: "in_app",
    });
  }

  await seedPermissions();
  await seedMasterData();
  await seedWalletLedger();

  console.log("\n✅ Varanasi pilot seed complete.\n");
  console.log("Admin:     phone 9999999999  password admin123");
  console.log("Customer:  phone 9001001001  password customer123  (Arjun Sharma)");
  console.log("Customer:  phone 9001001002  password customer123  (Sunita Patel)");
  console.log("Customer:  phone 9001001005  password customer123  (Rohit Agarwal)");
  console.log("Staff:     phone 9011001001  password staff123     (Ravi Kumar)");
  console.log("Staff:     phone 9011001002  password staff123     (Suresh Yadav)");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
