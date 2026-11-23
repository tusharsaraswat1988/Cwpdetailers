import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OperationalStageTracker } from "./OperationalStageTracker";
import { AdminIntelligencePlaybook, WORKFLOW_GUIDES } from "./AdminIntelligencePlaybook";
import { openAdminIntelligencePlaybook } from "./AdminIntelligenceDrawer";
import type { CommandCenterData } from "@/lib/operations/api";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockCommandCenterData: CommandCenterData = {
  date: "2026-11-24",
  cityId: 77,
  branchId: 2,
  metrics: {
    totalBookingsToday: 25,
    confirmedBookingsToday: 20,
    completedServicesToday: 15,
    inProgressServicesToday: 3,
    delayedServicesToday: 2,
    unassignedJobsToday: 4,
    openComplaintsCount: 1,
    activeStaffOnField: 6,
    pendingQualityReviewCount: 2,
    todayRevenueInr: 18500,
  },
  servicesBreakdown: {
    scheduled: 25,
    assigned: 16,
    enRoute: 2,
    inProgress: 3,
    completed: 15,
    delayed: 2,
    cancelled: 1,
  },
  immediateAttention: [],
  cityPerformance: [],
  staffNeedingIntervention: [],
  recentLiveActivity: [],
};

describe("Admin & Manager Intelligence System", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe("OperationalStageTracker", () => {
    it("renders all 6 service completion stages in sequence", () => {
      act(() => {
        root.render(<OperationalStageTracker data={mockCommandCenterData} />);
      });

      const tracker = container.querySelector("[data-testid='operational-stage-tracker']");
      expect(tracker).not.toBeNull();

      // Check all 6 stages exist
      expect(container.querySelector("[data-testid='stage-card-waiting_assignment']")).not.toBeNull();
      expect(container.querySelector("[data-testid='stage-card-assigned']")).not.toBeNull();
      expect(container.querySelector("[data-testid='stage-card-en_route']")).not.toBeNull();
      expect(container.querySelector("[data-testid='stage-card-in_progress']")).not.toBeNull();
      expect(container.querySelector("[data-testid='stage-card-quality_review']")).not.toBeNull();
      expect(container.querySelector("[data-testid='stage-card-completed']")).not.toBeNull();
    });

    it("calculates and displays completion rate accurately", () => {
      act(() => {
        root.render(<OperationalStageTracker data={mockCommandCenterData} />);
      });

      // 15 completed out of 25 total = 60%
      expect(container.textContent).toContain("60%");
      expect(container.textContent).toContain("Completion Rate");
    });

    it("surfaces prioritized action alert banners when unassigned or delayed jobs exist", () => {
      act(() => {
        root.render(<OperationalStageTracker data={mockCommandCenterData} />);
      });

      const unassignedAlert = container.querySelector("[data-testid='alert-unassigned-jobs']");
      expect(unassignedAlert).not.toBeNull();
      expect(unassignedAlert?.textContent).toContain("4 jobs require cleaner assignment");

      const delayedAlert = container.querySelector("[data-testid='alert-delayed-jobs']");
      expect(delayedAlert).not.toBeNull();
      expect(delayedAlert?.textContent).toContain("2 technicians are delayed en route");
    });

    it("fires onOpenPlaybook callback when stage guide is triggered", () => {
      const handleOpen = vi.fn();
      act(() => {
        root.render(<OperationalStageTracker data={mockCommandCenterData} onOpenPlaybook={handleOpen} />);
      });

      const guideBtn = container.querySelector("[data-testid='stage-tracker-guide-btn']") as HTMLButtonElement;
      expect(guideBtn).not.toBeNull();

      act(() => {
        guideBtn.click();
      });

      expect(handleOpen).toHaveBeenCalledWith("stage_tracking");
    });

    it("handles zero total bookings gracefully without dividing by zero", () => {
      const emptyData: CommandCenterData = {
        ...mockCommandCenterData,
        metrics: {
          ...mockCommandCenterData.metrics,
          totalBookingsToday: 0,
          completedServicesToday: 0,
          unassignedJobsToday: 0,
          delayedServicesToday: 0,
        },
      };

      act(() => {
        root.render(<OperationalStageTracker data={emptyData} />);
      });

      expect(container.textContent).toContain("0%");
      expect(container.querySelector("[data-testid='alert-unassigned-jobs']")).toBeNull();
      expect(container.querySelector("[data-testid='alert-delayed-jobs']")).toBeNull();
    });
  });

  describe("AdminIntelligencePlaybook", () => {
    it("includes all 6 required core administrative workflow guides", () => {
      const expectedWorkflows = [
        "branch_creation",
        "catalog_setup",
        "customer_onboarding",
        "service_assignment",
        "stage_tracking",
        "billing_payments",
      ];

      for (const id of expectedWorkflows) {
        const found = WORKFLOW_GUIDES.find((g) => g.id === id);
        expect(found).toBeDefined();
        expect(found?.steps.length).toBeGreaterThanOrEqual(4);
        expect(found?.commonPitfalls.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("renders the interactive playbook navigation and steps", () => {
      act(() => {
        root.render(<AdminIntelligencePlaybook initialWorkflow="branch_creation" />);
      });

      const playbook = container.querySelector("[data-testid='admin-intelligence-playbook']");
      expect(playbook).not.toBeNull();

      // Navigation entries
      expect(container.querySelector("[data-testid='playbook-nav-branch_creation']")).not.toBeNull();
      expect(container.querySelector("[data-testid='playbook-nav-catalog_setup']")).not.toBeNull();
      expect(container.querySelector("[data-testid='playbook-nav-customer_onboarding']")).not.toBeNull();
      expect(container.querySelector("[data-testid='playbook-nav-service_assignment']")).not.toBeNull();
      expect(container.querySelector("[data-testid='playbook-nav-stage_tracking']")).not.toBeNull();
      expect(container.querySelector("[data-testid='playbook-nav-billing_payments']")).not.toBeNull();

      // Content for branch creation
      expect(container.textContent).toContain("New Branch Creation & Network Setup");
      expect(container.textContent).toContain("Operating Model");
    });

    it("switches workflow content on navigation click", () => {
      act(() => {
        root.render(<AdminIntelligencePlaybook initialWorkflow="branch_creation" />);
      });

      const catalogBtn = container.querySelector("[data-testid='playbook-nav-catalog_setup']") as HTMLButtonElement;
      expect(catalogBtn).not.toBeNull();

      act(() => {
        catalogBtn.click();
      });

      expect(container.textContent).toContain("Product & Service Catalog Configuration");
      expect(container.textContent).toContain("City Availability Matrix");
    });

    it("filters workflows based on search input query", () => {
      act(() => {
        root.render(<AdminIntelligencePlaybook />);
      });

      const searchInput = container.querySelector("[data-testid='playbook-search-input']") as HTMLInputElement;
      expect(searchInput).not.toBeNull();

      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(searchInput, "invoice");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      });

      // Should display Billing & Payments
      expect(container.querySelector("[data-testid='playbook-nav-billing_payments']")).not.toBeNull();
      // Should hide Branch Creation
      expect(container.querySelector("[data-testid='playbook-nav-branch_creation']")).toBeNull();
    });

    it("toggles step completion and persists to localStorage", () => {
      act(() => {
        root.render(<AdminIntelligencePlaybook initialWorkflow="branch_creation" />);
      });

      const step1Check = container.querySelector("[data-testid='playbook-step-check-1']") as HTMLButtonElement;
      expect(step1Check).not.toBeNull();

      act(() => {
        step1Check.click();
      });

      // Verify step 1 has checked state
      expect(container.textContent).toContain("Done");

      // Verify localStorage was updated
      const stored = JSON.parse(localStorage.getItem("cwp_ops_playbook_completed_steps") || "{}");
      expect(stored.branch_creation).toContain(1);

      // Verify reset button appears and clears completed steps
      const resetBtn = container.querySelector("[data-testid='playbook-reset-steps-btn']") as HTMLButtonElement;
      expect(resetBtn).not.toBeNull();

      act(() => {
        resetBtn.click();
      });

      const updatedStored = JSON.parse(localStorage.getItem("cwp_ops_playbook_completed_steps") || "{}");
      expect(updatedStored.branch_creation).toEqual([]);
    });

    it("adapts OperationalStageTracker links to manager scope when on /manager route", () => {
      // Mock window location pathname
      const originalPath = window.location.pathname;
      try {
        Object.defineProperty(window, "location", {
          value: { ...window.location, pathname: "/manager/dashboard" },
          writable: true,
        });

        act(() => {
          root.render(<OperationalStageTracker data={mockCommandCenterData} />);
        });

        const unassignedLink = container.querySelector("[data-testid='alert-unassigned-jobs'] a");
        expect(unassignedLink?.getAttribute("href")).toBe("/manager/assign-services");
      } finally {
        Object.defineProperty(window, "location", {
          value: { ...window.location, pathname: originalPath },
          writable: true,
        });
      }
    });

    it("openAdminIntelligencePlaybook helper dispatches custom window event", () => {
      const listener = vi.fn();
      window.addEventListener("cwp:open-intelligence-playbook", listener);

      openAdminIntelligencePlaybook("service_assignment");

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail?.workflowKey).toBe("service_assignment");

      window.removeEventListener("cwp:open-intelligence-playbook", listener);
    });
  });
});
