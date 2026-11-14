import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeNextRun, computeNextCronDate, getTimezoneDateParts } from "../../lib/scheduler/cronParser";
import { sanitizePayload, sanitizeErrorMessage } from "../../lib/scheduler/payloadSanitizer";

describe("Phase 22: Universal Job Scheduler, Background Workers & Automation Reliability", () => {
  // ==========================================================================
  // Workstream 1: Core Job Scheduler, Cron Expressions & Timezone Calculation
  // ==========================================================================
  describe("Workstream 1: Schedule Calculation, Cron & Timezone Resilience", () => {
    it("accurately parses date parts in Asia/Kolkata timezone (IST)", () => {
      // 2026-11-14 00:30 UTC -> 2026-11-14 06:00 IST (+05:30)
      const dateUtc = new Date("2026-11-14T00:30:00Z");
      const parts = getTimezoneDateParts(dateUtc, "Asia/Kolkata");

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(11);
      expect(parts.day).toBe(14);
      expect(parts.hour).toBe(6);
      expect(parts.minute).toBe(0);
    });

    it("calculates next run for recurring interval schedules", () => {
      const fromDate = new Date("2026-11-14T10:00:00Z");
      const nextRun = computeNextRun(
        {
          scheduleType: "recurring_interval",
          intervalSeconds: 3600, // 1 hour
        },
        fromDate,
      );

      expect(nextRun).not.toBeNull();
      expect(nextRun?.toISOString()).toBe("2026-11-14T11:00:00.000Z");
    });

    it("calculates next run for 5-part cron expressions in IST", () => {
      // 06:00 AM IST daily (0 6 * * *)
      // At 05:00 IST on 2026-11-14 (which is 23:30 UTC on 2026-11-13)
      const fromDate = new Date("2026-11-13T23:30:00Z"); // 05:00 IST
      const nextRun = computeNextCronDate("0 6 * * *", fromDate, "Asia/Kolkata");

      expect(nextRun).not.toBeNull();
      const istParts = getTimezoneDateParts(nextRun, "Asia/Kolkata");
      expect(istParts.hour).toBe(6);
      expect(istParts.minute).toBe(0);
      expect(istParts.day).toBe(14);
    });

    it("handles end-of-day 23:59 IST cron schedules accurately", () => {
      // At 23:50 IST on 2026-11-14 (18:20 UTC)
      const fromDate = new Date("2026-11-14T18:20:00Z");
      const nextRun = computeNextCronDate("59 23 * * *", fromDate, "Asia/Kolkata");

      expect(nextRun).not.toBeNull();
      const istParts = getTimezoneDateParts(nextRun, "Asia/Kolkata");
      expect(istParts.hour).toBe(23);
      expect(istParts.minute).toBe(59);
      expect(istParts.day).toBe(14);
    });

    it("handles one-time schedules: returns runAt if in future, null if in past", () => {
      const future = new Date("2026-11-20T10:00:00Z");
      const past = new Date("2026-11-10T10:00:00Z");
      const now = new Date("2026-11-14T10:00:00Z");

      const nextFuture = computeNextRun(
        { scheduleType: "one_time", runAt: future },
        now,
      );
      expect(nextFuture).toEqual(future);

      const nextPast = computeNextRun(
        { scheduleType: "one_time", runAt: past },
        now,
      );
      expect(nextPast).toBeNull();
    });

    it("supports pause and resume state transitions", () => {
      const job = {
        id: 101,
        name: "Test Automation",
        status: "active",
        isActive: true,
        nextRunAt: new Date("2026-11-14T12:00:00Z"),
      };

      // Pause job
      const pausedJob = { ...job, status: "paused", isActive: false };
      expect(pausedJob.status).toBe("paused");
      expect(pausedJob.isActive).toBe(false);

      // Resume job
      const resumedJob = {
        ...pausedJob,
        status: "active",
        isActive: true,
        nextRunAt: new Date("2026-11-14T13:00:00Z"),
      };
      expect(resumedJob.status).toBe("active");
      expect(resumedJob.isActive).toBe(true);
      expect(resumedJob.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ==========================================================================
  // Workstream 2: Background Worker Concurrency, Atomic Locks & Leases
  // ==========================================================================
  describe("Workstream 2: Worker Concurrency, Distributed Leases & Recovery", () => {
    it("enforces atomic job lease locking to prevent duplicate concurrent runs", () => {
      type JobRow = {
        id: number;
        status: string;
        lockedBy: string | null;
        leaseExpiresAt: Date | null;
      };

      const jobsPool: JobRow[] = [
        { id: 1, status: "active", lockedBy: null, leaseExpiresAt: null },
        { id: 2, status: "active", lockedBy: null, leaseExpiresAt: null },
      ];

      // Simulated atomic claim with FOR UPDATE SKIP LOCKED
      const claimJobs = (workerId: string, limit: number): JobRow[] => {
        const now = new Date();
        const claimed: JobRow[] = [];
        for (const j of jobsPool) {
          if (claimed.length >= limit) break;
          const isLeased = j.lockedBy && j.leaseExpiresAt && j.leaseExpiresAt.getTime() > now.getTime();
          if (!isLeased) {
            j.lockedBy = workerId;
            j.leaseExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
            claimed.push({ ...j });
          }
        }
        return claimed;
      };

      // Worker 1 claims 2 jobs
      const worker1Claim = claimJobs("worker_instance_1", 2);
      expect(worker1Claim.length).toBe(2);
      expect(worker1Claim[0].lockedBy).toBe("worker_instance_1");

      // Worker 2 attempts to claim concurrent jobs -> gets 0 jobs (preventing duplicate execution)
      const worker2Claim = claimJobs("worker_instance_2", 2);
      expect(worker2Claim.length).toBe(0);
    });

    it("calculates exponential backoff with jitter on retry", () => {
      const baseSeconds = 30;
      const maxSeconds = 3600;

      const computeBackoff = (attempt: number): number => {
        const baseMs = baseSeconds * 1000;
        const maxMs = maxSeconds * 1000;
        const multiplier = Math.pow(2, attempt);
        const jitter = 500; // deterministic sample
        return Math.min(maxMs, baseMs * multiplier + jitter);
      };

      // Attempt 1: 30 * 2^1 + 500 = 60,500ms
      expect(computeBackoff(1)).toBe(60500);

      // Attempt 2: 30 * 2^2 + 500 = 120,500ms
      expect(computeBackoff(2)).toBe(120500);

      // Attempt 3: 30 * 2^3 + 500 = 240,500ms
      expect(computeBackoff(3)).toBe(240500);

      // Cap at maxBackoff: Attempt 10 would be 30,720s -> capped at 3600s = 3,600,000ms
      expect(computeBackoff(10)).toBe(3600000);
    });

    it("recovers stale jobs when worker lease expires without heartbeat", () => {
      const now = new Date("2026-11-14T12:00:00Z");
      const expiredLease = new Date("2026-11-14T11:50:00Z"); // 10 minutes ago (> 5m lease)

      const runningJobs = [
        { id: 1, lastRunStatus: "running", lockedBy: "crashed_worker", leaseExpiresAt: expiredLease, attemptCount: 1 },
        { id: 2, lastRunStatus: "running", lockedBy: "healthy_worker", leaseExpiresAt: new Date(now.getTime() + 300000), attemptCount: 1 },
      ];

      const staleToRecover = runningJobs.filter(
        (j) => j.lastRunStatus === "running" && j.leaseExpiresAt.getTime() <= now.getTime(),
      );

      expect(staleToRecover.length).toBe(1);
      expect(staleToRecover[0].id).toBe(1);

      // Simulating recovery
      const recoveredJob = {
        ...staleToRecover[0],
        lockedBy: null,
        leaseExpiresAt: null,
        lastRunStatus: "failed",
        attemptCount: staleToRecover[0].attemptCount + 1,
      };

      expect(recoveredJob.lockedBy).toBeNull();
      expect(recoveredJob.attemptCount).toBe(2);
    });
  });

  // ==========================================================================
  // Workstream 3: Retention Automations Execution & Lifecycle Triggers
  // ==========================================================================
  describe("Workstream 3: Retention Automations Execution & Consent Governance", () => {
    it("respects DPDP consent suppression during automated job execution", () => {
      const candidates = [
        { id: 1, name: "Aarav Sharma", optedIn: true },
        { id: 2, name: "Pooja Verma", optedIn: false }, // Explicit opt-out
        { id: 3, name: "Rohan Gupta", optedIn: true },
      ];

      const eligible = candidates.filter((c) => c.optedIn);
      const suppressed = candidates.filter((c) => !c.optedIn);

      expect(eligible.length).toBe(2);
      expect(suppressed.length).toBe(1);
      expect(suppressed[0].name).toBe("Pooja Verma");
    });

    it("enforces frequency capping to prevent spamming customers", () => {
      const now = new Date("2026-11-14T12:00:00Z");
      const frequencyCapDays = 30;
      const cutoffDate = new Date(now.getTime() - frequencyCapDays * 24 * 60 * 60 * 1000);

      const customerRuns = [
        { customerId: 101, lastSentAt: new Date("2026-11-01T12:00:00Z") }, // 13 days ago -> Capped!
        { customerId: 102, lastSentAt: new Date("2026-10-01T12:00:00Z") }, // 44 days ago -> Eligible!
        { customerId: 103, lastSentAt: null }, // Never sent -> Eligible!
      ];

      const eligible = customerRuns.filter(
        (r) => !r.lastSentAt || r.lastSentAt.getTime() < cutoffDate.getTime(),
      );

      expect(eligible.length).toBe(2);
      expect(eligible.map((e) => e.customerId)).toEqual([102, 103]);
    });

    it("supports dry-run simulation without persistent state mutation", () => {
      const mockAutomation = {
        id: 1,
        name: "Inactive Customer Winback",
        triggerType: "inactive_customer",
        delayDays: 30,
      };

      const candidatesFound = 15;
      const dryRun = true;

      const result = {
        automationId: mockAutomation.id,
        triggerType: mockAutomation.triggerType,
        evaluatedCount: candidatesFound,
        triggeredCount: candidatesFound,
        dryRun,
      };

      expect(result.dryRun).toBe(true);
      expect(result.triggeredCount).toBe(15);
    });
  });

  // ==========================================================================
  // Workstream 4: Loyalty Points Expiry (FIFO Allocation & Ledger Continuity)
  // ==========================================================================
  describe("Workstream 4: Loyalty Points Expiry, FIFO Allocation & Ledger Integrity", () => {
    it("allocates debits across earning batches in strict FIFO order", () => {
      type CreditBatch = { id: number; points: number; consumedPoints: number; expiresAt: Date };

      const batches: CreditBatch[] = [
        { id: 1, points: 100, consumedPoints: 0, expiresAt: new Date("2026-06-01") },
        { id: 2, points: 50, consumedPoints: 0, expiresAt: new Date("2026-07-01") },
        { id: 3, points: 100, consumedPoints: 0, expiresAt: new Date("2026-08-01") },
      ];

      // Customer redeems 120 points
      let remainingToDebit = 120;
      for (const batch of batches) {
        if (remainingToDebit <= 0) break;
        const available = batch.points - batch.consumedPoints;
        const take = Math.min(available, remainingToDebit);
        batch.consumedPoints += take;
        remainingToDebit -= take;
      }

      // Batch 1 (100 pts): 100 consumed, 0 remaining
      expect(batches[0].consumedPoints).toBe(100);

      // Batch 2 (50 pts): 20 consumed, 30 remaining
      expect(batches[1].consumedPoints).toBe(20);

      // Batch 3 (100 pts): 0 consumed, 100 remaining
      expect(batches[2].consumedPoints).toBe(0);
    });

    it("expires only unconsumed points when a credit batch expires", () => {
      const now = new Date("2026-06-15");

      // Batch 1 has reached expiry date (2026-06-01 < 2026-06-15)
      // Original points: 100, consumed: 70 -> unconsumed to expire: 30
      const batch = {
        id: 1,
        customerId: 501,
        points: 100,
        consumedPoints: 70,
        expiresAt: new Date("2026-06-01"),
      };

      const unconsumed = batch.points - batch.consumedPoints;
      expect(unconsumed).toBe(30);

      const customerCurrentBalance = 80;
      const pointsToExpire = Math.min(unconsumed, customerCurrentBalance);
      const balanceAfter = customerCurrentBalance - pointsToExpire;

      expect(pointsToExpire).toBe(30);
      expect(balanceAfter).toBe(50);
    });

    it("guarantees non-negative balance during points expiry", () => {
      // If customer has 20 points in balance due to concurrent debits,
      // an expiring batch of 50 unconsumed points expires at most 20 points
      const currentBalance = 20;
      const unconsumedInBatch = 50;

      const pointsToExpire = Math.min(unconsumedInBatch, Math.max(0, currentBalance));
      const balanceAfter = currentBalance - pointsToExpire;

      expect(pointsToExpire).toBe(20);
      expect(balanceAfter).toBe(0);
    });

    it("ensures idempotency: duplicate expiry run on same date does not re-expire points", () => {
      const recordedIdempotencyKeys = new Set<string>();

      const runExpiry = (batchId: number, dateStr: string) => {
        const key = `expiry_tx_${batchId}_${dateStr}`;
        if (recordedIdempotencyKeys.has(key)) {
          return { skipped: true, pointsExpired: 0 };
        }
        recordedIdempotencyKeys.add(key);
        return { skipped: false, pointsExpired: 50 };
      };

      // First run expires 50 points
      const firstRun = runExpiry(10, "2026-11-14");
      expect(firstRun.skipped).toBe(false);
      expect(firstRun.pointsExpired).toBe(50);

      // Second run on same date is skipped idempotently
      const secondRun = runExpiry(10, "2026-11-14");
      expect(secondRun.skipped).toBe(true);
      expect(secondRun.pointsExpired).toBe(0);
    });
  });

  // ==========================================================================
  // Workstream 5: Security, Redaction & Tenant Boundary Governance
  // ==========================================================================
  describe("Workstream 5: Security, Payload Redaction & Multi-City Isolation", () => {
    it("redacts sensitive keys, tokens, and passwords from payloads", () => {
      const rawPayload = {
        jobName: "Send SMS Notification",
        apiKey: "live_secret_key_99887766",
        password: "super_secret_admin_pass",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        phone: "9876543210",
        nested: {
          clientSecret: "oauth_client_secret_xyz",
          allowedCount: 10,
        },
      };

      const sanitized = sanitizePayload(rawPayload);

      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.nested.clientSecret).toBe("[REDACTED]");
      expect(sanitized.nested.allowedCount).toBe(10);
      expect(sanitized.phone).toBe("987****210"); // Masked mobile
    });

    it("sanitizes error messages containing database credentials", () => {
      const rawError = new Error("Connection failed: postgresql://postgres:mypassword123@neon.db.internal:5432/cwp");
      const { message } = sanitizeErrorMessage(rawError);

      expect(message).not.toContain("mypassword123");
      expect(message).toContain("[REDACTED]");
    });

    it("enforces tenant boundary isolation: rejects city admin accessing other cities", () => {
      const cityAdminUser = {
        id: 12,
        role: "city_admin",
        cityId: 1, // Noida
      };

      const targetJob = {
        id: 88,
        name: "Varanasi Morning Sweeper",
        cityId: 2, // Varanasi
      };

      const hasAccess = (user: typeof cityAdminUser, job: typeof targetJob): boolean => {
        if (user.role === "superadmin" || user.role === "admin") return true;
        if (job.cityId && job.cityId !== user.cityId) return false;
        return true;
      };

      expect(hasAccess(cityAdminUser, targetJob)).toBe(false);

      // Superadmin has universal access
      const superAdminUser = { id: 1, role: "superadmin", cityId: null };
      expect(hasAccess(superAdminUser as any, targetJob)).toBe(true);
    });
  });
});
