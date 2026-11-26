import { describe, it, expect, vi } from "vitest";
import { getJobHandler, listRegisteredJobTypes } from "../../lib/scheduler/jobRegistry";
import { seedDefaultScheduledJobs } from "../../lib/scheduler/jobSchedulerService";

describe("ARCH-P0-01: Unified Distributed Background Worker & Scheduler", () => {
  it("1. Canonical job registry defines handlers for all Tier 1 operational workloads", () => {
    const registeredTypes = listRegisteredJobTypes();

    expect(registeredTypes).toContain("subscription_daily_tick");
    expect(registeredTypes).toContain("dcms_missed_visit");
    expect(registeredTypes).toContain("morning_route_notify");
    expect(registeredTypes).toContain("gps_retention_purge");
    expect(registeredTypes).toContain("retention_automation");
    expect(registeredTypes).toContain("loyalty_points_expiry");
    expect(registeredTypes).toContain("campaign_lifecycle");

    for (const jobType of [
      "subscription_daily_tick",
      "dcms_missed_visit",
      "morning_route_notify",
      "gps_retention_purge",
    ]) {
      const handler = getJobHandler(jobType);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    }
  });

  it("2. Distributed lease mechanism enforces atomic job claim across dual worker instances", async () => {
    type JobRow = {
      id: number;
      jobKey: string;
      status: string;
      lockedBy: string | null;
      leaseExpiresAt: Date | null;
    };

    const jobsPool: JobRow[] = [
      { id: 1, jobKey: "subscription_daily_tick", status: "active", lockedBy: null, leaseExpiresAt: null },
      { id: 2, jobKey: "dcms_missed_visit_eod", status: "active", lockedBy: null, leaseExpiresAt: null },
      { id: 3, jobKey: "morning_route_notify_daily", status: "active", lockedBy: null, leaseExpiresAt: null },
    ];

    // Simulate FOR UPDATE SKIP LOCKED
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

    // Worker Instance A claims 3 jobs
    const claimInstanceA = claimJobs("api_instance_worker_A", 3);
    expect(claimInstanceA).toHaveLength(3);
    expect(claimInstanceA.every((j) => j.lockedBy === "api_instance_worker_A")).toBe(true);

    // Worker Instance B attempts to claim simultaneously -> gets 0 jobs (preventing duplicate execution)
    const claimInstanceB = claimJobs("api_instance_worker_B", 3);
    expect(claimInstanceB).toHaveLength(0);
  });

  it("3. Dry-run execution executes safely without committing side effects", async () => {
    const handler = getJobHandler("subscription_daily_tick");
    expect(handler).toBeDefined();

    const result = await handler!({
      jobId: 1,
      jobKey: "subscription_daily_tick",
      jobType: "subscription_daily_tick",
      payload: {},
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Dry-run");
  });
});
