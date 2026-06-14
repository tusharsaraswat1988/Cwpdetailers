/**
 * Static verification for Tier 3 customer ops features.
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
  { name: "Migration 019 tier3 columns", pass: fileHas("lib/db/migrations/019_customer_tier3.sql", "referred_by_customer_id") },
  { name: "GSTIN validator", pass: fileHas("artifacts/api-server/src/lib/gstin.ts", "normalizeGstin") },
  { name: "Inbound auto-lead", pass: fileHas("artifacts/api-server/src/lib/inboundContact.ts", "resolveOrCreateInboundContact") },
  { name: "Customer network API", pass: fileHas("artifacts/api-server/src/routes/customers.ts", "/customers/:id/network") },
  { name: "Customer 360 tabs UI", pass: fileHas("artifacts/cwp-platform/src/features/customers/pages/CustomerDetail.tsx", "customer-360-tabs") },
  { name: "Referral panel", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerReferralPanel.tsx", "customer-referral-panel") },
  { name: "Complaints panel", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerComplaintsPanel.tsx", "customer-complaints-panel") },
  { name: "Churned view customer link", pass: fileHas("artifacts/cwp-platform/src/pages/admin/ChurnedCustomers.tsx", "View customer") },
  { name: "WhatsApp webhook uses auto-create", pass: fileHas("artifacts/api-server/src/lib/communications/inboundWebhookService.ts", "resolveOrCreateInboundContact") },
];

const failed = checks.filter(c => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
}
console.log(`\nTier 3: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) process.exit(1);
