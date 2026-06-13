/**
 * Generates fixtures/legacy-migration-sample.xlsx for LM-1–LM-6 verification.
 */
import "./load-env.js";
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "fixtures");
const outPath = path.join(outDir, "legacy-migration-sample.xlsx");

const CUSTOMER_HEADERS = [
  "legacy_customer_id*",
  "name*",
  "phone*",
  "email",
  "address",
  "city",
  "branch_id",
  "wallet_balance",
  "outstanding_amount",
  "last_payment_date",
  "customer_since",
  "historical_wash_count",
  "historical_solar_visit_count",
  "operational_notes",
  "photo_url",
  "temporary_password",
  "create_login*",
];

const SAMPLE_ROWS = [
  [
    "LEG-9001",
    "Legacy Test Customer",
    "9009009001",
    "legacy.test@example.com",
    "Assi Ghat, Varanasi",
    "Varanasi",
    "",
    "500",
    "1200.50",
    "2025-12-15",
    "2019-03-01",
    "48",
    "6",
    "VIP — prefers morning slot. Contract renewed Jan 2026.",
    "",
    "legacy9001",
    "Y",
  ],
  [
    "LEG-9002",
    "Second Legacy Customer",
    "9009009002",
    "",
    "BHU Campus",
    "Varanasi",
    "",
    "0",
    "0",
    "",
    "2024-06-10",
    "",
    "",
    "New customer — no historical counts",
    "",
    "legacy9002",
    "Y",
  ],
];

async function main() {
  mkdirSync(outDir, { recursive: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = "CWP Legacy Migration";
  wb.created = new Date();

  const instructions = wb.addWorksheet("Instructions");
  instructions.addRow(["CWP Legacy Migration Template v1 — Customers phase (LM-6)"]);
  instructions.addRow(["Required columns marked with *"]);
  instructions.addRow(["outstanding_amount maps to platform total_dues"]);
  instructions.addRow(["photo_url optional — customer can also upload from portal"]);

  const customers = wb.addWorksheet("Customers");
  customers.addRow(CUSTOMER_HEADERS);
  for (const row of SAMPLE_ROWS) customers.addRow(row);
  customers.getRow(1).font = { bold: true };

  await wb.xlsx.writeFile(outPath);
  console.log(`Sample workbook written: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
