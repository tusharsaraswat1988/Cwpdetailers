import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { usersTable } from "./users";

// ============================================================================
// 1. Scheduled Jobs Table
// ============================================================================
export const scheduledJobsTable = pgTable("scheduled_jobs", {
  id: serial("id").primaryKey(),
  jobKey: text("job_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  jobType: text("job_type").notNull(),
  scheduleType: text("schedule_type").notNull().default("recurring_interval"), // 'one_time', 'recurring_interval', 'recurring_cron'
  cronExpression: text("cron_expression"),
  intervalSeconds: integer("interval_seconds"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  payload: jsonb("payload").default({}),
  cityId: integer("city_id").references(() => citiesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  status: text("status").notNull().default("active"), // 'active', 'paused', 'completed', 'failed', 'cancelled'
  isActive: boolean("is_active").notNull().default(true),
  runAt: timestamp("run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"), // 'success', 'failed', 'running'
  lastRunDurationMs: integer("last_run_duration_ms"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  backoffBaseSeconds: integer("backoff_base_seconds").notNull().default(30),
  backoffMaxSeconds: integer("backoff_max_seconds").notNull().default(3600),
  idempotencyKey: text("idempotency_key").unique(),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at"),
  leaseExpiresAt: timestamp("lease_expires_at"),
  lastError: text("last_error"),
  errorDetails: jsonb("error_details"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  alertThresholdFailures: integer("alert_threshold_failures").notNull().default(3),
  createdBy: integer("created_by").references(() => usersTable.id),
  updatedBy: integer("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduledJobSchema = createInsertSchema(scheduledJobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduledJobsTable.$inferSelect;

// ============================================================================
// 2. Job Execution History Table
// ============================================================================
export const jobExecutionHistoryTable = pgTable("job_execution_history", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => scheduledJobsTable.id),
  jobKey: text("job_key").notNull(),
  jobType: text("job_type").notNull(),
  cityId: integer("city_id").references(() => citiesTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  status: text("status").notNull(), // 'running', 'success', 'failed', 'cancelled', 'retrying'
  attempt: integer("attempt").notNull().default(1),
  triggerType: text("trigger_type").notNull().default("scheduled"), // 'scheduled', 'manual', 'retry'
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  workerId: text("worker_id"),
  sanitizedPayload: jsonb("sanitized_payload"),
  resultSummary: jsonb("result_summary"),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertJobExecutionHistorySchema = createInsertSchema(jobExecutionHistoryTable).omit({ id: true, createdAt: true });
export type InsertJobExecutionHistory = z.infer<typeof insertJobExecutionHistorySchema>;
export type JobExecutionHistory = typeof jobExecutionHistoryTable.$inferSelect;

// ============================================================================
// 3. Worker Heartbeats Table
// ============================================================================
export const workerHeartbeatsTable = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  hostname: text("hostname"),
  pid: integer("pid"),
  status: text("status").notNull().default("active"), // 'active', 'stopping', 'dead'
  concurrency: integer("concurrency").notNull().default(5),
  activeJobsCount: integer("active_jobs_count").notNull().default(0),
  lastHeartbeatAt: timestamp("last_heartbeat_at").notNull().defaultNow(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  metadata: jsonb("metadata"),
});

export const insertWorkerHeartbeatSchema = createInsertSchema(workerHeartbeatsTable);
export type InsertWorkerHeartbeat = z.infer<typeof insertWorkerHeartbeatSchema>;
export type WorkerHeartbeat = typeof workerHeartbeatsTable.$inferSelect;
