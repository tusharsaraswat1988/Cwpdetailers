import { db } from "@workspace/db";
import { commBrandsTable, type CommBrand } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getPublicBranding } from "../brandIdentityService";

export async function listBrands(companyId?: number | null): Promise<CommBrand[]> {
  const conditions = companyId ? [eq(commBrandsTable.companyId, companyId)] : [];
  return db.select().from(commBrandsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(commBrandsTable.createdAt));
}

export async function getBrandById(id: number): Promise<CommBrand | null> {
  const [row] = await db.select().from(commBrandsTable).where(eq(commBrandsTable.id, id)).limit(1);
  return row ?? null;
}

export async function getBrandByCode(code: string, companyId?: number | null): Promise<CommBrand | null> {
  const conditions = [eq(commBrandsTable.code, code)];
  if (companyId) conditions.push(eq(commBrandsTable.companyId, companyId));
  const [row] = await db.select().from(commBrandsTable).where(and(...conditions)).limit(1);
  return row ?? null;
}

export async function seedDefaultBrands(companyId?: number | null): Promise<CommBrand[]> {
  const existing = await listBrands(companyId);
  if (existing.length) return existing;

  const branding = await getPublicBranding();
  const primary = {
    name: branding.brandName || branding.companyName || "Primary",
    code: "primary",
    primaryColor: branding.primaryColor,
  };
  const secondaryBrands = [
    { name: "Kleansolar", code: "kleansolar", primaryColor: "#059669" },
    { name: "DCC", code: "dcc", primaryColor: "#7c3aed" },
    { name: "BidWar", code: "bidwar", primaryColor: "#dc2626" },
  ];

  const rows = await db.insert(commBrandsTable).values(
    [primary, ...secondaryBrands].map(b => ({
      name: b.name,
      code: b.code,
      primaryColor: b.primaryColor,
      status: "active" as const,
      companyId: companyId ?? null,
    })),
  ).returning();
  return rows;
}

export async function resolveBrandId(
  brandId: number | null | undefined,
  companyId?: number | null,
): Promise<number | null> {
  if (brandId) return brandId;
  const brands = await seedDefaultBrands(companyId);
  const primary = brands.find(b => b.code === "primary" || b.code === "cwp");
  return primary?.id ?? brands[0]?.id ?? null;
}
