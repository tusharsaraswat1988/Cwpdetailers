import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { normalizeIndianMobile } from "./contactFields";

/** Legacy rows may store +91 / 91 / leading-0 variants — try all canonical forms. */
function phoneLookupVariants(phone: string): string[] {
  const normalized = normalizeIndianMobile(phone) ?? phone;
  const variants = new Set<string>([normalized, phone]);
  if (normalized.length === 10) {
    variants.add(`91${normalized}`);
    variants.add(`0${normalized}`);
    variants.add(`+91${normalized}`);
  }
  return [...variants];
}

/** Find a user by phone, normalizing input and repairing legacy stored formats. */
export async function findUserByPhone(phone: string) {
  const normalized = normalizeIndianMobile(phone) ?? phone;

  const exact = await db.select().from(usersTable).where(eq(usersTable.phone, normalized)).limit(1);
  if (exact[0]) return exact[0];

  for (const variant of phoneLookupVariants(phone)) {
    if (variant === normalized) continue;
    const rows = await db.select().from(usersTable).where(eq(usersTable.phone, variant)).limit(1);
    if (!rows[0]) continue;

    const [repaired] = await db
      .update(usersTable)
      .set({ phone: normalized, updatedAt: new Date() })
      .where(eq(usersTable.id, rows[0].id))
      .returning();
    return repaired ?? { ...rows[0], phone: normalized };
  }

  return undefined;
}

export async function findUserByLoginIdentifier(phone?: string, email?: string) {
  if (phone) return findUserByPhone(phone);
  if (email) {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    return rows[0];
  }
  return undefined;
}
