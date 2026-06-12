import { pgTable, serial, text, boolean, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const permissionsTable = pgTable("permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  allow: boolean("allow").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => ({
  rraIdx: uniqueIndex("permissions_role_resource_action_idx").on(t.role, t.resource, t.action),
}));

export const permissionOverridesTable = pgTable("permission_overrides", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  role: text("role"),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  allow: boolean("allow").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true, createdAt: true });
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissionsTable.$inferSelect;
export type PermissionOverride = typeof permissionOverridesTable.$inferSelect;
