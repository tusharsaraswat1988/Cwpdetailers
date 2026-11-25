import "./load-env.js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, db, usersTable, platformBrandingTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  PENDING_MIGRATIONS,
  filesThrough,
  inferBaselineFilename,
  isMigrationAlreadyApplied,
  type Queryable,
} from "./migration-state.js";
import { seedPermissions } from "./seed-permissions.js";
import { seedMasterData } from "./seed-master-data.js";
import { seedCatalogMigration } from "./seed-catalog-migration.js";
import { readAdminCredentials } from "./adminEnv.js";
import argon2 from "argon2";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "lib/db/migrations");

const TRACKING_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function recordedFiles(queryable: Queryable): Promise<Set<string>> {
  const { rows } = await queryable.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map(r => String(r.filename)));
}

async function recordApplied(queryable: Queryable, filename: string) {
  await queryable.query(
    `INSERT INTO schema_migrations (filename) VALUES ('${filename.replace(/'/g, "''")}') ON CONFLICT (filename) DO NOTHING`,
  );
}

export async function runDeployAuto(): Promise<void> {
  console.log("=================================================");
  console.log("🚀 Starting Automated Database Deploy & Bootstrap");
  console.log("=================================================");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Ensure the database connection string is provided.");
  }

  const queryable = pool as unknown as Queryable;
  const available = new Set(readdirSync(migrationsDir));

  // Step 1: Ensure schema_migrations table
  console.log("1/5: Verifying schema_migrations tracking table...");
  await queryable.query(TRACKING_DDL);
  let recorded = await recordedFiles(queryable);

  if (recorded.size === 0) {
    const baseline = await inferBaselineFilename(queryable);
    if (baseline) {
      const already = filesThrough(PENDING_MIGRATIONS, baseline);
      console.log(`Tracking empty — recording ${already.length} already-applied files through ${baseline}.`);
      for (const file of already) {
        await recordApplied(queryable, file);
      }
      recorded = await recordedFiles(queryable);
    }
  }

  // Step 2: Apply pending migrations (including 000_baseline_schema.sql if fresh DB)
  console.log("2/5: Applying database migrations & baseline schema...");
  for (const file of PENDING_MIGRATIONS) {
    if (!available.has(file)) {
      continue;
    }
    if (recorded.has(file)) {
      continue;
    }
    if (await isMigrationAlreadyApplied(queryable, file)) {
      await recordApplied(queryable, file);
      console.log(`  ↷ Skip ${file} (already present in schema)`);
      continue;
    }

    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`  ➜ Applying ${file}...`);
    await queryable.query(sql);
    await recordApplied(queryable, file);
    recorded.add(file);
    console.log(`  ✓ Applied ${file}`);
  }

  // Step 3: Seed Permissions & Master Data
  console.log("3/5: Seeding RBAC permissions & vehicle master data...");
  try {
    const permCount = await queryable.query("SELECT COUNT(*)::int as cnt FROM permissions");
    if ((permCount.rows[0]?.cnt as number) === 0) {
      await seedPermissions();
    } else {
      console.log("  ↷ RBAC permissions already present, skipping.");
    }
  } catch (err) {
    console.warn("  ⚠ Warning during seedPermissions:", (err as Error)?.message);
  }

  try {
    const brandCount = await queryable.query("SELECT COUNT(*)::int as cnt FROM vehicle_brands");
    if ((brandCount.rows[0]?.cnt as number) === 0) {
      await seedMasterData();
    } else {
      console.log("  ↷ Vehicle master data already present, skipping.");
    }
  } catch (err) {
    console.warn("  ⚠ Warning during seedMasterData:", (err as Error)?.message);
  }

  try {
    const serviceCount = await queryable.query("SELECT COUNT(*)::int as cnt FROM services");
    if ((serviceCount.rows[0]?.cnt as number) === 0) {
      await seedCatalogMigration();
    } else {
      console.log("  ↷ Service catalog already present, skipping.");
    }
  } catch (err) {
    console.warn("  ⚠ Warning during seedCatalogMigration:", (err as Error)?.message);
  }

  // Step 4: Ensure Default Branding
  console.log("4/5: Ensuring default platform branding...");
  try {
    const existing = await db
      .select({ id: platformBrandingTable.id })
      .from(platformBrandingTable)
      .where(eq(platformBrandingTable.isActive, true))
      .limit(1);

    if (!existing[0]) {
      await db.insert(platformBrandingTable).values({
        companyName: "CWP Detailers + Kleansolar",
        brandName: "CWP Detailers",
        tagline: "Premium Car Care & Solar Cleaning",
        primaryColor: "#00cccc",
        secondaryColor: "#212529",
        accentColor: "#e0ffff",
        backgroundColor: "#f5f6f8",
        textColor: "#212529",
        metaDescriptionTemplate:
          "Premium car detailing, daily wash subscriptions, and solar panel cleaning services.",
      });
      console.log("  ✓ Created default CWP platform branding row");
    } else {
      console.log("  ✓ Platform branding row exists");
    }
  } catch (err) {
    console.warn("  ⚠ Warning checking platform branding:", (err as Error)?.message);
  }

  // Step 5: Ensure Super Admin Account
  console.log("5/5: Ensuring Super Admin account from environment...");
  try {
    const admin = readAdminCredentials();
    const existingAdmin = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.phone, admin.phone))
      .limit(1);

    const passwordHash = await argon2.hash(admin.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    if (existingAdmin[0]) {
      await db
        .update(usersTable)
        .set({
          passwordHash,
          role: "superadmin",
          name: admin.name,
          email: admin.email,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existingAdmin[0].id));
      console.log(`  ✓ Super admin updated (phone: ${admin.phone})`);
    } else {
      await db.insert(usersTable).values({
        phone: admin.phone,
        passwordHash,
        name: admin.name,
        email: admin.email,
        role: "superadmin",
        isActive: true,
      });
      console.log(`  ✓ Super admin created (phone: ${admin.phone})`);
    }
  } catch (err) {
    console.warn("  ⚠ Warning ensuring admin credentials:", (err as Error)?.message);
  }

  console.log("=================================================");
  console.log("✅ Automated Database Deploy & Bootstrap Complete!");
  console.log("=================================================");
}

async function main() {
  try {
    await runDeployAuto();
  } finally {
    await pool.end();
  }
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.includes("deploy-auto")
) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("❌ Deploy-auto failed:", err);
      process.exit(1);
    });
}
