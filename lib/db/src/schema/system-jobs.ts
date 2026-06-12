import { pgTable, serial, text, timestamp, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobStatusEnum = pgEnum("system_job_status", ["pending", "running", "success", "failed"]);

export const systemJobsTable = pgTable("system_jobs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  payload: json("payload"),
  runAt: timestamp("run_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastRunAt: timestamp("last_run_at"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSystemJobSchema = createInsertSchema(systemJobsTable).omit({ id: true, createdAt: true });
export type InsertSystemJob = z.infer<typeof insertSystemJobSchema>;
export type SystemJob = typeof systemJobsTable.$inferSelect;
