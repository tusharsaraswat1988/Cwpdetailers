import {

  pgTable, serial, integer, numeric, date, timestamp, pgEnum, text, boolean, doublePrecision, json, uniqueIndex, index,

} from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";

import { z } from "zod/v4";



export const dcmsSubscriptionStatusEnum = pgEnum("dcms_subscription_status", [

  "active", "paused", "completed", "expired", "cancelled",

]);



export const dcmsSubscriptionTypeEnum = pgEnum("dcms_subscription_type", [

  "daily_cleaning", "solar_amc", "housekeeping", "driver_service", "security_service",

]);



export const dcmsVisitTypeEnum = pgEnum("dcms_visit_type", ["cleaning", "wash"]);



export const dcmsVisitStatusEnum = pgEnum("dcms_visit_status", ["completed", "rejected"]);



export const dcmsPauseActionEnum = pgEnum("dcms_pause_action", [

  "pause", "resume", "pause_requested", "pause_approved", "pause_rejected",

]);



export const dcmsPauseApprovalStatusEnum = pgEnum("dcms_pause_approval_status", [

  "pending", "approved", "rejected",

]);



export const dcmsNotificationEventTypeEnum = pgEnum("dcms_notification_event_type", [

  "visit_completed", "visit_rejected", "subscription_paused", "subscription_resumed",

  "renewal_eligible", "missed_visit",

  "vehicle_assigned", "route_updated", "daily_route_available", "feedback_requested",

  "fraud_alert", "negative_feedback", "renewal_opportunity", "high_missed_visits",

]);



/** Reusable subscription plan template (Daily Car Cleaning first consumer). */

export const dcmsPlansTable = pgTable("dcms_plans", {

  id: serial("id").primaryKey(),

  name: text("name").notNull(),

  description: text("description"),

  price: numeric("price", { precision: 10, scale: 2 }).notNull(),

  includedCleanings: integer("included_cleanings").notNull(),

  includedWashes: integer("included_washes").notNull().default(0),

  weeklyOffs: integer("weekly_offs").notNull().default(1),

  vehicleCategoryId: integer("vehicle_category_id"),

  seatCategoryId: integer("seat_category_id"),

  isActive: boolean("is_active").notNull().default(true),

  showOnHomepage: boolean("show_on_homepage").notNull().default(false),

  companyId: integer("company_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),

});



/** Add-ons bundled with a DCMS plan (from service catalog). */

export const dcmsPlanAddonsTable = pgTable("dcms_plan_addons", {

  id: serial("id").primaryKey(),

  planId: integer("plan_id").notNull(),

  addonId: integer("addon_id").notNull(),

  includedCleanings: integer("included_cleanings").notNull().default(0),

  includedWashes: integer("included_washes").notNull().default(0),

  extraPrice: numeric("extra_price", { precision: 10, scale: 2 }),

  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),

});



/** Vehicle-bound subscription instance with visit/wash consumption counters. */

export const dcmsSubscriptionsTable = pgTable("dcms_subscriptions", {

  id: serial("id").primaryKey(),

  customerId: integer("customer_id").notNull(),

  vehicleId: integer("vehicle_id").notNull(),

  planId: integer("plan_id").notNull(),

  subscriptionType: dcmsSubscriptionTypeEnum("subscription_type").notNull().default("daily_cleaning"),

  startDate: date("start_date").notNull(),

  allocatedCleanings: integer("allocated_cleanings").notNull(),

  allocatedWashes: integer("allocated_washes").notNull().default(0),

  usedCleanings: integer("used_cleanings").notNull().default(0),

  usedWashes: integer("used_washes").notNull().default(0),

  remainingCleanings: integer("remaining_cleanings").notNull(),

  remainingWashes: integer("remaining_washes").notNull().default(0),

  missedCleanings: integer("missed_cleanings").notNull().default(0),

  status: dcmsSubscriptionStatusEnum("status").notNull().default("active"),

  pauseStartDate: date("pause_start_date"),

  pauseEndDate: date("pause_end_date"),

  pauseReason: text("pause_reason"),

  version: integer("version").notNull().default(1),

  companyId: integer("company_id"),

  franchiseeId: integer("franchisee_id"),

  branchId: integer("branch_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),

}, t => ({

  statusIdx: index("idx_dcms_subscriptions_status").on(t.status),

  customerIdx: index("idx_dcms_subscriptions_customer").on(t.customerId),

}));



export const dcmsSubscriptionLocationsTable = pgTable("dcms_subscription_locations", {

  id: serial("id").primaryKey(),

  subscriptionId: integer("subscription_id").notNull(),

  latitude: doublePrecision("latitude").notNull(),

  longitude: doublePrecision("longitude").notNull(),

  radiusMeters: integer("radius_meters").notNull().default(100),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),

});



export const dcmsStaffAssignmentsTable = pgTable("dcms_staff_assignments", {

  id: serial("id").primaryKey(),

  subscriptionId: integer("subscription_id").notNull(),

  staffId: integer("staff_id").notNull(),

  assignedBy: integer("assigned_by"),

  assignedAt: timestamp("assigned_at").notNull().defaultNow(),

  routeOrder: integer("route_order").notNull().default(0),

  isActive: boolean("is_active").notNull().default(true),

});



export const dcmsVisitsTable = pgTable("dcms_visits", {

  id: serial("id").primaryKey(),

  subscriptionId: integer("subscription_id").notNull(),

  vehicleId: integer("vehicle_id").notNull(),

  staffId: integer("staff_id").notNull(),

  visitType: dcmsVisitTypeEnum("visit_type").notNull().default("cleaning"),

  photoUrl: text("photo_url"),

  visitTime: timestamp("visit_time").notNull().defaultNow(),

  visitDate: date("visit_date"),

  status: dcmsVisitStatusEnum("status").notNull().default("completed"),

  exifJson: json("exif_json").$type<Record<string, unknown>>(),

  latitude: doublePrecision("latitude"),

  longitude: doublePrecision("longitude"),

  accuracy: doublePrecision("accuracy"),

  rejectionReason: text("rejection_reason"),

  ocrText: text("ocr_text"),

  ocrConfidence: doublePrecision("ocr_confidence"),

  confirmedRegistration: text("confirmed_registration"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

}, t => ({

  subDateIdx: index("idx_dcms_visits_sub_date").on(t.subscriptionId, t.visitDate),

  staffStatusIdx: index("idx_dcms_visits_staff_status").on(t.staffId, t.status),

}));



export const dcmsActivityLogsTable = pgTable("dcms_activity_logs", {

  id: serial("id").primaryKey(),

  subscriptionId: integer("subscription_id"),

  action: text("action").notNull(),

  entityType: text("entity_type").notNull(),

  entityId: integer("entity_id"),

  performedBy: integer("performed_by"),

  metadataJson: json("metadata_json").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),

});



export const dcmsMissedVisitLogsTable = pgTable("dcms_missed_visit_logs", {

  id: serial("id").primaryKey(),

  subscriptionId: integer("subscription_id").notNull(),

  visitDate: date("visit_date").notNull(),

  reason: text("reason").notNull().default("no_cleaning_completed"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

}, t => ({

  uniqueSubDate: uniqueIndex("dcms_missed_visit_logs_sub_date_unique").on(t.subscriptionId, t.visitDate),

  dateIdx: index("idx_dcms_missed_logs_date").on(t.visitDate),

}));



export const dcmsPauseHistoryTable = pgTable("dcms_pause_history", {

  id: serial("id").primaryKey(),

  subscriptionId: integer("subscription_id").notNull(),

  action: dcmsPauseActionEnum("action").notNull(),

  pauseStartDate: date("pause_start_date"),

  pauseEndDate: date("pause_end_date"),

  pauseReason: text("pause_reason"),

  approvalStatus: dcmsPauseApprovalStatusEnum("approval_status"),

  performedBy: integer("performed_by"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

}, t => ({

  subIdx: index("idx_dcms_pause_history_sub").on(t.subscriptionId),

}));



export const dcmsVisitFeedbackTable = pgTable("dcms_visit_feedback", {

  id: serial("id").primaryKey(),

  visitId: integer("visit_id").notNull(),

  customerId: integer("customer_id").notNull(),

  rating: text("rating").notNull(),

  comment: text("comment"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

}, t => ({

  visitUnique: uniqueIndex("dcms_visit_feedback_visit_unique").on(t.visitId),

  customerIdx: index("idx_dcms_visit_feedback_customer").on(t.customerId),

}));



export const notificationEventsTable = pgTable("notification_events", {

  id: serial("id").primaryKey(),

  eventType: dcmsNotificationEventTypeEnum("event_type").notNull(),

  entityType: text("entity_type").notNull(),

  entityId: integer("entity_id").notNull(),

  payload: json("payload").$type<Record<string, unknown>>().notNull().default({}),

  processedAt: timestamp("processed_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),

}, t => ({

  typeIdx: index("idx_notification_events_type").on(t.eventType),

}));



export const notificationEventLogsTable = pgTable("notification_event_logs", {

  id: serial("id").primaryKey(),

  eventId: integer("event_id").notNull(),

  action: text("action").notNull().default("created"),

  metadata: json("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),

});



export const insertDcmsPlanSchema = createInsertSchema(dcmsPlansTable).omit({ id: true, createdAt: true, updatedAt: true });

export const insertDcmsSubscriptionSchema = createInsertSchema(dcmsSubscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });

export const insertDcmsVisitSchema = createInsertSchema(dcmsVisitsTable).omit({ id: true, createdAt: true });



export type DcmsPlan = typeof dcmsPlansTable.$inferSelect;

export type DcmsPlanAddon = typeof dcmsPlanAddonsTable.$inferSelect;

export type InsertDcmsPlan = z.infer<typeof insertDcmsPlanSchema>;

export type DcmsSubscription = typeof dcmsSubscriptionsTable.$inferSelect;

export type InsertDcmsSubscription = z.infer<typeof insertDcmsSubscriptionSchema>;

export type DcmsVisit = typeof dcmsVisitsTable.$inferSelect;

export type DcmsActivityLog = typeof dcmsActivityLogsTable.$inferSelect;

export type DcmsMissedVisitLog = typeof dcmsMissedVisitLogsTable.$inferSelect;

export type DcmsPauseHistory = typeof dcmsPauseHistoryTable.$inferSelect;

export type DcmsVisitFeedback = typeof dcmsVisitFeedbackTable.$inferSelect;

export type NotificationEvent = typeof notificationEventsTable.$inferSelect;


