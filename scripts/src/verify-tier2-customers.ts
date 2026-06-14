/**
 * Static verification for Tier 2 customer ops features.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type Check = { name: string; pass: boolean };

function fileHas(rel: string, needle: string | RegExp): boolean {
  const full = path.join(root, rel);
  if (!existsSync(full)) return false;
  const text = readFileSync(full, "utf8");
  return typeof needle === "string" ? text.includes(needle) : needle.test(text);
}

const checks: Check[] = [
  { name: "Onboarding wizard", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerOnboardingWizard.tsx", "Step 1") },
  { name: "Migration API routes", pass: fileHas("artifacts/api-server/src/routes/migration.ts", "/migration/customers/preview") },
  { name: "Migration admin UI", pass: fileHas("artifacts/cwp-platform/src/pages/admin/CustomerMigration.tsx", "Commit import") },
  { name: "DCMS quick create customer", pass: fileHas("artifacts/cwp-platform/src/features/daily-cleaning/pages/DcmsSubscriptionsPage.tsx", "New customer") },
  { name: "Lead linked toast (admin)", pass: fileHas("artifacts/cwp-platform/src/pages/admin/Leads.tsx", "customerLinked") },
  { name: "Lead linked toast (franchisee)", pass: fileHas("artifacts/cwp-platform/src/pages/franchisee/Leads.tsx", "customerLinked") },
];

const failed = checks.filter(c => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
}
console.log(`\nTier 2: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) process.exit(1);
