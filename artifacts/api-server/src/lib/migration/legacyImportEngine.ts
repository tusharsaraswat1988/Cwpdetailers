import ExcelJS from "exceljs";
import argon2 from "argon2";
import { db } from "@workspace/db";
import {
  customersTable,
  usersTable,
  branchesTable,
  migrationBatchesTable,
  migrationEntityMapTable,
  migrationRowLogTable,
  commCustomerConsentsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import type { CustomerImportRow, CustomerImportResult, ParsedWorkbook, PreviewResult } from "./types";
import {
  parseBool,
  parseMoney,
  parseOptionalDate,
  parseOptionalInt,
  parseCustomerStatus,
  parseLegacySegment,
  validateCustomerRows,
} from "./validators";
import { LEGACY_SEGMENT_CONTACT } from "../customerReactivation";
import { ensureDefaultServiceLocation } from "../serviceLocations/defaultLocationService";

export { MIGRATION_PACKAGE_MAP, resolvePackageSlug } from "./packageMap";
export type { CustomerImportRow, PreviewResult, CustomerImportResult, MigrationIssue } from "./types";

const CUSTOMER_HEADERS: Record<string, keyof CustomerImportRow | "skip"> = {
  legacy_customer_id: "legacyCustomerId",
  name: "name",
  phone: "phone",
  email: "email",
  address: "address",
  city: "city",
  branch_id: "branchId",
  wallet_balance: "walletBalance",
  total_dues: "outstandingAmount",
  outstanding_amount: "outstandingAmount",
  last_payment_date: "lastPaymentDate",
  customer_since: "customerSince",
  historical_wash_count: "historicalWashCount",
  historical_solar_visit_count: "historicalSolarVisitCount",
  operational_notes: "operationalNotes",
  contract_notes: "operationalNotes",
  photo_url: "photoUrl",
  temporary_password: "temporaryPassword",
  create_login: "createLogin",
  status: "status",
  legacy_segment: "legacySegment",
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value && value.text) return String(value.text);
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).trim();
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\*/g, "").replace(/\s+/g, "_");
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

function rowToCustomer(row: ExcelJS.Row, headerMap: Map<number, string>, rowNumber: number): CustomerImportRow {
  const raw: Record<string, string> = {};
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const key = headerMap.get(colNumber);
    if (key) raw[key] = cellText(cell.value);
  });

  const legacySegment = parseLegacySegment(raw.legacy_segment);

  return {
    rowNumber,
    legacyCustomerId: raw.legacy_customer_id ?? "",
    name: raw.name ?? "",
    phone: raw.phone ?? "",
    email: raw.email || null,
    address: raw.address || null,
    city: raw.city || null,
    branchId: parseOptionalInt(raw.branch_id),
    walletBalance: parseMoney(raw.wallet_balance),
    outstandingAmount: parseMoney(raw.outstanding_amount ?? raw.total_dues),
    lastPaymentDate: parseOptionalDate(raw.last_payment_date),
    customerSince: parseOptionalDate(raw.customer_since),
    historicalWashCount: parseOptionalInt(raw.historical_wash_count),
    historicalSolarVisitCount: parseOptionalInt(raw.historical_solar_visit_count),
    operationalNotes: raw.operational_notes || raw.contract_notes || null,
    photoUrl: raw.photo_url || null,
    temporaryPassword: raw.temporary_password || null,
    createLogin: parseBool(raw.create_login, legacySegment !== LEGACY_SEGMENT_CONTACT),
    status: parseCustomerStatus(raw.status, legacySegment === LEGACY_SEGMENT_CONTACT ? "inactive" : "active"),
    legacySegment,
  };
}

/** Parse Customers sheet from a legacy migration workbook buffer. */
export async function parseWorkbook(buffer: Buffer | ArrayBuffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet("Customers") ?? wb.worksheets.find(w => w.name.toLowerCase() === "customers");
  if (!sheet) {
    return {
      customers: [],
      issues: [{
        sheet: "Customers",
        row: 0,
        severity: "error",
        code: "MISSING_SHEET",
        message: "Customers sheet not found in workbook",
      }],
    };
  }

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const norm = normalizeHeader(cellText(cell.value));
    if (CUSTOMER_HEADERS[norm]) headerMap.set(colNumber, norm);
  });

  const customers: CustomerImportRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const parsed = rowToCustomer(row, headerMap, rowNumber);
    if (!parsed.legacyCustomerId && !parsed.name && !parsed.phone) return;
    customers.push(parsed);
  });

  return { customers, issues: [] };
}

export async function previewWorkbook(buffer: Buffer | ArrayBuffer): Promise<PreviewResult> {
  const parsed = await parseWorkbook(buffer);
  if (parsed.issues.some(i => i.code === "MISSING_SHEET")) {
    return {
      summary: { customers: 0, errors: 1, warnings: 0 },
      sheets: { Customers: { rows: [], errors: parsed.issues, warnings: [] } },
      canImport: false,
    };
  }

  const phones = parsed.customers.map(c => c.phone).filter(Boolean);
  const existing = phones.length
    ? await db.select({ phone: customersTable.phone }).from(customersTable).where(inArray(customersTable.phone, phones))
    : [];
  const existingPhones = new Set(existing.map(r => r.phone));

  const { errors, warnings } = validateCustomerRows(parsed.customers, existingPhones);
  const allIssues = [...parsed.issues, ...errors];

  return {
    summary: {
      customers: parsed.customers.length,
      errors: allIssues.filter(i => i.severity === "error").length,
      warnings: warnings.length,
    },
    sheets: {
      Customers: {
        rows: parsed.customers,
        errors: allIssues.filter(i => i.severity === "error"),
        warnings,
      },
    },
    canImport: allIssues.filter(i => i.severity === "error").length === 0 && parsed.customers.length > 0,
  };
}

type ImportOpts = {
  filename?: string;
  citySlug?: string;
  createdByUserId?: number;
  dryRun?: boolean;
  companyId?: number | null;
  franchiseeId?: number | null;
  defaultBranchId?: number | null;
};

function customerPayload(row: CustomerImportRow, opts: ImportOpts) {
  const notes = row.operationalNotes
    ?? (row.legacySegment === LEGACY_SEGMENT_CONTACT ? "source:legacy_contact" : null);
  return {
    name: row.name.trim(),
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    branchId: row.branchId ?? opts.defaultBranchId ?? null,
    companyId: opts.companyId ?? null,
    franchiseeId: opts.franchiseeId ?? null,
    status: row.status,
    legacySegment: row.legacySegment,
    walletBalance: row.walletBalance,
    totalDues: row.outstandingAmount,
    photoUrl: row.photoUrl,
    lastPaymentDate: row.lastPaymentDate,
    customerSince: row.customerSince,
    historicalWashCount: row.historicalWashCount,
    historicalSolarVisitCount: row.historicalSolarVisitCount,
    operationalNotes: notes,
    updatedAt: new Date(),
  };
}

/** Import customers + login users from parsed workbook. Supports dry-run rollback. */
export async function importCustomers(
  buffer: Buffer | ArrayBuffer,
  opts: ImportOpts = {},
): Promise<CustomerImportResult> {
  const preview = await previewWorkbook(buffer);
  if (!preview.canImport) {
    return {
      batchId: null,
      created: 0,
      updated: 0,
      skipped: 0,
      usersCreated: 0,
      locationsCreated: 0,
      issues: preview.sheets.Customers.errors,
    };
  }

  const rows = preview.sheets.Customers.rows;
  const result: CustomerImportResult = {
    batchId: null,
    created: 0,
    updated: 0,
    skipped: 0,
    usersCreated: 0,
    locationsCreated: 0,
    issues: [],
  };

  const run = async (tx: typeof db) => {
    const [batch] = await tx.insert(migrationBatchesTable).values({
      filename: opts.filename ?? null,
      citySlug: opts.citySlug ?? null,
      importMode: "upsert",
      status: opts.dryRun ? "dry_run" : "committed",
      createdByUserId: opts.createdByUserId ?? null,
      summary: { customers: rows.length },
    }).returning();
    result.batchId = batch.id;

    for (const row of rows) {
      try {
        const payload = customerPayload(row, opts);
        const [existingCustomer] = await tx.select().from(customersTable)
          .where(eq(customersTable.phone, row.phone)).limit(1);

        let customerId: number;
        let customerRow: typeof customersTable.$inferSelect;
        if (existingCustomer) {
          const [updated] = await tx.update(customersTable)
            .set(payload)
            .where(eq(customersTable.id, existingCustomer.id))
            .returning();
          customerId = updated.id;
          customerRow = updated;
          result.updated++;
        } else {
          const [created] = await tx.insert(customersTable).values({
            ...payload,
            createdAt: new Date(),
          }).returning();
          customerId = created.id;
          customerRow = created;
          result.created++;
        }

        const locResult = await ensureDefaultServiceLocation(customerRow, tx);
        if (locResult.created) result.locationsCreated++;

        await tx.insert(migrationEntityMapTable).values({
          batchId: batch.id,
          entityType: "customer",
          legacyId: row.legacyCustomerId,
          platformId: customerId,
        });

        if (row.legacySegment === LEGACY_SEGMENT_CONTACT) {
          const [existingConsent] = await tx.select({ id: commCustomerConsentsTable.id })
            .from(commCustomerConsentsTable)
            .where(eq(commCustomerConsentsTable.customerId, customerId)).limit(1);
          if (existingConsent) {
            await tx.update(commCustomerConsentsTable).set({
              smsConsent: true,
              whatsappConsent: true,
              consentSource: "import",
              consentDate: new Date(),
              updatedAt: new Date(),
            }).where(eq(commCustomerConsentsTable.customerId, customerId));
          } else {
            await tx.insert(commCustomerConsentsTable).values({
              customerId,
              smsConsent: true,
              whatsappConsent: true,
              consentSource: "import",
              notes: "Legacy contact import — re-engagement messaging",
              companyId: opts.companyId ?? null,
            });
          }
        }

        if (row.createLogin) {
          const password = row.temporaryPassword ?? generatePassword();
          const passwordHash = await hashPassword(password);
          const [existingUser] = await tx.select().from(usersTable)
            .where(eq(usersTable.phone, row.phone)).limit(1);

          let userId: number;
          if (existingUser) {
            await tx.update(usersTable).set({
              name: row.name.trim(),
              email: row.email,
              customerId,
              role: "customer",
              updatedAt: new Date(),
            }).where(eq(usersTable.id, existingUser.id));
            userId = existingUser.id;
          } else {
            const [user] = await tx.insert(usersTable).values({
              name: row.name.trim(),
              phone: row.phone,
              email: row.email,
              passwordHash,
              role: "customer",
              customerId,
              companyId: opts.companyId ?? null,
              branchId: row.branchId ?? opts.defaultBranchId ?? null,
              franchiseeId: opts.franchiseeId ?? null,
              isActive: true,
            }).returning();
            userId = user.id;
            result.usersCreated++;
          }

          await tx.update(customersTable).set({ userId, updatedAt: new Date() })
            .where(eq(customersTable.id, customerId));

          await tx.insert(migrationEntityMapTable).values({
            batchId: batch.id,
            entityType: "user",
            legacyId: row.legacyCustomerId,
            platformId: userId,
          });
        }

        await tx.insert(migrationRowLogTable).values({
          batchId: batch.id,
          sheetName: "Customers",
          rowNumber: row.rowNumber,
          status: "success",
          legacyId: row.legacyCustomerId,
          message: existingCustomer ? "Updated customer" : "Created customer",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.issues.push({
          sheet: "Customers",
          row: row.rowNumber,
          severity: "error",
          code: "IMPORT_FAILED",
          message: msg,
          legacyId: row.legacyCustomerId,
        });
        await tx.insert(migrationRowLogTable).values({
          batchId: batch.id,
          sheetName: "Customers",
          rowNumber: row.rowNumber,
          status: "error",
          legacyId: row.legacyCustomerId,
          message: msg,
        });
      }
    }

    await tx.update(migrationBatchesTable).set({
      summary: {
        customers: rows.length,
        created: result.created,
        updated: result.updated,
        usersCreated: result.usersCreated,
      },
      completedAt: new Date(),
    }).where(eq(migrationBatchesTable.id, batch.id));

    if (opts.dryRun) {
      throw new DryRunRollback();
    }
  };

  try {
    await db.transaction(run);
  } catch (err) {
    if (err instanceof DryRunRollback) {
      result.batchId = null;
      return result;
    }
    throw err;
  }

  return result;
}

class DryRunRollback extends Error {
  constructor() {
    super("DRY_RUN_ROLLBACK");
  }
}

/** Resolve default branch for a city slug (first active branch in city). */
export async function resolveDefaultBranch(citySlug?: string): Promise<number | null> {
  if (!citySlug) return null;
  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const [branch] = await db.select({ id: branchesTable.id })
    .from(branchesTable)
    .where(eq(branchesTable.city, cityName))
    .limit(1);
  return branch?.id ?? null;
}
