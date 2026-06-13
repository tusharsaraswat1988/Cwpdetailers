import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  INSERT INTO staff_role_master (name, slug, sort_order) VALUES
    ('Daily Car Cleaner', 'daily_car_cleaner', 1),
    ('Car Washer', 'car_washer', 2),
    ('Solar Cleaner', 'solar_cleaner', 3),
    ('Interior Detailer', 'interior_detailer', 4),
    ('Coating Detailer', 'coating_detailer', 5)
  ON CONFLICT (slug) DO NOTHING
`);

await client.query(`
  UPDATE staff SET employee_code = 'CWP-STF-' || LPAD(id::text, 5, '0')
  WHERE employee_code IS NULL
`);

const roles = await client.query("SELECT COUNT(*)::int AS count FROM staff_role_master");
console.log("staff_role_master rows:", roles.rows[0].count);
await client.end();
