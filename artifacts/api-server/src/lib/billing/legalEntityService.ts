import { db } from "@workspace/db";
import {
  legalEntitiesTable,
  invoiceNumberSequencesTable,
  branchesTable,
  franchiseesTable,
  invoicesTable,
  type LegalEntity,
  type InvoiceLegalEntitySnapshot,
  type InvoiceDocumentType,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { financialYearLabel } from "./invoiceGstEngine";
import type { Transaction } from "../../subscriptions/service";

export type ResolveLegalEntityInput = {
  legalEntityId?: number | null;
  branchId?: number | null;
  franchiseeId?: number | null;
};

const DEFAULT_FALLBACK_ENTITY: LegalEntity = {
  id: 1,
  code: "CWP_VNS_CORP",
  name: "CWP Detailers and Motors",
  tradeName: "CWP Detailers",
  entityType: "company",
  gstin: "09BYWPS9468R3ZG",
  panNumber: "BYWPS9468R",
  stateCode: "09",
  stateName: "Uttar Pradesh",
  addressLine1: "0, Near Ishita School Seer Goverdhanpur",
  addressLine2: null,
  city: "Varanasi",
  pincode: "221011",
  phone: "7054007733",
  email: "cwpdetailers@gmail.com",
  website: "www.cwpdetailers.in",
  bankAccountName: "CWP DETAILERS AND MOTORS",
  bankName: "State Bank of India, BHELUPURA",
  bankAccountNumber: "42105505194",
  bankIfsc: "SBIN0001773",
  bankBranch: "Bhelupura",
  upiId: "pinelabs.stq4501838@pineaxis",
  defaultSac: "998533",
  invoicePrefix: "CWP",
  isActive: true,
  isDefault: true,
  termsAndConditions: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Resolves the authoritative responsible billing legal entity for an operation.
 * Hierarchy:
 * 1. Explicit legalEntityId
 * 2. Branch's assigned legalEntityId
 * 3. Franchisee's assigned legalEntityId
 * 4. Default company legal entity (isDefault = true or first active)
 * 5. Fallback baseline corporate entity
 */
export async function resolveLegalEntity(
  input: ResolveLegalEntityInput,
  tx?: Transaction,
): Promise<LegalEntity> {
  const ctx = tx ?? db;

  // 1. Explicit entity
  if (input.legalEntityId) {
    const [entity] = await ctx
      .select()
      .from(legalEntitiesTable)
      .where(eq(legalEntitiesTable.id, input.legalEntityId))
      .limit(1);
    if (entity && entity.isActive) return entity;
  }

  // 2. Via Branch
  if (input.branchId) {
    const [branch] = await ctx
      .select({ legalEntityId: branchesTable.legalEntityId })
      .from(branchesTable)
      .where(eq(branchesTable.id, input.branchId))
      .limit(1);
    if (branch?.legalEntityId) {
      const [entity] = await ctx
        .select()
        .from(legalEntitiesTable)
        .where(eq(legalEntitiesTable.id, branch.legalEntityId))
        .limit(1);
      if (entity && entity.isActive) return entity;
    }
  }

  // 3. Via Franchisee
  if (input.franchiseeId) {
    const [franchisee] = await ctx
      .select({ legalEntityId: franchiseesTable.legalEntityId })
      .from(franchiseesTable)
      .where(eq(franchiseesTable.id, input.franchiseeId))
      .limit(1);
    if (franchisee?.legalEntityId) {
      const [entity] = await ctx
        .select()
        .from(legalEntitiesTable)
        .where(eq(legalEntitiesTable.id, franchisee.legalEntityId))
        .limit(1);
      if (entity && entity.isActive) return entity;
    }
  }

  // 4. Default company entity
  const [defaultEntity] = await ctx
    .select()
    .from(legalEntitiesTable)
    .where(and(eq(legalEntitiesTable.isDefault, true), eq(legalEntitiesTable.isActive, true)))
    .limit(1);
  if (defaultEntity) return defaultEntity;

  // 5. First active entity
  const [firstActive] = await ctx
    .select()
    .from(legalEntitiesTable)
    .where(eq(legalEntitiesTable.isActive, true))
    .limit(1);
  if (firstActive) return firstActive;

  return DEFAULT_FALLBACK_ENTITY;
}

/**
 * Creates an immutable snapshot of the issuing legal entity for storage on the invoice.
 * Preserves historical invoice correctness regardless of future business or address changes.
 */
export function buildLegalEntitySnapshot(entity: LegalEntity): InvoiceLegalEntitySnapshot {
  const addressParts = [entity.addressLine1, entity.addressLine2].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  return {
    id: entity.id,
    code: entity.code,
    name: entity.name,
    tradeName: entity.tradeName,
    entityType: entity.entityType,
    gstin: entity.gstin,
    panNumber: entity.panNumber,
    stateCode: entity.stateCode,
    stateName: entity.stateName,
    address: fullAddress,
    city: entity.city,
    pincode: entity.pincode,
    phone: entity.phone,
    email: entity.email,
    website: entity.website,
    bankAccountName: entity.bankAccountName,
    bankName: entity.bankName,
    bankAccountNumber: entity.bankAccountNumber,
    bankIfsc: entity.bankIfsc,
    upiId: entity.upiId,
    defaultSac: entity.defaultSac,
    invoicePrefix: entity.invoicePrefix,
  };
}

/**
 * Atomically generates the next concurrency-safe document number for an entity and series.
 * Prevents gaps, duplicates, and race conditions by leveraging atomic PostgreSQL row upsert.
 */
export async function generateLegalEntityDocumentNumber(opts: {
  legalEntity: LegalEntity;
  documentType?: InvoiceDocumentType;
  tx?: Transaction;
}): Promise<string> {
  const ctx = opts.tx ?? db;
  const docType = opts.documentType ?? "tax_invoice";
  const fy = financialYearLabel();
  const rawPrefix = opts.legalEntity.invoicePrefix.trim() || "CWP";

  const prefix = docType === "credit_note"
    ? `${rawPrefix}/CN/${fy}/`
    : docType === "debit_note"
      ? `${rawPrefix}/DN/${fy}/`
      : `${rawPrefix}/${fy}/`;

  // First check if a sequence row exists to seed from legacy max if starting fresh
  const [existingSeq] = await ctx
    .select()
    .from(invoiceNumberSequencesTable)
    .where(and(
      eq(invoiceNumberSequencesTable.legalEntityId, opts.legalEntity.id),
      eq(invoiceNumberSequencesTable.documentType, docType),
      eq(invoiceNumberSequencesTable.financialYear, fy),
    ))
    .limit(1);

  let initialSeed = 0;
  if (!existingSeq) {
    // Check max from existing invoices matching prefix to prevent duplicate collision with legacy records
    const [maxRow] = await ctx
      .select({
        maxNum: sql<string>`max(cast(substring(${invoicesTable.invoiceNumber} from '[0-9]+$') as integer))`,
      })
      .from(invoicesTable)
      .where(sql`${invoicesTable.invoiceNumber} like ${prefix + "%"}`);
    initialSeed = maxRow?.maxNum ? parseInt(maxRow.maxNum, 10) : 0;
  }

  // Atomic upsert with Postgres ON CONFLICT increment
  const [upserted] = await ctx
    .insert(invoiceNumberSequencesTable)
    .values({
      legalEntityId: opts.legalEntity.id,
      documentType: docType,
      financialYear: fy,
      currentValue: Math.max(initialSeed, 1000) + 1,
      prefix,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        invoiceNumberSequencesTable.legalEntityId,
        invoiceNumberSequencesTable.documentType,
        invoiceNumberSequencesTable.financialYear,
      ],
      set: {
        currentValue: sql`${invoiceNumberSequencesTable.currentValue} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ currentValue: invoiceNumberSequencesTable.currentValue });

  const seqNumber = upserted?.currentValue ?? (Math.max(initialSeed, 1000) + 1);
  return `${prefix}${seqNumber}`;
}
