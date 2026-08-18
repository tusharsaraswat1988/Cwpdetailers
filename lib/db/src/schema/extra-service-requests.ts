import {
  pgTable, serial, integer, text, numeric, timestamp, pgEnum, json, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Staff-proposed extra service awaiting explicit customer consent (Phase 2: Car Wash).
 * Structured so a later service kind can reuse the same request + OTP pattern.
 */
export const extraServiceRequestTypeEnum = pgEnum("extra_service_request_type", [
  "extra_car_wash",
]);

export const extraServiceRequestStatusEnum = pgEnum("extra_service_request_status", [
  "pending_customer_approval",
  "customer_approved",
  "otp_verified",
  "rejected",
  "cancelled",
]);

export const extraServiceCommercialSourceEnum = pgEnum("extra_service_commercial_source", [
  "DCC_INCLUDED",
  "PAID_EXTRA",
]);

export type ExtraServiceConsentSnapshot = {
  staffName: string;
  vehicleLabel: string;
  vehicleRegistration: string;
  serviceName: string;
  addonNames: string[];
  amountDisplay: string;
  commercialSource: "DCC_INCLUDED" | "PAID_EXTRA";
  entitlementLabel: string | null;
};

export const extraServiceRequestsTable = pgTable("extra_service_requests", {
  id: serial("id").primaryKey(),
  requestType: extraServiceRequestTypeEnum("request_type").notNull().default("extra_car_wash"),
  status: extraServiceRequestStatusEnum("status").notNull().default("pending_customer_approval"),
  customerId: integer("customer_id").notNull(),
  staffId: integer("staff_id").notNull(),
  vehicleId: integer("vehicle_id").notNull(),
  serviceId: integer("service_id").notNull(),
  addonIds: json("addon_ids").$type<number[]>().notNull().default([]),
  commercialSource: extraServiceCommercialSourceEnum("commercial_source").notNull(),
  dcmsSubscriptionId: integer("dcms_subscription_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  requestFingerprint: text("request_fingerprint").notNull(),
  consentSnapshot: json("consent_snapshot").$type<ExtraServiceConsentSnapshot>().notNull(),
  otpCodeHash: text("otp_code_hash"),
  /** Short-lived display copy — wiped after verify / expiry. Never logged. */
  otpCode: text("otp_code"),
  otpExpiresAt: timestamp("otp_expires_at"),
  otpAttemptCount: integer("otp_attempt_count").notNull().default(0),
  otpVerifiedAt: timestamp("otp_verified_at"),
  otpVerifiedByStaffId: integer("otp_verified_by_staff_id"),
  customerApprovedAt: timestamp("customer_approved_at"),
  customerRejectedAt: timestamp("customer_rejected_at"),
  entitlementConsumedAt: timestamp("entitlement_consumed_at"),
  bookingId: integer("booking_id"),
  executionId: integer("execution_id"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => [
  index("extra_svc_req_customer_status_idx").on(t.customerId, t.status),
  index("extra_svc_req_staff_status_idx").on(t.staffId, t.status),
  index("extra_svc_req_execution_idx").on(t.executionId),
  uniqueIndex("extra_svc_req_booking_unique").on(t.bookingId),
]);

export const insertExtraServiceRequestSchema = createInsertSchema(extraServiceRequestsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type ExtraServiceRequest = typeof extraServiceRequestsTable.$inferSelect;
export type InsertExtraServiceRequest = z.infer<typeof insertExtraServiceRequestSchema>;
export type ExtraServiceRequestStatus = typeof extraServiceRequestStatusEnum.enumValues[number];
export type ExtraServiceCommercialSource = typeof extraServiceCommercialSourceEnum.enumValues[number];
export type ExtraServiceRequestType = typeof extraServiceRequestTypeEnum.enumValues[number];
