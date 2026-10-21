import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
  }
});

describe("Notifications Route Authorization & Scoping", () => {
  it("rejects unauthenticated requests", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildNotificationQueryConditions } = await import("./notifications");

    expect(() =>
      buildNotificationQueryConditions({ user: undefined, scope: undefined }, {})
    ).toThrow(/Authentication required/i);
  });

  it("restricts regular customers and field staff strictly to their own user notifications", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildNotificationQueryConditions } = await import("./notifications");

    const customerReq = {
      user: { id: 42, role: "customer", companyId: 1, branchId: 10 } as any,
      scope: { isSuperAdmin: false, companyId: 1, branchIds: [10], franchiseeId: null } as any,
    };

    const conditions = buildNotificationQueryConditions(customerReq, {});
    // Non-admin should have exactly 1 condition: userId == 42
    expect(conditions.length).toBe(1);
  });

  it("allows super-admin to view all notifications or filter by specific target userId", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildNotificationQueryConditions } = await import("./notifications");

    const rootAdminReq = {
      user: { id: 1, role: "admin", companyId: null, branchId: null } as any,
      scope: { isSuperAdmin: true, companyId: null, branchIds: null, franchiseeId: null } as any,
    };

    const allConditions = buildNotificationQueryConditions(rootAdminReq, {});
    expect(allConditions.length).toBe(0);

    const userConditions = buildNotificationQueryConditions(rootAdminReq, { userId: "99" });
    expect(userConditions.length).toBe(1);
  });

  it("scopes admin notifications to include caller user alerts + tenant-scoped operational notifications", async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/cwp";
    }
    const { buildNotificationQueryConditions } = await import("./notifications");

    const branchAdminReq = {
      user: { id: 5, role: "admin", companyId: 1, branchId: 10 } as any,
      scope: { isSuperAdmin: false, companyId: 1, branchIds: [10], franchiseeId: null } as any,
    };

    const conditions = buildNotificationQueryConditions(branchAdminReq, {});
    // Should have 1 composite condition containing an OR of userPred and scopedAdminPred
    expect(conditions.length).toBe(1);
  });
});
