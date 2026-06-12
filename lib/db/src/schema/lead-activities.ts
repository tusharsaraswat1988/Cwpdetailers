import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadActivityTypeEnum = pgEnum("lead_activity_type", [
  "note", "call", "whatsapp", "email", "status_change", "follow_up_scheduled", "converted",
]);

export const leadActivitiesTable = pgTable("lead_activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  type: leadActivityTypeEnum("type").notNull(),
  body: text("body").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadActivitySchema = createInsertSchema(leadActivitiesTable).omit({
  id: true, createdAt: true,
});
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivitiesTable.$inferSelect;
