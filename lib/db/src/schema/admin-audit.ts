import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminAuditLogsTable = pgTable(
  "admin_audit_logs",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    cityId: integer("city_id"),
    branchId: integer("branch_id"),
    performedBy: integer("performed_by").notNull(),
    reason: text("reason"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("idx_admin_audit_entity").on(t.entityType, t.entityId),
    actionIdx: index("idx_admin_audit_action").on(t.action),
    branchIdx: index("idx_admin_audit_branch").on(t.branchId),
    createdIdx: index("idx_admin_audit_created").on(t.createdAt),
  }),
);

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogsTable).omit({
  id: true,
  createdAt: true,
});

export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
