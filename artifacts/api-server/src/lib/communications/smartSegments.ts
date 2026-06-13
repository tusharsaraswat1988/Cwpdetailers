import { db } from "@workspace/db";
import { commSmartSegmentsTable, type AudienceFilterNode } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";

export type SystemSegmentDef = {
  segmentKey: string;
  name: string;
  description: string;
  configJson: AudienceFilterNode;
};

export const SYSTEM_SMART_SEGMENTS: SystemSegmentDef[] = [
  {
    segmentKey: "payment_due_gt_1000",
    name: "Payment Due > ₹1000",
    description: "Customers with outstanding dues exceeding ₹1,000",
    configJson: { type: "filter", filter: "payment_due_gt", params: { minAmount: 1000 } },
  },
  {
    segmentKey: "no_visit_30_days",
    name: "No Visit Since 30 Days",
    description: "No completed service in the last 30 days",
    configJson: { type: "filter", filter: "no_visit_since_days", params: { days: 30 } },
  },
  {
    segmentKey: "no_visit_60_days",
    name: "No Visit Since 60 Days",
    description: "No completed service in the last 60 days",
    configJson: { type: "filter", filter: "no_visit_since_days", params: { days: 60 } },
  },
  {
    segmentKey: "no_visit_90_days",
    name: "No Visit Since 90 Days",
    description: "No completed service in the last 90 days",
    configJson: { type: "filter", filter: "no_visit_since_days", params: { days: 90 } },
  },
  {
    segmentKey: "package_expiring_15_days",
    name: "Package Expiring Within 15 Days",
    description: "Active subscriptions ending within 15 days",
    configJson: { type: "filter", filter: "expiring_package", params: { days: 15 } },
  },
  {
    segmentKey: "package_expiring_30_days",
    name: "Package Expiring Within 30 Days",
    description: "Active subscriptions ending within 30 days",
    configJson: { type: "filter", filter: "expiring_package", params: { days: 30 } },
  },
  {
    segmentKey: "ceramic_coating_customers",
    name: "Ceramic Coating Customers",
    description: "Customers with ceramic coating service history",
    configJson: { type: "filter", filter: "ceramic_coating_customers" },
  },
  {
    segmentKey: "ppf_customers",
    name: "PPF Customers",
    description: "Customers with PPF service history",
    configJson: { type: "filter", filter: "ppf_customers" },
  },
  {
    segmentKey: "high_value_customers",
    name: "High Value Customers",
    description: "Active subscriptions worth ₹5,000+",
    configJson: { type: "filter", filter: "high_value_customers" },
  },
  {
    segmentKey: "birthday_this_month",
    name: "Birthday This Month",
    description: "Customers with birthday in the current month",
    configJson: { type: "filter", filter: "birthday_this_month" },
  },
  {
    segmentKey: "anniversary_this_month",
    name: "Anniversary This Month",
    description: "Customer anniversary (join date) this month",
    configJson: { type: "filter", filter: "anniversary_this_month" },
  },
  {
    segmentKey: "inactive_leads",
    name: "Inactive Leads",
    description: "Lost leads or cold leads with no response",
    configJson: { type: "group", operator: "OR", children: [
      { type: "filter", filter: "lost_leads" },
      { type: "filter", filter: "cold_leads" },
    ]},
  },
  {
    segmentKey: "converted_leads",
    name: "Converted Leads",
    description: "Leads converted to booked or subscription",
    configJson: { type: "filter", filter: "converted_leads" },
  },
  {
    segmentKey: "franchise_customers",
    name: "Franchise Customers",
    description: "Customers assigned to a franchisee",
    configJson: { type: "filter", filter: "franchise_customers" },
  },
  {
    segmentKey: "open_complaints",
    name: "Customers With Open Complaints",
    description: "Customers with unresolved complaints",
    configJson: { type: "filter", filter: "open_complaints" },
  },
];

export async function ensureSystemSmartSegments(companyId?: number | null) {
  for (const seg of SYSTEM_SMART_SEGMENTS) {
    const scope = companyId ?? null;
    const [existing] = await db.select({ id: commSmartSegmentsTable.id })
      .from(commSmartSegmentsTable)
      .where(and(
        eq(commSmartSegmentsTable.segmentKey, seg.segmentKey),
        scope ? eq(commSmartSegmentsTable.companyId, scope) : isNull(commSmartSegmentsTable.companyId),
      )).limit(1);

    if (!existing) {
      await db.insert(commSmartSegmentsTable).values({
        name: seg.name,
        description: seg.description,
        segmentKey: seg.segmentKey,
        configJson: seg.configJson,
        isSystem: true,
        active: true,
        companyId: scope,
      });
    }
  }
}

export async function listSmartSegments(companyId?: number | null) {
  await ensureSystemSmartSegments(companyId);
  const rows = await db.select().from(commSmartSegmentsTable)
    .where(eq(commSmartSegmentsTable.active, true));

  if (!companyId) return rows.filter(r => r.companyId == null);
  return rows.filter(r => r.companyId == null || r.companyId === companyId);
}

export async function resolveSmartSegmentFilter(segmentKey: string, companyId?: number | null): Promise<AudienceFilterNode | null> {
  const [row] = await db.select().from(commSmartSegmentsTable)
    .where(and(
      eq(commSmartSegmentsTable.segmentKey, segmentKey),
      eq(commSmartSegmentsTable.active, true),
      companyId
        ? or(isNull(commSmartSegmentsTable.companyId), eq(commSmartSegmentsTable.companyId, companyId))
        : undefined,
    )).limit(1);

  if (row) return row.configJson;

  const system = SYSTEM_SMART_SEGMENTS.find(s => s.segmentKey === segmentKey);
  return system?.configJson ?? null;
}

export async function createCustomSmartSegment(
  data: { name: string; description?: string; segmentKey: string; configJson: AudienceFilterNode; companyId?: number | null },
) {
  const [row] = await db.insert(commSmartSegmentsTable).values({
    name: data.name,
    description: data.description,
    segmentKey: data.segmentKey,
    configJson: data.configJson,
    isSystem: false,
    active: true,
    companyId: data.companyId ?? null,
  }).returning();
  return row!;
}
