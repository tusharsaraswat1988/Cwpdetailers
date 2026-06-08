import { db } from "@workspace/db";
import {
  usersTable, branchesTable, customersTable, vehiclesTable, solarSitesTable,
  servicesTable, subscriptionsTable, staffTable, bookingsTable, attendanceTable,
  complaintsTable, invoicesTable, paymentsTable, notificationsTable
} from "@workspace/db";
import crypto from "crypto";

function hash(p: string) {
  return crypto.createHash("sha256").update(p + "cwp_salt").digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  // Branches
  const [varanasi, lucknow, kanpur] = await db.insert(branchesTable).values([
    { name: "CWP Varanasi", city: "Varanasi", address: "Lanka, Varanasi - 221005", phone: "0542-2500001", managerName: "Rajesh Kumar" },
    { name: "CWP Lucknow", city: "Lucknow", address: "Hazratganj, Lucknow - 226001", phone: "0522-3000001", managerName: "Priya Singh" },
    { name: "CWP Kanpur", city: "Kanpur", address: "Civil Lines, Kanpur - 208001", phone: "0512-2000001", managerName: "Amit Gupta" },
  ]).returning();

  console.log("Branches created");

  // Admin user
  await db.insert(usersTable).values([
    { name: "Admin CWP", phone: "9999999999", email: "admin@cwpdetailers.com", passwordHash: hash("admin123"), role: "admin", branchId: varanasi.id },
    { name: "Rajesh Kumar", phone: "9876543210", email: "rajesh@cwpdetailers.com", passwordHash: hash("staff123"), role: "staff", branchId: varanasi.id },
    { name: "Priya Singh", phone: "9876543211", email: "priya@cwpdetailers.com", passwordHash: hash("staff123"), role: "staff", branchId: lucknow.id },
  ]);

  // Services
  const [basicWash, premiumWash, interiorDetailing, ceramicCoating, ppf, solarClean, solarAmc, dailyWashSub, monthlyWashSub] = await db.insert(servicesTable).values([
    { name: "Basic Car Wash", description: "Exterior wash with foam, rinse, and dry. Includes tire cleaning.", category: "car_wash", basePrice: "299", durationMinutes: 45, features: ["Foam wash", "Rinse & dry", "Tire cleaning", "Window wipe"] },
    { name: "Premium Car Wash", description: "Full exterior wash with wax polish and interior vacuum.", category: "car_wash", basePrice: "599", durationMinutes: 90, features: ["Foam wash", "Premium wax", "Interior vacuum", "Dashboard wipe", "Air freshener"] },
    { name: "Interior Detailing", description: "Deep interior cleaning with steam, shampoo, and leather conditioning.", category: "detailing", basePrice: "2499", durationMinutes: 240, features: ["Steam cleaning", "Carpet shampoo", "Leather conditioning", "Odor removal", "Dashboard polish"] },
    { name: "Full Car Detailing", description: "Complete exterior + interior detailing for showroom-quality finish.", category: "detailing", basePrice: "4999", durationMinutes: 360, features: ["Exterior clay bar", "Machine polish", "Interior steam", "Leather care", "Tyre shine", "Engine bay clean"] },
    { name: "Ceramic Coating (Entry)", description: "1-year SiO2 ceramic coating for lasting paint protection.", category: "ceramic_coating", basePrice: "12999", durationMinutes: 480, features: ["SiO2 coating", "1-year protection", "UV resistance", "Hydrophobic layer", "Polish before coat"] },
    { name: "Ceramic Coating (Pro)", description: "3-year professional ceramic coating with graphene top layer.", category: "ceramic_coating", basePrice: "24999", durationMinutes: 600, features: ["Graphene + SiO2", "3-year warranty", "Self-healing properties", "Deep paint correction", "10H hardness"] },
    { name: "PPF Installation", description: "Paint Protection Film for hoods, bumpers, and high-impact areas.", category: "ppf", basePrice: "19999", durationMinutes: 720, features: ["Self-healing film", "UV protection", "Rock chip resistance", "Invisible finish", "5-year warranty"] },
    { name: "Solar Panel Cleaning", description: "Professional solar panel cleaning to restore peak efficiency.", category: "solar_cleaning", basePrice: "1499", durationMinutes: 120, features: ["Soft brush cleaning", "DM water rinse", "Panel inspection", "Efficiency report"] },
    { name: "Solar AMC (Annual)", description: "Annual maintenance contract for solar panels with 12 cleanings.", category: "amc", basePrice: "14999", durationMinutes: 120, features: ["12 cleanings/year", "Monthly service", "Priority scheduling", "Free inspections", "WhatsApp support"] },
  ]).returning();

  console.log("Services created");

  // Customers
  const customers = await db.insert(customersTable).values([
    { name: "Arjun Sharma", phone: "9001001001", email: "arjun@gmail.com", address: "Lanka, Varanasi", city: "Varanasi", branchId: varanasi.id, walletBalance: "500", totalDues: "0" },
    { name: "Sunita Patel", phone: "9001001002", email: "sunita@gmail.com", address: "Sigra, Varanasi", city: "Varanasi", branchId: varanasi.id, walletBalance: "0", totalDues: "2499" },
    { name: "Vikram Singh", phone: "9001001003", email: "vikram@gmail.com", address: "Hazratganj, Lucknow", city: "Lucknow", branchId: lucknow.id, walletBalance: "1000", totalDues: "0" },
    { name: "Kavita Mishra", phone: "9001001004", email: "kavita@gmail.com", address: "Civil Lines, Kanpur", city: "Kanpur", branchId: kanpur.id, walletBalance: "0", totalDues: "4999" },
    { name: "Rohit Agarwal", phone: "9001001005", email: "rohit@gmail.com", address: "BHU Campus, Varanasi", city: "Varanasi", branchId: varanasi.id, walletBalance: "2000", totalDues: "0" },
    { name: "Meena Gupta", phone: "9001001006", email: "meena@gmail.com", address: "Assi Ghat, Varanasi", city: "Varanasi", branchId: varanasi.id, walletBalance: "0", totalDues: "14999" },
    { name: "Deepak Yadav", phone: "9001001007", email: "deepak@gmail.com", address: "Alambagh, Lucknow", city: "Lucknow", branchId: lucknow.id, walletBalance: "750", totalDues: "0" },
    { name: "Anita Srivastava", phone: "9001001008", email: "anita@gmail.com", address: "Kakadeo, Kanpur", city: "Kanpur", branchId: kanpur.id, walletBalance: "0", totalDues: "0" },
    { name: "Sanjay Tripathi", phone: "9001001009", email: "sanjay@gmail.com", address: "Rathyatra, Varanasi", city: "Varanasi", branchId: varanasi.id, walletBalance: "300", totalDues: "599" },
    { name: "Pooja Chauhan", phone: "9001001010", email: "pooja@gmail.com", address: "Indira Nagar, Lucknow", city: "Lucknow", branchId: lucknow.id, walletBalance: "1500", totalDues: "0" },
    { name: "Ramesh Verma", phone: "9001001011", email: "ramesh@gmail.com", address: "Cantonment, Kanpur", city: "Kanpur", branchId: kanpur.id, walletBalance: "0", totalDues: "1499" },
    { name: "Geeta Tiwari", phone: "9001001012", email: "geeta@gmail.com", address: "Nadesar, Varanasi", city: "Varanasi", branchId: varanasi.id, walletBalance: "800", totalDues: "0" },
  ]).returning();

  console.log("Customers created");

  // Vehicles
  await db.insert(vehiclesTable).values([
    { customerId: customers[0].id, make: "Maruti", model: "Swift", year: 2021, color: "Red", registrationNumber: "UP65AA1234", vehicleType: "hatchback" },
    { customerId: customers[0].id, make: "Honda", model: "City", year: 2022, color: "White", registrationNumber: "UP65AB5678", vehicleType: "sedan" },
    { customerId: customers[1].id, make: "Hyundai", model: "Creta", year: 2023, color: "Black", registrationNumber: "UP65AC9012", vehicleType: "suv" },
    { customerId: customers[2].id, make: "Tata", model: "Nexon", year: 2022, color: "Blue", registrationNumber: "UP32CD3456", vehicleType: "suv" },
    { customerId: customers[3].id, make: "Toyota", model: "Fortuner", year: 2021, color: "White", registrationNumber: "UP78EF7890", vehicleType: "suv" },
    { customerId: customers[4].id, make: "BMW", model: "3 Series", year: 2023, color: "Silver", registrationNumber: "UP65GH2345", vehicleType: "luxury" },
    { customerId: customers[5].id, make: "Mercedes", model: "C-Class", year: 2022, color: "Black", registrationNumber: "UP65IJ6789", vehicleType: "luxury" },
    { customerId: customers[6].id, make: "Kia", model: "Seltos", year: 2023, color: "Grey", registrationNumber: "UP32KL1234", vehicleType: "suv" },
    { customerId: customers[7].id, make: "Mahindra", model: "Scorpio N", year: 2023, color: "Red", registrationNumber: "UP78MN5678", vehicleType: "suv" },
    { customerId: customers[8].id, make: "Maruti", model: "Dzire", year: 2020, color: "White", registrationNumber: "UP65OP9012", vehicleType: "sedan" },
    { customerId: customers[9].id, make: "Volkswagen", model: "Polo", year: 2021, color: "Blue", registrationNumber: "UP32QR3456", vehicleType: "hatchback" },
    { customerId: customers[11].id, make: "Skoda", model: "Octavia", year: 2022, color: "Black", registrationNumber: "UP65ST7890", vehicleType: "sedan" },
  ]);

  // Solar sites
  await db.insert(solarSitesTable).values([
    { customerId: customers[5].id, address: "Assi Ghat, Varanasi", city: "Varanasi", panelCount: 20, panelCapacityKw: "10.00", nextServiceDate: "2026-05-15" },
    { customerId: customers[3].id, address: "Civil Lines, Kanpur", city: "Kanpur", panelCount: 12, panelCapacityKw: "6.00", nextServiceDate: "2026-05-20" },
    { customerId: customers[9].id, address: "Indira Nagar, Lucknow", city: "Lucknow", panelCount: 16, panelCapacityKw: "8.00", nextServiceDate: "2026-06-01" },
    { customerId: customers[10].id, address: "Cantonment, Kanpur", city: "Kanpur", panelCount: 8, panelCapacityKw: "4.00", nextServiceDate: "2026-05-25" },
  ]);

  console.log("Vehicles & solar sites created");

  // Staff
  const staffMembers = await db.insert(staffTable).values([
    { name: "Ravi Kumar", phone: "9011001001", email: "ravi@cwp.com", role: "technician", branchId: varanasi.id, monthlySalary: "18000", joiningDate: "2023-06-01" },
    { name: "Suresh Yadav", phone: "9011001002", email: "suresh@cwp.com", role: "technician", branchId: varanasi.id, monthlySalary: "18000", joiningDate: "2023-08-15" },
    { name: "Manoj Pandey", phone: "9011001003", email: "manoj@cwp.com", role: "supervisor", branchId: varanasi.id, monthlySalary: "25000", joiningDate: "2022-10-01" },
    { name: "Arun Gupta", phone: "9011001004", email: "arun@cwp.com", role: "driver", branchId: varanasi.id, monthlySalary: "15000", joiningDate: "2024-01-10" },
    { name: "Ashok Singh", phone: "9011001005", email: "ashok@cwp.com", role: "solar_technician", branchId: varanasi.id, monthlySalary: "22000", joiningDate: "2023-03-20" },
    { name: "Preetam Shah", phone: "9011001006", email: "preetam@cwp.com", role: "technician", branchId: lucknow.id, monthlySalary: "18000", joiningDate: "2024-02-01" },
    { name: "Dinesh Verma", phone: "9011001007", email: "dinesh@cwp.com", role: "supervisor", branchId: lucknow.id, monthlySalary: "25000", joiningDate: "2022-11-15" },
    { name: "Sonu Patel", phone: "9011001008", email: "sonu@cwp.com", role: "solar_technician", branchId: kanpur.id, monthlySalary: "22000", joiningDate: "2023-07-01" },
  ]).returning();

  console.log("Staff created");

  // Subscriptions
  const today = new Date().toISOString().split('T')[0];
  const endDate90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
  const endDate30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const endDate7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  await db.insert(subscriptionsTable).values([
    { customerId: customers[0].id, serviceId: basicWash.id, type: "daily_wash", status: "active", startDate: today, endDate: endDate90, frequencyDays: 1, price: "8999", paidAmount: "8999", dueAmount: "0", nextServiceDate: today, branchId: varanasi.id },
    { customerId: customers[1].id, serviceId: premiumWash.id, type: "monthly_wash", status: "active", startDate: today, endDate: endDate30, frequencyDays: 7, price: "2499", paidAmount: "0", dueAmount: "2499", nextServiceDate: today, branchId: varanasi.id },
    { customerId: customers[5].id, serviceId: solarAmc.id, type: "solar_amc", status: "active", startDate: "2026-01-01", endDate: "2026-12-31", frequencyDays: 30, price: "14999", paidAmount: "0", dueAmount: "14999", nextServiceDate: "2026-05-15", branchId: varanasi.id },
    { customerId: customers[2].id, serviceId: premiumWash.id, type: "monthly_wash", status: "active", startDate: today, endDate: endDate30, frequencyDays: 7, price: "2499", paidAmount: "2499", dueAmount: "0", nextServiceDate: today, branchId: lucknow.id },
    { customerId: customers[4].id, serviceId: basicWash.id, type: "daily_wash", status: "active", startDate: today, endDate: endDate7, frequencyDays: 1, price: "999", paidAmount: "999", dueAmount: "0", nextServiceDate: today, branchId: varanasi.id },
    { customerId: customers[9].id, serviceId: solarAmc.id, type: "solar_amc", status: "active", startDate: "2026-02-01", endDate: "2027-01-31", frequencyDays: 30, price: "14999", paidAmount: "14999", dueAmount: "0", nextServiceDate: "2026-06-01", branchId: lucknow.id },
  ]);

  console.log("Subscriptions created");

  // Bookings
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const twoDaysLater = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  await db.insert(bookingsTable).values([
    { customerId: customers[0].id, vehicleId: 1, serviceId: basicWash.id, staffId: staffMembers[0].id, branchId: varanasi.id, scheduledDate: today, scheduledTime: "09:00", status: "confirmed", serviceType: "car_wash", amount: "299" },
    { customerId: customers[1].id, vehicleId: 3, serviceId: premiumWash.id, staffId: staffMembers[1].id, branchId: varanasi.id, scheduledDate: today, scheduledTime: "10:30", status: "in_progress", serviceType: "car_wash", amount: "599" },
    { customerId: customers[2].id, vehicleId: 4, serviceId: interiorDetailing.id, staffId: staffMembers[0].id, branchId: lucknow.id, scheduledDate: today, scheduledTime: "11:00", status: "pending", serviceType: "detailing", amount: "2499" },
    { customerId: customers[3].id, vehicleId: 5, serviceId: ceramicCoating.id, staffId: staffMembers[2].id, branchId: kanpur.id, scheduledDate: tomorrow, scheduledTime: "09:00", status: "confirmed", serviceType: "detailing", amount: "12999" },
    { customerId: customers[4].id, vehicleId: 6, serviceId: basicWash.id, staffId: staffMembers[0].id, branchId: varanasi.id, scheduledDate: yesterday, scheduledTime: "08:00", status: "completed", serviceType: "car_wash", amount: "299", rating: 5, technicianNotes: "Customer satisfied, car looks great", completedAt: new Date(Date.now() - 82800000) },
    { customerId: customers[5].id, solarSiteId: 1, serviceId: solarAmc.id, staffId: staffMembers[4].id, branchId: varanasi.id, scheduledDate: yesterday, scheduledTime: "09:00", status: "completed", serviceType: "solar_cleaning", amount: "1499", rating: 4, completedAt: new Date(Date.now() - 79200000) },
    { customerId: customers[6].id, vehicleId: 8, serviceId: premiumWash.id, staffId: staffMembers[5].id, branchId: lucknow.id, scheduledDate: yesterday, scheduledTime: "10:00", status: "completed", serviceType: "car_wash", amount: "599", rating: 5, completedAt: new Date(Date.now() - 75600000) },
    { customerId: customers[7].id, vehicleId: 9, serviceId: ppf.id, staffId: staffMembers[2].id, branchId: kanpur.id, scheduledDate: twoDaysLater, scheduledTime: "10:00", status: "confirmed", serviceType: "detailing", amount: "19999" },
    { customerId: customers[8].id, vehicleId: 10, serviceId: basicWash.id, staffId: staffMembers[1].id, branchId: varanasi.id, scheduledDate: today, scheduledTime: "14:00", status: "pending", serviceType: "car_wash", amount: "299" },
    { customerId: customers[0].id, vehicleId: 2, serviceId: premiumWash.id, staffId: staffMembers[0].id, branchId: varanasi.id, scheduledDate: yesterday, scheduledTime: "16:00", status: "completed", serviceType: "car_wash", amount: "599", rating: 5, completedAt: new Date(Date.now() - 64800000) },
    { customerId: customers[9].id, solarSiteId: 3, serviceId: solarAmc.id, staffId: staffMembers[4].id, branchId: lucknow.id, scheduledDate: tomorrow, scheduledTime: "08:00", status: "confirmed", serviceType: "solar_cleaning", amount: "1499" },
    { customerId: customers[11].id, vehicleId: 12, serviceId: interiorDetailing.id, staffId: staffMembers[0].id, branchId: varanasi.id, scheduledDate: today, scheduledTime: "15:00", status: "pending", serviceType: "detailing", amount: "2499" },
  ]);

  console.log("Bookings created");

  // Attendance (last 5 days)
  const attendanceData = [];
  for (const staff of staffMembers.slice(0, 5)) {
    for (let d = 1; d <= 5; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
      const statuses = ["present", "present", "present", "late", "present"] as const;
      attendanceData.push({
        staffId: staff.id, date,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        checkInTime: "09:15", checkOutTime: "18:30",
      });
    }
  }
  await db.insert(attendanceTable).values(attendanceData);

  // Complaints
  await db.insert(complaintsTable).values([
    { customerId: customers[1].id, bookingId: 2, type: "quality", title: "Missed interior cleaning", description: "The dashboard was not cleaned properly. Dust still visible on vents.", status: "open", priority: "medium" },
    { customerId: customers[3].id, type: "delay", title: "Technician arrived 2 hours late", description: "Booked for 9 AM, technician arrived at 11 AM. No prior notice.", status: "in_progress", priority: "high" },
    { customerId: customers[8].id, bookingId: 9, type: "billing", title: "Charged wrong amount", description: "Was quoted Rs 299 but charged Rs 599. Please refund the difference.", status: "resolved", priority: "high", resolution: "Refund of Rs 300 processed to wallet.", resolvedAt: new Date(Date.now() - 86400000) },
    { customerId: customers[0].id, type: "reclean", title: "Water spots on car body", description: "After washing, water spots appeared on the bonnet. Need reclean.", status: "open", priority: "low" },
  ]);

  // Invoices & Payments
  const inv1 = await db.insert(invoicesTable).values({
    invoiceNumber: "CWP-2026-1001",
    customerId: customers[0].id,
    items: [{ description: "Daily Wash Subscription (3 months)", quantity: 1, unitPrice: 8999, total: 8999 }],
    subtotal: "8999", tax: "0", discount: "0", totalAmount: "8999", paidAmount: "8999", dueAmount: "0",
    status: "paid", issuedAt: new Date(Date.now() - 7 * 86400000), paidAt: new Date(Date.now() - 7 * 86400000),
  }).returning();

  const inv2 = await db.insert(invoicesTable).values({
    invoiceNumber: "CWP-2026-1002",
    customerId: customers[1].id,
    items: [{ description: "Monthly Wash Subscription", quantity: 1, unitPrice: 2499, total: 2499 }],
    subtotal: "2499", tax: "0", discount: "0", totalAmount: "2499", paidAmount: "0", dueAmount: "2499",
    status: "sent", issuedAt: new Date(Date.now() - 3 * 86400000),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  }).returning();

  const inv3 = await db.insert(invoicesTable).values({
    invoiceNumber: "CWP-2026-1003",
    customerId: customers[5].id,
    items: [{ description: "Solar AMC Annual Plan", quantity: 1, unitPrice: 14999, total: 14999 }],
    subtotal: "14999", tax: "0", discount: "0", totalAmount: "14999", paidAmount: "0", dueAmount: "14999",
    status: "overdue", issuedAt: new Date(Date.now() - 30 * 86400000),
    dueDate: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
  }).returning();

  const inv4 = await db.insert(invoicesTable).values({
    invoiceNumber: "CWP-2026-1004",
    customerId: customers[4].id,
    items: [{ description: "Basic Wash x 5", quantity: 5, unitPrice: 299, total: 1495 }],
    subtotal: "1495", tax: "0", discount: "0", totalAmount: "1495", paidAmount: "1495", dueAmount: "0",
    status: "paid", issuedAt: new Date(Date.now() - 2 * 86400000), paidAt: new Date(Date.now() - 1 * 86400000),
  }).returning();

  await db.insert(paymentsTable).values([
    { customerId: customers[0].id, invoiceId: inv1[0].id, amount: "8999", method: "upi", transactionId: "TXN20260430001", status: "completed" },
    { customerId: customers[4].id, invoiceId: inv4[0].id, amount: "1495", method: "cash", status: "completed" },
    { customerId: customers[2].id, amount: "2499", method: "upi", transactionId: "TXN20260502001", status: "completed" },
    { customerId: customers[6].id, amount: "599", method: "razorpay", transactionId: "TXN20260503001", status: "completed" },
  ]);

  // Notifications
  await db.insert(notificationsTable).values([
    { userId: 1, title: "Welcome to CWP Platform", message: "Your admin account is ready. Explore the dashboard to get started.", type: "broadcast", channel: "in_app" },
    { title: "Subscription Expiring Soon", message: "3 customer subscriptions expire within 7 days. Take action.", type: "subscription_expiry", channel: "in_app" },
    { title: "Outstanding Dues Alert", message: "Total pending dues: Rs 17,498. Review the outstanding report.", type: "payment_reminder", channel: "in_app" },
    { title: "New Complaint Filed", message: "High priority complaint from Vikram Singh regarding delayed service.", type: "complaint_update", channel: "in_app" },
  ]);

  console.log("All seed data inserted successfully!");
  console.log("\nAdmin credentials:");
  console.log("  Phone: 9999999999  Password: admin123");
  console.log("\nCustomer credentials (any customer):");
  console.log("  Phone: 9001001001  Password: (any value — auth uses demo mode)");
}

seed().catch(console.error).finally(() => process.exit());
