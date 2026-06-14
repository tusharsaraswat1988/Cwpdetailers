import { db } from "@workspace/db";
import { customersTable, commTimelineTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recordJourneyEvent } from "./communications/journeyService";

export type ReactivationTrigger = "manual" | "booking" | "subscription" | "status_change";

export const LEGACY_SEGMENT_CONTACT = "legacy_contact";

export function isLegacyDormantCustomer(customer: {
  status: string;
  legacySegment?: string | null;
}): boolean {
  return customer.status === "inactive" && customer.legacySegment === LEGACY_SEGMENT_CONTACT;
}

export function welcomeBackMessage(name: string): string {
  return `Welcome back, ${name}! We're glad to have you with CWP Detailers again. Your services are now active — book anytime or call us for help.`;
}

/** Reactivate a dormant legacy_contact customer and log welcome-back comms. */
export async function tryReactivateLegacyCustomer(
  customerId: number,
  trigger: ReactivationTrigger,
  entity?: { type: string; id: number },
): Promise<{ reactivated: boolean; customer?: typeof customersTable.$inferSelect }> {
  const [customer] = await db.select().from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);
  if (!customer || !isLegacyDormantCustomer(customer)) {
    return { reactivated: false };
  }

  const now = new Date();
  const [updated] = await db.update(customersTable).set({
    status: "active",
    reactivatedAt: now,
    legacySegment: null,
    updatedAt: now,
  }).where(eq(customersTable.id, customerId)).returning();

  await recordJourneyEvent({
    customerId,
    eventType: "customer_reactivated",
    title: "Customer reactivated",
    description: `Returned from legacy contacts via ${trigger}`,
    entityType: entity?.type ?? undefined,
    entityId: entity?.id ?? undefined,
    metadata: { trigger, previousSegment: LEGACY_SEGMENT_CONTACT },
    companyId: customer.companyId,
    occurredAt: now,
  });

  await db.insert(commTimelineTable).values({
    customerId,
    channel: "whatsapp",
    message: welcomeBackMessage(customer.name),
    subject: "Welcome back",
    status: "queued",
    deliveryStatus: "queued",
    companyId: customer.companyId,
    metadata: { type: "welcome_back", trigger, automated: true },
  });

  return { reactivated: true, customer: updated };
}
