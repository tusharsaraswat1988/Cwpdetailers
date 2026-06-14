/**
 * Static verification checklist for Tier 1 customer creation features.
 * Usage: pnpm --filter @workspace/scripts run verify:tier1-customers
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type Check = { name: string; pass: boolean; detail?: string };

function fileHas(rel: string, needle: string | RegExp): boolean {
  const full = path.join(root, rel);
  if (!existsSync(full)) return false;
  const text = readFileSync(full, "utf8");
  return typeof needle === "string" ? text.includes(needle) : needle.test(text);
}

const checks: Check[] = [
  { name: "API duplicate phone guard", pass: fileHas("artifacts/api-server/src/routes/customers.ts", "findCustomerByPhoneInScope") },
  { name: "API optional login on create", pass: fileHas("artifacts/api-server/src/routes/customers.ts", "createCustomerLoginAccount") },
  { name: "API PATCH duplicate phone", pass: fileHas("artifacts/api-server/src/routes/customers.ts", "existingCustomerId") },
  { name: "Lead convert smart link", pass: fileHas("artifacts/api-server/src/routes/leads.ts", "customerLinked") },
  { name: "Admin create UI (login + branch)", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/QuickCreateCustomerForm.tsx", "createLogin") },
  { name: "Customer edit UI", pass: fileHas("artifacts/cwp-platform/src/features/customers/pages/CustomerDetail.tsx", "btn-edit-customer") },
  { name: "Admin add vehicle", pass: fileHas("artifacts/cwp-platform/src/features/customers/pages/CustomerDetail.tsx", "btn-toggle-add-vehicle") },
  { name: "Franchisee customers route", pass: fileHas("artifacts/cwp-platform/src/App.tsx", "/franchisee/customers") },
  { name: "Franchisee sidebar", pass: fileHas("artifacts/cwp-platform/src/components/layout/FranchiseeLayout.tsx", "/franchisee/customers") },
  { name: "Customer photo upload", pass: fileHas("artifacts/cwp-platform/src/components/shared/CustomerPhotoEditor.tsx", "Upload photo") },
];

const failed = checks.filter(c => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}
console.log(`\nTier 1: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) process.exit(1);
