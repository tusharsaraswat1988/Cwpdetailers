import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadIngestionLogTable = pgTable("lead_ingestion_log", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  rawPayload: text("raw_payload").notNull(),
  processedAt: timestamp("processed_at"),
  leadId: integer("lead_id"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadIngestionLogSchema = createInsertSchema(leadIngestionLogTable).omit({
  id: true, createdAt: true,
});
export type InsertLeadIngestionLog = z.infer<typeof insertLeadIngestionLogSchema>;
export type LeadIngestionLog = typeof leadIngestionLogTable.$inferSelect;
