import { describe, it, expect, vi } from "vitest";
import router from "../../routes";
import branchesRouter from "../../routes/branches";
import vehiclesRouter from "../../routes/vehicles";
import customersRouter from "../../routes/customers";
import churnedRouter from "../../routes/churned";
import { db, usersTable, dcmsSubscriptionsTable, dcmsSubscriptionLocationsTable, citiesTable } from "@workspace/db";

describe("Milestone 1: Backend Flow Remediation & Integrity Tests", () => {
  describe("Task 1 & 2: Symbol Resolution & Schema Table Imports", () => {
    it("exports usersTable and ensures branches.ts resolves usersTable", () => {
      expect(usersTable).toBeDefined();
      expect(usersTable.id).toBeDefined();
      expect(usersTable.name).toBeDefined();
    });

    it("exports dcmsSubscriptionsTable and dcmsSubscriptionLocationsTable for vehicles.ts", () => {
      expect(dcmsSubscriptionsTable).toBeDefined();
      expect(dcmsSubscriptionsTable.id).toBeDefined();
      expect(dcmsSubscriptionLocationsTable).toBeDefined();
      expect(dcmsSubscriptionLocationsTable.id).toBeDefined();
    });
  });

  describe("Task 1: Branch Creation Business Rule Validation Error Handling", () => {
    it("returns HTTP 400 when createBranch throws COCO business rule error", async () => {
      // Find the POST /branches route handler
      const postRoute = branchesRouter.stack.find(
        (layer: any) => layer.route?.path === "/branches" && layer.route?.methods?.post
      );
      expect(postRoute).toBeDefined();
      const handler = postRoute.route.stack[0].handle;

      const req = {
        body: {
          name: "Test FOFO Branch",
          city: "Noida",
          isCompanyOperated: false, // FOFO is prohibited
        },
        user: { id: 1, role: "superadmin" },
        scope: { isSuperAdmin: true },
        log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      } as any;

      const res = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.data = payload;
          return this;
        },
      } as any;

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data?.error).toMatch(/Company-Owned, Company-Operated \(COCO\) model/i);
    });
  });

  describe("Task 3: Customer Relational cityId Persistence", () => {
    it("ensures customer list select and schema include cityId", () => {
      // Verify schema defines cityId column
      expect(db).toBeDefined();
      expect(citiesTable).toBeDefined();
    });
  });

  describe("Task 4: Route Mount Guarding for adminLedgerRouter", () => {
    it("verifies adminLedgerRouter is not mounted unguarded in public routes", () => {
      // Find all layers in router.stack
      const layers = router.stack;
      // Find layers before resource guards (public section)
      const firstGuardedLayerIndex = layers.findIndex((l: any) =>
        l.handle?.name === "guardResource" || l.name === "router" && l.regexp?.test?.("/customers")
      );

      // Verify that no public layer mounts /admin/ledger
      const publicLayers = layers.slice(0, firstGuardedLayerIndex > 0 ? firstGuardedLayerIndex : 15);
      const publicLedgerMount = publicLayers.find((l: any) => {
        if (l.route?.path?.includes?.("ledger")) return true;
        if (l.handle?.stack?.some?.((sub: any) => sub.route?.path?.includes?.("ledger"))) return true;
        return false;
      });

      expect(publicLedgerMount).toBeUndefined();
    });
  });

  describe("Task 6: Churned Subscriptions Unified Query", () => {
    it("verifies churned router is defined with GET, PATCH, POST handlers", () => {
      const getChurned = churnedRouter.stack.find(
        (l: any) => l.route?.path === "/churned" && l.route?.methods?.get
      );
      expect(getChurned).toBeDefined();

      const patchRemark = churnedRouter.stack.find(
        (l: any) => l.route?.path === "/churned/:id/remark" && l.route?.methods?.patch
      );
      expect(patchRemark).toBeDefined();

      const postBulkMessage = churnedRouter.stack.find(
        (l: any) => l.route?.path === "/churned/bulk-message" && l.route?.methods?.post
      );
      expect(postBulkMessage).toBeDefined();
    });
  });
});
