import { db } from "@workspace/db";
import { customersTable, leadsTable, leadActivitiesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { normalizeIndianMobile } from "./contactFields";

export type InboundChannel = "whatsapp" | "sms" | "call";

export type InboundContactResult = {
  customerId: number | null;
  leadId: number | null;
  createdLead: boolean;
};

export async function resolveOrCreateInboundContact(
  rawPhone: string,
  opts: {
    companyId?: number | null;
    franchiseeId?: number | null;
    branchId?: number | null;
    channel: InboundChannel;
  },
): Promise<InboundContactResult> {
  const normalized = normalizeIndianMobile(rawPhone.replace(/\D/g, "").slice(-10));
  if (!normalized) {
    return { customerId: null, leadId: null, createdLead: false };
  }

  const phoneMatch = sql`RIGHT(REGEXP_REPLACE(${customersTable.phone}, '[^0-9]', '', 'g'), 10) = ${normalized.slice(-10)}`;
  const customerConditions = [phoneMatch];
  if (opts.companyId) customerConditions.push(eq(customersTable.companyId, opts.companyId));

  const [customer] = await db.select({ id: customersTable.id }).from(customersTable).where(and(...customerConditions)).limit(1);
  if (customer) return { customerId: customer.id, leadId: null, createdLead: false };

  const leadPhoneMatch = sql`RIGHT(REGEXP_REPLACE(${leadsTable.phone}, '[^0-9]', '', 'g'), 10) = ${normalized.slice(-10)}`;
  const leadConditions = [leadPhoneMatch];
  if (opts.companyId) leadConditions.push(eq(leadsTable.companyId, opts.companyId));

  const [lead] = await db.select({ id: leadsTable.id, customerId: leadsTable.customerId }).from(leadsTable).where(and(...leadConditions)).limit(1);
  if (lead) return { customerId: lead.customerId, leadId: lead.id, createdLead: false };

  const source = opts.channel === "whatsapp" ? "whatsapp" as const : "call" as const;
  const [newLead] = await db.insert(leadsTable).values({
    name: `Inbound ${normalized}`,
    phone: normalized,
    source,
    status: "new",
    notes: `Auto-created from ${opts.channel} inbound message`,
    companyId: opts.companyId ?? null,
    franchiseeId: opts.franchiseeId ?? null,
    branchId: opts.branchId ?? null,
  }).returning();

  await db.insert(leadActivitiesTable).values({
    leadId: newLead.id,
    type: "note",
    body: `Inbound ${opts.channel} contact auto-registered as lead`,
    createdBy: null,
  });

  return { customerId: null, leadId: newLead.id, createdLead: true };
}
