import { db, staffTable, staffDocumentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computeProfileCompletion } from "./profileCompletion";

export async function recalculateStaffProfile(staffId: number) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  if (!staff) return;
  const docs = await db.select().from(staffDocumentsTable)
    .where(and(eq(staffDocumentsTable.staffId, staffId), eq(staffDocumentsTable.isCurrent, true)));
  const breakdown = computeProfileCompletion(staff, docs);
  await db.update(staffTable).set({
    profileCompletionPercent: breakdown.percent,
    identityComplete: breakdown.identityComplete,
    documentsComplete: breakdown.documentsComplete,
    bankComplete: breakdown.bankComplete,
    addressComplete: breakdown.addressComplete,
    updatedAt: new Date(),
  }).where(eq(staffTable.id, staffId));
}
