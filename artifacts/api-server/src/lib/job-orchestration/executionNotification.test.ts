import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
  }
});

describe("Execution Completion Admin Notification Payload (P0-C)", () => {
  it("generates deterministic deduplication key based on execution jobId", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildExecutionCompletionNotificationData } = await import("./jobOrchestrationService");

    const data1 = buildExecutionCompletionNotificationData({
      jobId: 1042,
      customerName: "Kritika Pandey",
      vehicleLabel: "25BH0955N",
      taskType: "daily_cleaning",
      staffName: "Rahul Sharma",
      completedAt: new Date("2026-10-22T08:30:00.000Z"),
    });

    const data2 = buildExecutionCompletionNotificationData({
      jobId: 1042,
      customerName: "Kritika Pandey",
      vehicleLabel: "25BH0955N",
      taskType: "daily_cleaning",
      staffName: "Rahul Sharma",
      completedAt: new Date("2026-10-22T08:30:00.000Z"),
    });

    expect(data1.dedupeKey).toBe("execution_completed:1042");
    expect(data2.dedupeKey).toBe(data1.dedupeKey);
  });

  it("formats notification title and body with all operational details", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildExecutionCompletionNotificationData } = await import("./jobOrchestrationService");

    const completedAt = new Date("2026-10-22T09:15:00.000Z");
    const data = buildExecutionCompletionNotificationData({
      jobId: 88,
      customerName: "Vikram Malhotra",
      vehicleLabel: "DL01AB1234",
      taskType: "car_wash",
      staffName: "Amit Kumar",
      completedAt,
      companyId: 1,
      branchId: 5,
      franchiseeId: null,
    });

    expect(data.title).toBe("Field Work Completed — Full Wash");
    expect(data.message).toContain("Customer: Vikram Malhotra");
    expect(data.message).toContain("Vehicle: DL01AB1234");
    expect(data.message).toContain("Task: Full Wash");
    expect(data.message).toContain("Staff: Amit Kumar");
    expect(data.message).toContain(completedAt.toISOString());
    expect(data.externalId).toBe("/admin/jobs?id=88");
    expect(data.companyId).toBe(1);
    expect(data.branchId).toBe(5);
    expect(data.franchiseeId).toBeNull();
    expect(data.type).toBe("service_complete");
    expect(data.channel).toBe("in_app");
    expect(data.deliveryStatus).toBe("sent");
  });

  it("handles fallback gracefully when optional customer, vehicle or staff details are null", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildExecutionCompletionNotificationData } = await import("./jobOrchestrationService");

    const data = buildExecutionCompletionNotificationData({
      jobId: 99,
      customerName: null,
      vehicleLabel: null,
      taskType: "daily_cleaning",
      staffName: null,
      completedAt: null,
      companyId: null,
      branchId: null,
      franchiseeId: null,
    });

    expect(data.title).toBe("Field Work Completed — Daily Clean");
    expect(data.message).toContain("Customer: Customer");
    expect(data.message).toContain("Vehicle: Vehicle");
    expect(data.message).toContain("Task: Daily Clean");
    expect(data.message).toContain("Staff: Technician");
    expect(data.companyId).toBeNull();
    expect(data.branchId).toBeNull();
    expect(data.franchiseeId).toBeNull();
  });

  it("produces distinct deduplication keys for separate tasks on the same contract/customer", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildExecutionCompletionNotificationData } = await import("./jobOrchestrationService");

    // Task 1: Daily Clean (Execution 501)
    const task1 = buildExecutionCompletionNotificationData({
      jobId: 501,
      customerName: "Kritika Pandey",
      vehicleLabel: "25BH0955N",
      taskType: "daily_cleaning",
      staffName: "Rahul Sharma",
    });

    // Task 2: Full Wash (Execution 502)
    const task2 = buildExecutionCompletionNotificationData({
      jobId: 502,
      customerName: "Kritika Pandey",
      vehicleLabel: "25BH0955N",
      taskType: "car_wash",
      staffName: "Amit Kumar",
    });

    expect(task1.dedupeKey).toBe("execution_completed:501");
    expect(task2.dedupeKey).toBe("execution_completed:502");
    expect(task1.dedupeKey).not.toBe(task2.dedupeKey);
    expect(task1.title).toBe("Field Work Completed — Daily Clean");
    expect(task2.title).toBe("Field Work Completed — Full Wash");
  });
});
