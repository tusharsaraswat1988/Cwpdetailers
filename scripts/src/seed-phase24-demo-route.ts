import "./load-env.js";
import { pool } from "@workspace/db";
import argon2 from "argon2";

async function main() {
  console.log("Seeding Phase 24 staff demo route...");

  // 1. Get city
  let cityId = 1;
  const cityRows = await pool.query("SELECT id, name FROM cities WHERE is_active = true ORDER BY id ASC");
  if (cityRows.rows.length > 0) {
    cityId = cityRows.rows[0].id;
  }

  // 2. Ensure staff record id 4 exists and is active & verified
  let staffId = 4;
  const staffRows = await pool.query("SELECT id FROM staff WHERE id = 4");
  if (staffRows.rows.length === 0) {
    const newStaff = await pool.query(
      `INSERT INTO staff (name, phone, role, verification_status, is_active, city, staff_category)
       VALUES ('Ravi Kumar', '9011001001', 'technician', 'verified', true, 'Varanasi', 'cleaning_staff')
       RETURNING id`
    );
    staffId = newStaff.rows[0].id;
  } else {
    await pool.query("UPDATE staff SET verification_status = 'verified', is_active = true WHERE id = 4");
  }

  // 3. Ensure daily_car_cleaner operational role
  const roleMaster = await pool.query("SELECT id FROM staff_role_master WHERE slug = 'daily_car_cleaner'");
  if (roleMaster.rows.length > 0) {
    const roleId = roleMaster.rows[0].id;
    const existing = await pool.query("SELECT id FROM staff_role_assignments WHERE staff_id = $1 AND role_id = $2", [staffId, roleId]);
    if (existing.rows.length === 0) {
      await pool.query("INSERT INTO staff_role_assignments (staff_id, role_id, skill_level) VALUES ($1, $2, 'proficient')", [staffId, roleId]);
    }
  }

  // 4. Ensure staff login user exists: phone 9011001001, password staff123, role staff
  const staffHash = await argon2.hash("staff123", { type: argon2.argon2id });
  const userRows = await pool.query("SELECT id FROM users WHERE phone = '9011001001'");
  if (userRows.rows.length === 0) {
    await pool.query(
      `INSERT INTO users (phone, name, role, staff_id, password_hash, is_active)
       VALUES ('9011001001', 'Ravi Kumar', 'staff', $1, $2, true)`,
      [staffId, staffHash]
    );
    console.log("Created staff user 9011001001 with password staff123");
  } else {
    await pool.query(
      `UPDATE users SET role = 'staff', staff_id = $1, password_hash = $2, is_active = true WHERE phone = '9011001001'`,
      [staffId, staffHash]
    );
    console.log("Updated staff user 9011001001");
  }

  // 5. Ensure residential society & towers
  let societyId = 1;
  const socRows = await pool.query("SELECT id FROM residential_societies LIMIT 1");
  if (socRows.rows.length === 0) {
    const newSoc = await pool.query(
      `INSERT INTO residential_societies (city_id, name, code, address, pincode, is_active)
       VALUES ($1, 'Gokul Heights', 'GOKUL', 'Sector 78, Expressway', '201301', true)
       RETURNING id`,
      [cityId]
    );
    societyId = newSoc.rows[0].id;
  } else {
    societyId = socRows.rows[0].id;
  }

  let towerId = 1;
  const towRows = await pool.query("SELECT id FROM society_towers WHERE society_id = $1 LIMIT 1", [societyId]);
  if (towRows.rows.length === 0) {
    const newTow = await pool.query(
      `INSERT INTO society_towers (society_id, name, total_floors)
       VALUES ($1, 'Tower B', 18)
       RETURNING id`,
      [societyId]
    );
    towerId = newTow.rows[0].id;
  } else {
    towerId = towRows.rows[0].id;
  }

  // 6. Clean existing assignments for this staff so seed is idempotent
  await pool.query("DELETE FROM dcms_staff_assignments WHERE staff_id = $1", [staffId]);

  // 7. Ensure 3 test customers, vehicles, service locations, and subscriptions
  const demoVehicles = [
    { reg: "UP65AB1234", make: "Hyundai", model: "Creta", color: "White", bay: "B-42", customer: "Arjun Sharma", phone: "9001001001" },
    { reg: "UP65CD5678", make: "Maruti", model: "Swift", color: "Red", bay: "A-15", customer: "Sunita Patel", phone: "9001001002" },
    { reg: "UP65EF9012", make: "Tata", model: "Nexon", color: "Blue", bay: "C-08", customer: "Rohit Agarwal", phone: "9001001005" },
  ];

  for (let i = 0; i < demoVehicles.length; i++) {
    const v = demoVehicles[i];

    // Customer
    let custId: number;
    const custRes = await pool.query("SELECT id FROM customers WHERE phone = $1", [v.phone]);
    if (custRes.rows.length === 0) {
      const newCust = await pool.query(
        `INSERT INTO customers (name, phone, address, city, city_id) VALUES ($1, $2, 'Flat 402, Gokul Heights', 'Noida', $3) RETURNING id`,
        [v.customer, v.phone, cityId]
      );
      custId = newCust.rows[0].id;
    } else {
      custId = custRes.rows[0].id;
    }

    // Vehicle
    let vehId: number;
    const vehRes = await pool.query("SELECT id FROM vehicles WHERE registration_number = $1", [v.reg]);
    if (vehRes.rows.length === 0) {
      const newVeh = await pool.query(
        `INSERT INTO vehicles (customer_id, registration_number, make, model, color, service_address, service_lat, service_lng)
         VALUES ($1, $2, $3, $4, $5, 'Gokul Heights, Sector 78, Noida', 28.5355, 77.3910)
         RETURNING id`,
        [custId, v.reg, v.make, v.model, v.color]
      );
      vehId = newVeh.rows[0].id;
    } else {
      vehId = vehRes.rows[0].id;
    }

    // Service location
    const sLoc = await pool.query(
      `INSERT INTO service_locations (label, address, city_id, society_id, tower_id, flat_number, parking_level, parking_bay)
       VALUES ($1, 'Gokul Heights, Sector 78', $2, $3, $4, '402', 'Basement 1', $5)
       RETURNING id`,
      [`Parking ${v.bay}`, cityId, societyId, towerId, v.bay]
    );
    const serviceLocId = sLoc.rows[0].id;

    // Plan
    const planRes = await pool.query("SELECT id FROM dcms_plans LIMIT 1");
    let planId = planRes.rows[0]?.id;
    if (!planId) {
      const newPlan = await pool.query(
        `INSERT INTO dcms_plans (name, plan_type, frequency, cleanings_per_month, price, is_active)
         VALUES ('Premium Daily Clean', 'daily_cleaning', 'daily', 26, 1200, true)
         RETURNING id`
      );
      planId = newPlan.rows[0].id;
    }

    // Active subscription
    const subRes = await pool.query(
      `INSERT INTO dcms_subscriptions (customer_id, vehicle_id, plan_id, status, start_date, allocated_cleanings, remaining_cleanings, service_location_id, parking_bay)
       VALUES ($1, $2, $3, 'active', '2026-11-01', 26, 25, $4, $5)
       RETURNING id`,
      [custId, vehId, planId, serviceLocId, v.bay]
    );
    const subId = subRes.rows[0].id;

    // Staff assignment
    await pool.query(
      `INSERT INTO dcms_staff_assignments (staff_id, subscription_id, route_order, is_active)
       VALUES ($1, $2, $3, true)`,
      [staffId, subId, i + 1]
    );
  }

  console.log("Successfully seeded 3 daily route stops for staff Ravi Kumar (phone: 9011001001)!");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
