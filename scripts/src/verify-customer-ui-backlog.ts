/**

 * Verification for incremental customer UI backlog fixes.

 * Usage: pnpm --filter @workspace/scripts run verify:customer-ui-backlog

 */

import { readFileSync, existsSync } from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";



const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");



type Check = { id: string; name: string; pass: boolean };



function fileHas(rel: string, needle: string | RegExp): boolean {

  const full = path.join(root, rel);

  if (!existsSync(full)) return false;

  const text = readFileSync(full, "utf8");

  return typeof needle === "string" ? text.includes(needle) : needle.test(text);

}



const checks: Check[] = [

  { id: "1", name: "Duplicate phone → Open existing customer (form)", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/QuickCreateCustomerForm.tsx", "open-existing-customer") },

  { id: "1b", name: "Duplicate link wired in Customers page", pass: fileHas("artifacts/cwp-platform/src/features/customers/pages/Customers.tsx", "customerBasePath={basePath}") },

  { id: "1c", name: "Duplicate link wired in Onboarding wizard", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerOnboardingWizard.tsx", "customerBasePath={basePath}") },

  { id: "1d", name: "Duplicate link wired in DCMS quick create", pass: fileHas("artifacts/cwp-platform/src/features/daily-cleaning/pages/DcmsSubscriptionsPage.tsx", 'customerBasePath="/admin/customers"') },

  { id: "2", name: "Lead convert toast View customer (admin)", pass: fileHas("artifacts/cwp-platform/src/pages/admin/Leads.tsx", "toast-lead-view-customer") },

  { id: "2b", name: "Lead detail customer profile link (admin)", pass: fileHas("artifacts/cwp-platform/src/pages/admin/Leads.tsx", "CustomerProfileLink") },

  { id: "2c", name: "Lead convert toast View customer (franchisee)", pass: fileHas("artifacts/cwp-platform/src/pages/franchisee/Leads.tsx", "toast-franchisee-lead-view-customer") },

  { id: "2d", name: "Lead detail customer profile link (franchisee)", pass: fileHas("artifacts/cwp-platform/src/pages/franchisee/Leads.tsx", "CustomerProfileLink") },

  { id: "3", name: "Admin bookings detail → customer profile link", pass: fileHas("artifacts/cwp-platform/src/features/bookings/pages/Bookings.tsx", 'customerBasePath="/admin/customers"') },

  { id: "3b", name: "Franchisee bookings detail → customer profile link", pass: fileHas("artifacts/cwp-platform/src/pages/franchisee/Bookings.tsx", 'customerBasePath="/franchisee/customers"') },

  { id: "4", name: "CustomerSearchSelect component", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerSearchSelect.tsx", "CustomerSearchSelect") },

  { id: "4b", name: "Invoices customer search picker", pass: fileHas("artifacts/cwp-platform/src/pages/admin/Invoices.tsx", "CustomerSearchSelect") },

  { id: "4c", name: "Quotation customer search picker", pass: fileHas("artifacts/cwp-platform/src/pages/admin/QuotationBuilder.tsx", "quotation-customer-search") },

  { id: "4d", name: "Subscriptions customer search picker", pass: fileHas("artifacts/cwp-platform/src/pages/admin/Subscriptions.tsx", "select-sub-customer") },

  { id: "5", name: "360 complaints admin link + actions", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerComplaintsPanel.tsx", "btn-open-complaints-admin") },

  { id: "5b", name: "Admin complaints customerId filter", pass: fileHas("artifacts/cwp-platform/src/pages/admin/Complaints.tsx", "customerFilter") },

  { id: "6", name: "Onboarding franchisee-safe DCMS link", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerOnboardingWizard.tsx", "isAdminPortal") },

  { id: "7", name: "Onboarding photo step", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerOnboardingWizard.tsx", 'step === "photo"') },

  { id: "8", name: "GSTIN/billing at create (QuickCreate)", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/QuickCreateCustomerForm.tsx", "showBillingFields") },

  { id: "8b", name: "Onboarding shows billing fields", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/CustomerOnboardingWizard.tsx", "showBillingFields") },

  { id: "9", name: "Customer list B2B badge", pass: fileHas("artifacts/cwp-platform/src/features/customers/pages/Customers.tsx", "B2B") },

  { id: "10", name: "360 subscriptions/invoices panels", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/Customer360BillingPanels.tsx", "customer-360-billing-panels") },

  { id: "10b", name: "360 all bookings link", pass: fileHas("artifacts/cwp-platform/src/features/customers/components/Customer360Overview.tsx", "All bookings") },

  { id: "11", name: "Migration sample download API", pass: fileHas("artifacts/api-server/src/routes/migration.ts", "/migration/customers/sample") },

  { id: "11b", name: "Migration sample download UI", pass: fileHas("artifacts/cwp-platform/src/pages/admin/CustomerMigration.tsx", "btn-download-migration-sample") },

  { id: "12", name: "360 tab URL deep-link sync", pass: fileHas("artifacts/cwp-platform/src/features/customers/pages/CustomerDetail.tsx", "handleTabChange") },

  { id: "13", name: "Admin bookings customerId URL filter", pass: fileHas("artifacts/cwp-platform/src/features/bookings/pages/Bookings.tsx", "customerFilter") },

];



const failed = checks.filter(c => !c.pass);

for (const c of checks) {

  console.log(`${c.pass ? "PASS" : "FAIL"}  [#${c.id}] ${c.name}`);

}

console.log(`\nCustomer UI backlog: ${checks.length - failed.length}/${checks.length} checks passed`);

if (failed.length > 0) process.exit(1);


