import {
  db,
  catalogPackageAddonsTable,
  serviceAddonsTable,
  type CatalogPackageAddon,
} from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";

export type PackageAddonInput = {
  addonId: number;
  extraPrice?: string | null;
  sortOrder?: number;
};

export type CatalogPackageAddonRow = CatalogPackageAddon & {
  addonName: string;
  addonBasePrice: string;
};

export async function getPackageAddons(packageId: number): Promise<CatalogPackageAddonRow[]> {
  const rows = await db
    .select({
      row: catalogPackageAddonsTable,
      addonName: serviceAddonsTable.name,
      addonBasePrice: serviceAddonsTable.basePrice,
    })
    .from(catalogPackageAddonsTable)
    .innerJoin(serviceAddonsTable, eq(catalogPackageAddonsTable.addonId, serviceAddonsTable.id))
    .where(eq(catalogPackageAddonsTable.packageId, packageId))
    .orderBy(asc(catalogPackageAddonsTable.sortOrder), asc(catalogPackageAddonsTable.id));

  return rows.map(r => ({
    ...r.row,
    addonName: r.addonName,
    addonBasePrice: r.addonBasePrice,
  }));
}

export async function getPackageAddonsForPackages(
  packageIds: number[],
): Promise<Map<number, CatalogPackageAddonRow[]>> {
  const map = new Map<number, CatalogPackageAddonRow[]>();
  if (!packageIds.length) return map;

  const rows = await db
    .select({
      row: catalogPackageAddonsTable,
      addonName: serviceAddonsTable.name,
      addonBasePrice: serviceAddonsTable.basePrice,
    })
    .from(catalogPackageAddonsTable)
    .innerJoin(serviceAddonsTable, eq(catalogPackageAddonsTable.addonId, serviceAddonsTable.id))
    .where(inArray(catalogPackageAddonsTable.packageId, packageIds))
    .orderBy(asc(catalogPackageAddonsTable.sortOrder), asc(catalogPackageAddonsTable.id));

  for (const r of rows) {
    const list = map.get(r.row.packageId) ?? [];
    list.push({
      ...r.row,
      addonName: r.addonName,
      addonBasePrice: r.addonBasePrice,
    });
    map.set(r.row.packageId, list);
  }
  return map;
}

export async function replacePackageAddons(
  packageId: number,
  addons: PackageAddonInput[],
): Promise<void> {
  await db.delete(catalogPackageAddonsTable).where(eq(catalogPackageAddonsTable.packageId, packageId));
  if (!addons.length) return;

  await db.insert(catalogPackageAddonsTable).values(
    addons.map((a, i) => ({
      packageId,
      addonId: a.addonId,
      extraPrice: a.extraPrice ?? null,
      sortOrder: a.sortOrder ?? i,
    })),
  );
}

export async function resolvePackageAddonPrice(addons: PackageAddonInput[]): Promise<number> {
  if (!addons.length) return 0;
  const ids = addons.map(a => a.addonId);
  const catalog = await db
    .select({ id: serviceAddonsTable.id, basePrice: serviceAddonsTable.basePrice })
    .from(serviceAddonsTable)
    .where(inArray(serviceAddonsTable.id, ids));
  const byId = new Map(catalog.map(a => [a.id, a.basePrice]));
  return addons.reduce((sum, a) => {
    const fallback = Number(byId.get(a.addonId) ?? 0);
    return sum + Number(a.extraPrice ?? fallback ?? 0);
  }, 0);
}
