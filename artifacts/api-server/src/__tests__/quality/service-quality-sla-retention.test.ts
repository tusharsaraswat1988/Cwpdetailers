import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  submitVisitFeedback,
} from "../../lib/quality/visitFeedbackService";
import {
  resolveSlaPolicy,
  calculateSlaDeadlines,
  handleSlaClockTransition,
  evaluateTicketSla,
} from "../../lib/quality/slaService";
import {
  processCustomerCancellation,
  CANCELLATION_REASONS,
} from "../../lib/retention/retentionService";
import {
  dispatchNotification,
} from "../../lib/notifications/dispatcher";

// Mock state
const state = {
  visits: [] as any[],
  subscriptions: [] as any[],
  customers: [] as any[],
  feedback: [] as any[],
  complaints: [] as any[],
  policies: [] as any[],
  escalations: [] as any[],
  notifications: [] as any[],
  consents: [] as any[],
  assignments: [] as any[],
  auditLogs: [] as any[],
};

function extractParamValues(expr: any): any[] {
  const vals: any[] = [];
  if (expr == null) return vals;
  if (typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") {
    vals.push(expr);
    return vals;
  }
  if (Array.isArray(expr)) {
    for (const item of expr) vals.push(...extractParamValues(item));
    return vals;
  }
  if (expr.constructor && expr.constructor.name === "Param") {
    vals.push(expr.value);
    return vals;
  }
  if (expr.value !== undefined && typeof expr.value !== "object") {
    vals.push(expr.value);
    return vals;
  }
  if (expr.queryChunks && Array.isArray(expr.queryChunks)) {
    for (const chunk of expr.queryChunks) {
      if (chunk == null) continue;
      if (chunk.constructor && chunk.constructor.name === "StringChunk") continue;
      vals.push(...extractParamValues(chunk));
    }
  }
  return vals;
}

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => {
        return {
          from: vi.fn((table: any) => {
            let lastCondition: any = null;

            const builder: any = {
              innerJoin: vi.fn(() => builder),
              leftJoin: vi.fn(() => builder),
              where: vi.fn((condition: any) => {
                lastCondition = condition;
                return builder;
              }),
              orderBy: vi.fn(() => builder),
              groupBy: vi.fn(() => builder),
              limit: vi.fn((lim: number) => {
                const params = extractParamValues(lastCondition);

                if (table === actual.dcmsVisitsTable) {
                  const filtered = state.visits.filter((v) => params.includes(v.id));
                  return Promise.resolve(filtered.slice(0, lim));
                }
                if (table === actual.dcmsSubscriptionsTable) {
                  const filtered = state.subscriptions.filter((s) => params.includes(s.id));
                  return Promise.resolve(filtered.slice(0, lim));
                }
                if (table === actual.customersTable) {
                  const filtered = state.customers.filter((c) => params.includes(c.id));
                  return Promise.resolve(filtered.slice(0, lim));
                }
                if (table === actual.dcmsVisitFeedbackTable) {
                  const filtered = state.feedback.filter((f) => params.includes(f.visitId));
                  return Promise.resolve(filtered.slice(0, lim));
                }
                if (table === actual.complaintsTable) {
                  const filtered = state.complaints.filter((c) => params.includes(c.id));
                  return Promise.resolve(filtered.slice(0, lim));
                }
                if (table === actual.slaPoliciesTable) {
                  return Promise.resolve(state.policies.filter((p) => p.isActive).slice(0, lim));
                }
                if (table === actual.commCustomerConsentsTable) {
                  const filtered = state.consents.filter((c) => params.includes(c.customerId));
                  return Promise.resolve(filtered.slice(0, lim));
                }
                return Promise.resolve([]);
              }),
              then: (resolve: any) => {
                if (table === actual.slaPoliciesTable) {
                  resolve(state.policies.filter((p) => p.isActive));
                } else if (table === actual.commCustomerConsentsTable) {
                  resolve(state.consents);
                } else {
                  resolve([]);
                }
              },
            };
            return builder;
          }),
        };
      }),
      insert: vi.fn((table: any) => {
        return {
          values: vi.fn((vals: any) => {
            const row = { id: Math.floor(Math.random() * 100000) + 1, ...vals };
            if (table === actual.dcmsVisitFeedbackTable) {
              state.feedback.push(row);
            } else if (table === actual.complaintsTable) {
              state.complaints.push(row);
            } else if (table === actual.slaEscalationLogsTable) {
              state.escalations.push(row);
            } else if (table === actual.notificationsTable) {
              state.notifications.push(row);
            }
            return {
              returning: vi.fn(() => Promise.resolve([row])),
              then: (resolve: any) => resolve([row]),
            };
          }),
        };
      }),
      update: vi.fn((table: any) => {
        return {
          set: vi.fn((updates: any) => {
            return {
              where: vi.fn((condition: any) => {
                const params = extractParamValues(condition);
                let updatedRow: any = null;

                if (table === actual.dcmsVisitFeedbackTable) {
                  const row = state.feedback.find((f) => params.includes(f.id) || params.includes(f.visitId));
                  if (row) {
                    Object.assign(row, updates);
                    updatedRow = row;
                  }
                } else if (table === actual.complaintsTable) {
                  const row = state.complaints.find((c) => params.includes(c.id));
                  if (row) {
                    Object.assign(row, updates);
                    updatedRow = row;
                  }
                } else if (table === actual.dcmsSubscriptionsTable) {
                  const row = state.subscriptions.find((s) => params.includes(s.id));
                  if (row) {
                    Object.assign(row, updates);
                    updatedRow = row;
                  }
                }
                return {
                  returning: vi.fn(() => Promise.resolve(updatedRow ? [updatedRow] : [])),
                  then: (resolve: any) => resolve([updatedRow]),
                };
              }),
            };
          }),
        };
      }),
      delete: vi.fn(() => {
        return {
          where: vi.fn(() => Promise.resolve()),
        };
      }),
    },
  };
});

// Mock cancelSubscription from DCMS service
vi.mock("../../lib/dcms/subscriptionService", () => ({
  cancelSubscription: vi.fn(async (subId: number, performedBy: number, reason: string) => {
    const sub = state.subscriptions.find((s) => s.id === subId);
    if (sub) {
      sub.status = "cancelled";
    }
    return { success: true };
  }),
}));

describe("PRD v2.1: Service Quality, SLA Management & Retention Engine", () => {
  beforeEach(() => {
    state.visits = [];
    state.subscriptions = [];
    state.customers = [];
    state.feedback = [];
    state.complaints = [];
    state.policies = [];
    state.escalations = [];
    state.notifications = [];
    state.consents = [];
    state.assignments = [];
    state.auditLogs = [];
  });

  describe("1. Service Quality & Visit Feedback (P0)", () => {
    it("submits positive rating (5 stars) cleanly without creating a support ticket", async () => {
      state.subscriptions.push({
        id: 101,
        customerId: 1,
        cityId: 2,
        branchId: 5,
        status: "active",
      });
      state.customers.push({ id: 1, name: "Rahul Sharma", phone: "9876543210" });
      state.visits.push({
        id: 201,
        subscriptionId: 101,
        vehicleId: 50,
        staffId: 10,
        status: "completed",
        visitDate: "2026-11-12",
        visitTime: "2026-11-12T07:30:00Z",
      });

      const result = await submitVisitFeedback({
        visitId: 201,
        customerId: 1,
        ratingScore: 5,
        comment: "Excellent cleaning, very shiny windshield!",
        tags: ["Great shine ✨", "Punctual timing"],
        issueReported: false,
      });

      expect(result.ratingScore).toBe(5);
      expect(result.isNegative).toBe(false);
      expect(result.complaintId).toBeNull();
      expect(state.feedback.length).toBe(1);
      expect(state.feedback[0].ratingScore).toBe(5);
      expect(state.complaints.length).toBe(0); // No ticket created for positive rating
    });

    it("submits negative rating (1 star) and automatically creates a high-priority support ticket", async () => {
      state.subscriptions.push({
        id: 102,
        customerId: 2,
        cityId: 2,
        branchId: 5,
        status: "active",
      });
      state.customers.push({ id: 2, name: "Pooja Verma", phone: "9876543211" });
      state.visits.push({
        id: 202,
        subscriptionId: 102,
        vehicleId: 51,
        staffId: 11,
        status: "completed",
        visitDate: "2026-11-12",
        visitTime: "2026-11-12T08:00:00Z",
      });

      const result = await submitVisitFeedback({
        visitId: 202,
        customerId: 2,
        ratingScore: 1,
        comment: "Lower doors left muddy and wheels completely skipped.",
        tags: ["Missed lower doors", "Wheels skipped"],
        issueReported: true,
      });

      expect(result.ratingScore).toBe(1);
      expect(result.isNegative).toBe(true);
      expect(result.complaintId).toBeDefined();
      expect(state.complaints.length).toBe(1);

      const ticket = state.complaints[0];
      expect(ticket.customerId).toBe(2);
      expect(ticket.priority).toBe("urgent"); // 1-star ratings are severe and marked urgent
      expect(ticket.type).toBe("quality");
      expect(ticket.title).toContain("Service Quality Concern: 1 star");
    });

    it("enforces customer IDOR protection (cannot rate another customer's visit)", async () => {
      state.subscriptions.push({
        id: 103,
        customerId: 1, // Belongs to customer 1
        cityId: 2,
        status: "active",
      });
      state.visits.push({
        id: 203,
        subscriptionId: 103,
        vehicleId: 52,
        staffId: 12,
        status: "completed",
      });

      // Customer 2 attempts to rate Customer 1's visit
      await expect(
        submitVisitFeedback({
          visitId: 203,
          customerId: 2,
          ratingScore: 5,
        })
      ).rejects.toThrow("Access denied");
    });

    it("rejects feedback submission for incomplete visits", async () => {
      state.subscriptions.push({
        id: 104,
        customerId: 1,
        cityId: 2,
        status: "active",
      });
      state.visits.push({
        id: 204,
        subscriptionId: 104,
        vehicleId: 53,
        staffId: 12,
        status: "in_progress", // Not completed yet
      });

      await expect(
        submitVisitFeedback({
          visitId: 204,
          customerId: 1,
          ratingScore: 4,
        })
      ).rejects.toThrow("Feedback can only be submitted for completed cleaning visits");
    });

    it("allows feedback update within 48h but rejects modification after 48h", async () => {
      state.subscriptions.push({
        id: 105,
        customerId: 1,
        cityId: 2,
        status: "active",
      });
      state.customers.push({ id: 1, name: "Rahul", phone: "9876543210" });
      state.visits.push({
        id: 205,
        subscriptionId: 105,
        vehicleId: 54,
        staffId: 12,
        status: "completed",
      });

      // Existing feedback created 10 hours ago (< 48h)
      state.feedback.push({
        id: 501,
        visitId: 205,
        subscriptionId: 105,
        customerId: 1,
        ratingScore: 3,
        comment: "Average",
        createdAt: new Date(Date.now() - 10 * 3600 * 1000),
      });

      const updated = await submitVisitFeedback({
        visitId: 205,
        customerId: 1,
        ratingScore: 4,
        comment: "Actually inspected later, wheels were clean after all.",
      });

      expect(updated.ratingScore).toBe(4);
      expect(state.feedback[0].ratingScore).toBe(4);

      // Now simulate feedback created 50 hours ago (> 48h)
      state.feedback[0].createdAt = new Date(Date.now() - 50 * 3600 * 1000);

      await expect(
        submitVisitFeedback({
          visitId: 205,
          customerId: 1,
          ratingScore: 5,
        })
      ).rejects.toThrow("cannot be modified after 48 hours");
    });
  });

  describe("2. SLA Policy Engine & Escalations (P0)", () => {
    it("resolves city-specific policy with exact priority match over generic policy", async () => {
      state.policies.push(
        {
          id: 1,
          name: "Global Default Policy",
          cityId: null,
          category: "all",
          priority: "all",
          responseTargetMinutes: 720,
          resolutionTargetMinutes: 1440,
          isActive: true,
        },
        {
          id: 2,
          name: "Noida Urgent Quality Policy",
          cityId: 2, // Noida
          category: "service_quality",
          priority: "urgent",
          responseTargetMinutes: 60,
          resolutionTargetMinutes: 240,
          isActive: true,
        }
      );

      const resolved = await resolveSlaPolicy({
        cityId: 2,
        category: "service_quality",
        priority: "urgent",
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(2);
      expect(resolved?.responseTargetMinutes).toBe(60);
      expect(resolved?.resolutionTargetMinutes).toBe(240);
    });

    it("falls back to global category policy when city has no specific override", async () => {
      state.policies.push(
        {
          id: 1,
          name: "Global Default Policy",
          cityId: null,
          category: "all",
          priority: "all",
          responseTargetMinutes: 720,
          resolutionTargetMinutes: 1440,
          isActive: true,
        },
        {
          id: 3,
          name: "Global Missed Visit Policy",
          cityId: null,
          category: "missed_cleaning",
          priority: "high",
          responseTargetMinutes: 120,
          resolutionTargetMinutes: 360,
          isActive: true,
        }
      );

      // Varanasi (cityId: 1) has no city-specific policy, should resolve global missed visit
      const resolved = await resolveSlaPolicy({
        cityId: 1,
        category: "missed_cleaning",
        priority: "high",
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(3);
      expect(resolved?.responseTargetMinutes).toBe(120);
    });

    it("calculates response and resolution deadlines from policy targets", () => {
      const baseTime = new Date("2026-11-12T10:00:00Z");
      const policy: any = {
        id: 1,
        responseTargetMinutes: 120, // 2 hours
        resolutionTargetMinutes: 480, // 8 hours
      };

      const deadlines = calculateSlaDeadlines(baseTime, policy);
      expect(deadlines.responseDueAt.toISOString()).toBe("2026-11-12T12:00:00.000Z");
      expect(deadlines.resolutionDueAt.toISOString()).toBe("2026-11-12T18:00:00.000Z");
    });

    it("pauses SLA clock on awaiting_customer and shifts deadlines forward on resume", async () => {
      const initialResolutionDue = new Date("2026-11-12T18:00:00Z");
      state.complaints.push({
        id: 301,
        ticketNumber: "TKT-2026-301",
        status: "open",
        responseDueAt: new Date("2026-11-12T12:00:00Z"),
        resolutionDueAt: initialResolutionDue,
        slaPausedAt: null,
        slaTotalPausedMinutes: 0,
      });

      // 1. Transition to awaiting_customer -> clock paused
      await handleSlaClockTransition(301, "open", "awaiting_customer");
      expect(state.complaints[0].slaPausedAt).toBeDefined();

      // 2. Simulate 60 minutes passing while awaiting customer
      const pausedAt = new Date(Date.now() - 60 * 60 * 1000);
      state.complaints[0].slaPausedAt = pausedAt;

      // 3. Customer responds -> transition to in_progress
      await handleSlaClockTransition(301, "awaiting_customer", "in_progress");

      expect(state.complaints[0].slaPausedAt).toBeNull();
      expect(state.complaints[0].slaTotalPausedMinutes).toBeGreaterThanOrEqual(59);
      // Deadline shifted forward by approximately 60 mins
      expect(new Date(state.complaints[0].resolutionDueAt).getTime()).toBeGreaterThan(
        initialResolutionDue.getTime()
      );
    });

    it("evaluates ticket SLA, detects breach, and triggers Level 1 escalation log for high-priority ticket", async () => {
      const overdueTime = new Date(Date.now() - 30 * 60 * 1000); // Overdue by 30 mins
      state.complaints.push({
        id: 302,
        ticketNumber: "TKT-2026-302",
        status: "in_progress",
        priority: "high",
        category: "service_quality",
        branchId: 5,
        resolutionDueAt: overdueTime,
        slaStatus: "on_track",
        escalationLevel: 0,
      });

      const evaluation = await evaluateTicketSla(302);

      expect(evaluation.isBreached).toBe(true);
      expect(evaluation.slaStatus).toBe("breached");
      expect(evaluation.escalationLevel).toBe(1);
      expect(state.complaints[0].slaStatus).toBe("breached");
      expect(state.complaints[0].escalationLevel).toBe(1);

      // Verify Level 1 escalation log created
      expect(state.escalations.length).toBe(1);
      expect(state.escalations[0].complaintId).toBe(302);
      expect(state.escalations[0].escalationLevel).toBe(1);
      expect(state.escalations[0].escalatedToRole).toBe("branch_supervisor");
    });

    it("triggers critical Level 2 escalation log to central superadmin for urgent breaches", async () => {
      const overdueTime = new Date(Date.now() - 15 * 60 * 1000);
      state.complaints.push({
        id: 303,
        ticketNumber: "TKT-2026-303",
        status: "in_progress",
        priority: "urgent",
        category: "service_quality",
        branchId: 5,
        resolutionDueAt: overdueTime,
        slaStatus: "on_track",
        escalationLevel: 0,
      });

      const evaluation = await evaluateTicketSla(303);

      expect(evaluation.isBreached).toBe(true);
      expect(evaluation.escalationLevel).toBe(2);
      expect(state.complaints[0].escalationLevel).toBe(2);

      // Verify Level 2 escalation log created
      const level2 = state.escalations.find((e) => e.escalationLevel === 2);
      expect(level2).toBeDefined();
      expect(level2?.complaintId).toBe(303);
      expect(level2?.escalatedToRole).toBe("central_superadmin");
    });
  });

  describe("3. Customer Retention & Cancellation Insights (P1)", () => {
    it("processes subscription cancellation with structured reason and assigns churn risk", async () => {
      state.subscriptions.push({
        id: 401,
        customerId: 10,
        cityId: 2,
        status: "active",
      });

      const updated = await processCustomerCancellation({
        subscriptionId: 401,
        customerId: 10,
        reason: "quality",
        feedback: "Staff skipped cleaning twice this week without notification.",
        performedBy: 10,
      });

      expect(updated.status).toBe("cancelled");
      expect(updated.cancellationReason).toBe("quality");
      expect(updated.churnRiskLevel).toBe("high"); // Quality dissatisfaction is high churn risk
      expect(updated.cancellationFeedback).toContain("skipped cleaning twice");
      expect(updated.cancellationRequestedAt).toBeDefined();
    });

    it("enforces valid structured cancellation reasons", () => {
      expect(CANCELLATION_REASONS).toContain("relocated");
      expect(CANCELLATION_REASONS).toContain("quality");
      expect(CANCELLATION_REASONS).toContain("price");
      expect(CANCELLATION_REASONS).toContain("vehicle_sold");
      expect(CANCELLATION_REASONS).toContain("travel");
      expect(CANCELLATION_REASONS).toContain("other");
    });
  });

  describe("4. Notification Engine Safeguards & Privacy (P0)", () => {
    it("suppresses marketing notifications when customer has opted out", async () => {
      state.consents.push({
        customerId: 15,
        smsConsent: false, // Opted out of marketing SMS
      });

      const result = await dispatchNotification({
        customerId: 15,
        title: "Exclusive Weekend Detailing Discount!",
        message: "Get 20% off comprehensive foam wash this Sunday.",
        type: "booking_confirmation",
        isMarketing: true,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("marketing_opt_out");
      expect(state.notifications.length).toBe(0);
    });

    it("applies residential privacy masking to sensitive tower/flat numbers", async () => {
      const result = await dispatchNotification({
        customerId: 20,
        title: "Cleaner Assigned",
        message: "Specialist assigned for Flat B-402, Tower 3, Royal Palms.",
        type: "booking_confirmation",
        channels: ["in_app"],
        sensitiveMasked: true,
      });

      expect(result.success).toBe(true);
      expect(result.inAppDelivered).toBe(true);
      expect(state.notifications.length).toBe(1);
      const saved = state.notifications[0];
      expect(saved.message).toContain("Flat ***");
      expect(saved.message).not.toContain("Flat B-402");
    });
  });
});
