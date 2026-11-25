const targetUrl =
  process.env.DATABASE_URL ||
  process.env.TARGET_DATABASE_URL ||
  "postgresql://neondb_owner:npg_WXJ8KqZO9Aud@ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = targetUrl;
}

import { pg } from "@workspace/db";

const connectionString = targetUrl;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("Connecting to target database:", connectionString.replace(/:[^:@]+@/, ":****@"));
  await client.connect();
  console.log("Connection successful!");

  // 1. Check migrations
  const migTable = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations';
  `);

  if (migTable.rows.length > 0) {
    const migs = await client.query("SELECT * FROM schema_migrations;");
    console.log(`\nFound schema_migrations table with ${migs.rows.length} applied migration(s):`);
    for (const m of migs.rows.slice(-10)) {
      console.log(`  - ${m.filename || m.name} (applied: ${m.applied_at || m.executed_at})`);
    }
  } else {
    console.log("\nschema_migrations table does NOT exist yet.");
  }

  // 2. Enumerate all tables and row counts
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log(`\nTotal tables in public schema: ${tables.rows.length}`);
  const nonEmptyTables: { table: string; count: number }[] = [];

  for (const row of tables.rows) {
    const t = row.table_name;
    try {
      const c = await client.query(`SELECT COUNT(*)::int as count FROM "${t}";`);
      const count = c.rows[0].count;
      if (count > 0) {
        nonEmptyTables.push({ table: t, count });
      }
    } catch (err: any) {
      console.error(`Error counting table ${t}:`, err.message);
    }
  }

  console.log(`\nTables containing data (> 0 rows): ${nonEmptyTables.length}`);
  for (const item of nonEmptyTables) {
    console.log(`  - ${item.table}: ${item.count} rows`);
  }

  // Check users breakdown if users table exists
  try {
    const users = await client.query(`SELECT id, phone, name, role FROM users LIMIT 10;`);
    console.log(`\nSample users in users table (${users.rows.length} shown):`);
    for (const u of users.rows) {
      console.log(`  - ID: ${u.id}, Phone: ${u.phone}, Name: ${u.name}, Role: ${u.role}`);
    }
  } catch {}

  // Check cities breakdown if cities table exists
  try {
    const cities = await client.query(`SELECT id, name, slug, status, is_active FROM cities LIMIT 10;`);
    console.log(`\nSample cities in cities table (${cities.rows.length} shown):`);
    for (const c of cities.rows) {
      console.log(`  - ID: ${c.id}, Name: ${c.name}, Slug: ${c.slug}, Status: ${c.status}, Active: ${c.is_active}`);
    }
  } catch {}

  // Check branches breakdown if branches table exists
  try {
    const branches = await client.query(`SELECT id, name, code, city_id, is_active FROM branches LIMIT 10;`);
    console.log(`\nSample branches in branches table (${branches.rows.length} shown):`);
    for (const b of branches.rows) {
      console.log(`  - ID: ${b.id}, Name: ${b.name}, Code: ${b.code}, City ID: ${b.city_id}, Active: ${b.is_active}`);
    }
  } catch {}

  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
