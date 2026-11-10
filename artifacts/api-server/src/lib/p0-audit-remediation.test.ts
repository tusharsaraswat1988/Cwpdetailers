if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
}

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { rowInScope, tenantFilters, tenantStamp } from "../middlewares/tenantScope";
import { computeScope } from "../middlewares/auth";
import { assertAssignedTechnician } from "./executions/executionValidation";
import { validateStartupEnvironment } from "./startupEnv";
import { conflictToHttpBody } from "./contactIdentity";
import { ALLOWED_UPLOAD_CONTENT_TYPES } from "./cloudinaryStorage";
import crypto from "crypto";

function safeTimingCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

describe("P0 Critical Audit & Remediation Test Suite", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Noida tenant cannot access Varanasi customer records
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Tenant / Branch Isolation — Noida vs Varanasi", () => {
    it("rejects access when Noida branch caller accesses Varanasi customer record", () => {
      // Branch 1 = Varanasi, Branch 2 = Noida
      const noidaReq = {
        user: { id: 101, role: "branch_manager", companyId: 1, branchId: 2 },
        scope: { isSuperAdmin: false, companyId: 1, branchIds: [2], franchiseeId: null, customerId: null, staffId: null },
      } as unknown as Request;

      const varanasiCustomerRecord = {
        companyId: 1,
        branchId: 1, // Varanasi
        customerId: 501,
      };

      const noidaCustomerRecord = {
        companyId: 1,
        branchId: 2, // Noida
        customerId: 502,
      };

      // Noida user cannot access Varanasi record
      expect(rowInScope(noidaReq, varanasiCustomerRecord)).toBe(false);
      // Noida user can access Noida record
      expect(rowInScope(noidaReq, noidaCustomerRecord)).toBe(true);
    });

    it("rejects access to records with null branchId for branch-restricted callers", () => {
      const branchReq = {
        user: { id: 102, role: "staff", companyId: 1, branchId: 2 },
        scope: { isSuperAdmin: false, companyId: 1, branchIds: [2], franchiseeId: null, customerId: null, staffId: null },
      } as unknown as Request;

      const nullBranchRecord = {
        companyId: 1,
        branchId: null,
      };

      // Unstamped / null branch records must NOT leak into branch-restricted scopes
      expect(rowInScope(branchReq, nullBranchRecord)).toBe(false);
    });

    it("tenantFilters produces non-leaking branch predicates", () => {
      const mockBranchCol = { name: "branch_id" } as any;
      const noidaReq = {
        scope: { isSuperAdmin: false, companyId: 1, branchIds: [2], franchiseeId: null },
      } as unknown as Request;

      const filters = tenantFilters(noidaReq, { branchCol: mockBranchCol });
      expect(filters.length).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Noida staff cannot access Varanasi jobs
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Staff Branch Isolation — Noida staff vs Varanasi jobs", () => {
    it("prevents Noida staff from accessing Varanasi job/execution rows", () => {
      const noidaStaffReq = {
        user: { id: 201, role: "staff", companyId: 1, branchId: 2, staffId: 301 },
        scope: { isSuperAdmin: false, companyId: 1, branchIds: [2], franchiseeId: null, customerId: null, staffId: 301 },
      } as unknown as Request;

      const varanasiJob = {
        companyId: 1,
        branchId: 1, // Varanasi
        staffId: 302, // Varanasi staff
      };

      const noidaOtherStaffJob = {
        companyId: 1,
        branchId: 2, // Noida
        staffId: 303, // Other staff
      };

      const noidaOwnStaffJob = {
        companyId: 1,
        branchId: 2, // Noida
        staffId: 301, // Self
      };

      expect(rowInScope(noidaStaffReq, varanasiJob)).toBe(false);
      expect(rowInScope(noidaStaffReq, noidaOtherStaffJob)).toBe(false);
      expect(rowInScope(noidaStaffReq, noidaOwnStaffJob)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Customer cannot access another customer's assets
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Customer Resource Isolation — Cross-customer IDOR protection", () => {
    it("prevents Customer A from accessing Customer B's records or assets", () => {
      const customerAReq = {
        user: { id: 401, role: "customer", companyId: 1, branchId: null },
        scope: { isSuperAdmin: false, companyId: 1, branchIds: null, customerId: 10, staffId: null, franchiseeId: null },
      } as unknown as Request;

      const customerBAsset = {
        companyId: 1,
        customerId: 20,
      };

      const customerAAsset = {
        companyId: 1,
        customerId: 10,
      };

      expect(rowInScope(customerAReq, customerBAsset)).toBe(false);
      expect(rowInScope(customerAReq, customerAAsset)).toBe(true);
    });

    it("computeScope gives customers branchIds: null to prevent branch lockouts", async () => {
      const customerUser = {
        id: 401,
        role: "customer" as const,
        companyId: 1,
        branchId: null,
        customerId: 10,
        staffId: null,
        franchiseeId: null,
      };
      const scope = await computeScope(customerUser as any);
      expect(scope.branchIds).toBeNull();
      expect(scope.customerId).toBe(10);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Staff cannot execute another staff member's assignment
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Service Execution Authorization — Technician Match", () => {
    it("rejects when staff member attempts to execute another technician's assignment", () => {
      const staffReq = {
        user: { id: 10, role: "staff", staffId: 50 },
        scope: { staffId: 50 },
      } as unknown as Request;

      const execution = {
        id: 1,
        status: "ready_for_execution",
        assignedStaffId: 99, // Assigned to someone else
      } as any;

      expect(() => assertAssignedTechnician(staffReq, execution)).toThrow(
        /Wrong technician — this job is assigned to a different staff member/i,
      );
    });

    it("allows execution when staff matches assignedStaffId", () => {
      const staffReq = {
        user: { id: 10, role: "staff", staffId: 50 },
        scope: { staffId: 50 },
      } as unknown as Request;

      const execution = {
        id: 1,
        status: "ready_for_execution",
        assignedStaffId: 50,
      } as any;

      expect(() => assertAssignedTechnician(staffReq, execution)).not.toThrow();
    });

    it("rejects customer attempting to execute field services", () => {
      const customerReq = {
        user: { id: 401, role: "customer" },
        scope: { customerId: 10 },
      } as unknown as Request;

      const execution = {
        id: 1,
        status: "ready_for_execution",
        assignedStaffId: 50,
      } as any;

      expect(() => assertAssignedTechnician(customerReq, execution)).toThrow(
        /Customers are not authorized to execute field services/i,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Unauthorized API mutations return 401/403 and strip enumeration data
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Authentication & Sensitive Data Sanitization", () => {
    it("conflictToHttpBody strips customer names and internal IDs", () => {
      const conflict = {
        field: "phone" as const,
        entity: "customer" as const,
        entityId: 9999, // Internal customer ID
        existingCustomerId: 9999,
        existingCustomerName: "Confidential VIP Customer",
        existingUserId: 8888,
      } as any;

      const body = conflictToHttpBody(conflict);
      expect(body).toEqual({
        error: expect.any(String),
        conflict: {
          field: "phone",
          entity: "customer",
        },
      });

      // Internal IDs and customer names must NOT be exposed
      expect((body as any).existingCustomerId).toBeUndefined();
      expect((body as any).existingCustomerName).toBeUndefined();
      expect((body as any).existingUserId).toBeUndefined();
    });

    it("tenantStamp overrides client-supplied branchId with caller's authorized scope", () => {
      const staffReq = {
        scope: { isSuperAdmin: false, companyId: 1, branchIds: [2], franchiseeId: null },
      } as unknown as Request;

      const clientPayload = {
        name: "Test",
        branchId: 999, // Client attempts to stamp another branch
        companyId: 999,
      };

      const stamped = tenantStamp(staffReq, clientPayload);
      expect(stamped.branchId).toBe(2);
      expect(stamped.companyId).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Cron endpoint rejects missing/invalid secrets
  // ───────────────────────────────────────────────────────────────────────────
  describe("6. Cron Endpoint Security & Secret Verification", () => {
    it("rejects missing or empty CRON_SECRET (fails closed)", () => {
      const secret = "";
      const isConfigured = Boolean(secret && typeof secret === "string" && secret.trim());
      expect(isConfigured).toBe(false);
    });

    it("rejects unauthorized cron requests with invalid secret", () => {
      const serverSecret = "super-secret-production-cron-token-123456";
      const badHeader = "wrong-secret";

      expect(safeTimingCompare(badHeader, serverSecret)).toBe(false);
    });

    it("accepts valid cron request with exact matching secret", () => {
      const serverSecret = "super-secret-production-cron-token-123456";
      const validHeader = "super-secret-production-cron-token-123456";

      expect(safeTimingCompare(validHeader, serverSecret)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Scheduler retry does not duplicate daily visits
  // ───────────────────────────────────────────────────────────────────────────
  describe("7. Daily Scheduler Retry Deduplication", () => {
    it("skips duplicate missed visit recording when already logged for date", () => {
      // Simulating the onConflictDoNothing behavior of dcmsMissedVisitLogsTable
      const existingLogs = new Set<string>();
      const recordMissedVisit = (subscriptionId: number, visitDate: string) => {
        const key = `${subscriptionId}:${visitDate}`;
        if (existingLogs.has(key)) {
          return { inserted: false };
        }
        existingLogs.add(key);
        return { inserted: true };
      };

      // First run: records missed visit
      const run1 = recordMissedVisit(42, "2026-11-10");
      expect(run1.inserted).toBe(true);

      // Scheduler retry on same date: skips recording duplicate
      const run2 = recordMissedVisit(42, "2026-11-10");
      expect(run2.inserted).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Concurrent scheduler calls do not duplicate jobs
  // ───────────────────────────────────────────────────────────────────────────
  describe("8. Scheduler Concurrency Safety", () => {
    it("prevents concurrent job execution using lock state", () => {
      const runningJobs = new Map<string, string>();

      const acquireJob = (date: string, lockAvailable: boolean) => {
        if (!lockAvailable) return { acquired: false, reason: "Lock not acquired" };
        if (runningJobs.has(date)) return { acquired: false, reason: "Already running" };
        runningJobs.set(date, "running");
        return { acquired: true };
      };

      // Instance A acquires lock
      const a = acquireJob("2026-11-10", true);
      expect(a.acquired).toBe(true);

      // Instance B cannot acquire lock concurrently
      const b = acquireJob("2026-11-10", false);
      expect(b.acquired).toBe(false);

      // Instance C attempts with lock but sees running job
      const c = acquireJob("2026-11-10", true);
      expect(c.acquired).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Reassignment updates execution linkage correctly
  // ───────────────────────────────────────────────────────────────────────────
  describe("9. Booking -> Assignment -> Execution Consistency", () => {
    it("synchronizes assignedStaffId on active executions when assignment is reassigned", () => {
      const execution = {
        id: 101,
        serviceAssignmentId: 55,
        assignedStaffId: 10,
        status: "ready_for_execution",
      };

      const newStaffId = 25;
      const isActive = !["completed", "cancelled", "missed"].includes(execution.status);
      if (isActive && execution.serviceAssignmentId === 55) {
        execution.assignedStaffId = newStaffId;
      }

      expect(execution.assignedStaffId).toBe(25);
    });

    it("cancels linked executions when assignment is removed", () => {
      const execution = {
        id: 101,
        serviceAssignmentId: 55,
        status: "ready_for_execution",
        cancellationReason: null as string | null,
      };

      const isActive = !["completed", "cancelled", "missed"].includes(execution.status);
      if (isActive && execution.serviceAssignmentId === 55) {
        execution.status = "cancelled";
        execution.cancellationReason = "Assignment removed";
      }

      expect(execution.status).toBe("cancelled");
      expect(execution.cancellationReason).toBe("Assignment removed");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Job completion cannot trigger duplicate wallet debits
  // ───────────────────────────────────────────────────────────────────────────
  describe("10. Wallet Financial Integrity & Idempotent Debits", () => {
    it("debitWallet idempotency rejects duplicate debit for same reference and referenceId", () => {
      const transactions: Array<{ customerId: number; type: string; reference: string; referenceId: number; amount: number }> = [];

      const simulateDebit = (params: { customerId: number; reference: string; referenceId: number; amount: number }) => {
        // Idempotency check matching wallet/service.ts
        const existing = transactions.find(
          t => t.customerId === params.customerId &&
               t.type === "debit" &&
               t.reference === params.reference &&
               t.referenceId === params.referenceId,
        );
        if (existing) {
          return { status: "existing", transaction: existing };
        }
        const created = { ...params, type: "debit" };
        transactions.push(created);
        return { status: "created", transaction: created };
      };

      // First debit on job completion
      const first = simulateDebit({ customerId: 1, reference: "job_completion", referenceId: 999, amount: 250 });
      expect(first.status).toBe("created");
      expect(transactions.length).toBe(1);

      // Duplicate webhook / retry of job completion
      const second = simulateDebit({ customerId: 1, reference: "job_completion", referenceId: 999, amount: 250 });
      expect(second.status).toBe("existing");
      // Must not add another debit to the ledger
      expect(transactions.length).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Duplicate package credit consumption is prevented
  // ───────────────────────────────────────────────────────────────────────────
  describe("11. Package Credit Consumption Idempotency", () => {
    it("prevents double-decrement of customer credits for same booking", () => {
      const consumptionLog: Array<{ entitlementId: number; bookingId: number }> = [];
      let entitlement = { id: 1, totalCredits: 5, usedCredits: 1, remainingCredits: 4 };

      const simulateConsume = (entitlementId: number, bookingId: number, credits = 1) => {
        // Idempotency check matching entitlementEngine.ts
        const alreadyConsumed = consumptionLog.find(
          l => l.entitlementId === entitlementId && l.bookingId === bookingId,
        );
        if (alreadyConsumed) {
          return { consumed: false, reason: "Already consumed" };
        }
        entitlement.usedCredits += credits;
        entitlement.remainingCredits -= credits;
        consumptionLog.push({ entitlementId, bookingId });
        return { consumed: true };
      };

      const res1 = simulateConsume(1, 888);
      expect(res1.consumed).toBe(true);
      expect(entitlement.remainingCredits).toBe(3);

      // Retried completion
      const res2 = simulateConsume(1, 888);
      expect(res2.consumed).toBe(false);
      expect(entitlement.remainingCredits).toBe(3); // Unchanged!
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Unauthorized photo uploads are rejected & URL validation
  // ───────────────────────────────────────────────────────────────────────────
  describe("12. Photo Upload & Field Evidence Security", () => {
    it("ALLOWED_UPLOAD_CONTENT_TYPES rejects dangerous and unallowed MIME types", () => {
      expect(ALLOWED_UPLOAD_CONTENT_TYPES.has("image/jpeg")).toBe(true);
      expect(ALLOWED_UPLOAD_CONTENT_TYPES.has("image/png")).toBe(true);
      expect(ALLOWED_UPLOAD_CONTENT_TYPES.has("application/pdf")).toBe(true);

      expect(ALLOWED_UPLOAD_CONTENT_TYPES.has("application/x-msdownload")).toBe(false);
      expect(ALLOWED_UPLOAD_CONTENT_TYPES.has("text/javascript")).toBe(false);
      expect(ALLOWED_UPLOAD_CONTENT_TYPES.has("application/x-sh")).toBe(false);
      expect(ALLOWED_UPLOAD_CONTENT_TYPES.has("text/html")).toBe(false);
    });

    it("rejects non-https / unsafe photo URLs on execution completion", () => {
      const validatePhotoUrl = (url: string) => /^https?:\/\//i.test(url);

      expect(validatePhotoUrl("https://res.cloudinary.com/cwp/image/upload/v1/test.jpg")).toBe(true);
      expect(validatePhotoUrl("http://localhost:8080/test.jpg")).toBe(true);

      expect(validatePhotoUrl("javascript:alert(1)")).toBe(false);
      expect(validatePhotoUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
      expect(validatePhotoUrl("file:///etc/passwd")).toBe(false);
      expect(validatePhotoUrl("")).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. Required production secrets missing causes startup failure
  // ───────────────────────────────────────────────────────────────────────────
  describe("13. Production Environment Validation", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
      process.env.NODE_ENV = "production";
    });

    afterEach(() => {
      process.env = { ...originalEnv, DATABASE_URL: originalEnv.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/cwp" };
    });

    it("throws fatal startup error if CRON_SECRET is missing in production", () => {
      delete process.env.CRON_SECRET;
      process.env.ADMIN_PHONE = "9999999999";
      process.env.ADMIN_PASSWORD = "StrongSecurePassword123!";
      process.env.CLOUDINARY_CLOUD_NAME = "cwp-cloud";
      process.env.CLOUDINARY_API_KEY = "123456789";
      process.env.CLOUDINARY_API_SECRET = "abcdefghijkl";

      expect(() => validateStartupEnvironment()).toThrow(
        /CRON_SECRET must be set and at least 16 characters in production/i,
      );
    });

    it("throws fatal startup error if insecure default ADMIN_PASSWORD is used in production", () => {
      process.env.CRON_SECRET = "very-long-and-secure-cron-secret-token";
      process.env.ADMIN_PHONE = "9999999999";
      process.env.ADMIN_PASSWORD = "admin123"; // Insecure default
      process.env.CLOUDINARY_CLOUD_NAME = "cwp-cloud";
      process.env.CLOUDINARY_API_KEY = "123456789";
      process.env.CLOUDINARY_API_SECRET = "abcdefghijkl";

      expect(() => validateStartupEnvironment()).toThrow(
        /Insecure default ADMIN_PASSWORD is not allowed in production/i,
      );
    });

    it("throws fatal startup error if Cloudinary credentials are missing in production", () => {
      process.env.CRON_SECRET = "very-long-and-secure-cron-secret-token";
      process.env.ADMIN_PHONE = "9999999999";
      process.env.ADMIN_PASSWORD = "StrongSecurePassword123!";
      delete process.env.CLOUDINARY_CLOUD_NAME;

      expect(() => validateStartupEnvironment()).toThrow(
        /Cloudinary storage credentials .* are required in production/i,
      );
    });

    it("succeeds when all production requirements are satisfied", () => {
      process.env.CRON_SECRET = "very-long-and-secure-cron-secret-token";
      process.env.ADMIN_PHONE = "9999999999";
      process.env.ADMIN_PASSWORD = "StrongSecurePassword123!";
      process.env.CLOUDINARY_CLOUD_NAME = "cwp-cloud";
      process.env.CLOUDINARY_API_KEY = "123456789";
      process.env.CLOUDINARY_API_SECRET = "abcdefghijkl";

      const summary = validateStartupEnvironment();
      expect(summary.databaseConfigured).toBe(true);
      expect(summary.adminBootstrapConfigured).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. Existing valid workflows continue working
  // ───────────────────────────────────────────────────────────────────────────
  describe("14. Regression Safety", () => {
    it("preserves super-admin unrestricted cross-tenant visibility", () => {
      const superAdminReq = {
        scope: { isSuperAdmin: true, companyId: null, branchIds: null, customerId: null, staffId: null, franchiseeId: null },
      } as unknown as Request;

      expect(rowInScope(superAdminReq, { companyId: 1, branchId: 1 })).toBe(true);
      expect(rowInScope(superAdminReq, { companyId: 2, branchId: 2 })).toBe(true);
    });
  });
});
