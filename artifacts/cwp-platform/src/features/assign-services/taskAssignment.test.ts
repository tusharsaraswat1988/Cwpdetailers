import { describe, expect, it } from "vitest";
import {
  getTaskOperationalDescription,
  computeAssignmentButtonLabel,
} from "./pages/AssignServicesPage";
import type { ServiceTaskType } from "./api";

describe("Task Assignment Operational UX Logic (P0-B)", () => {
  describe("getTaskOperationalDescription", () => {
    it("returns distinct, meaningful descriptions for daily_cleaning and car_wash", () => {
      const dailyDesc = getTaskOperationalDescription("daily_cleaning");
      const washDesc = getTaskOperationalDescription("car_wash");

      expect(dailyDesc).toContain("Daily morning");
      expect(dailyDesc).toContain("exterior wipe");
      expect(washDesc).toContain("Full exterior");
      expect(washDesc).toContain("foam pressure wash");
      expect(dailyDesc).not.toBe(washDesc);
    });

    it("returns appropriate descriptions for solar_cleaning and interior_detailing", () => {
      expect(getTaskOperationalDescription("solar_cleaning")).toContain("Solar panel");
      expect(getTaskOperationalDescription("interior_detailing")).toContain("Cabin vacuuming");
    });

    it("returns fallback description for unknown task type", () => {
      expect(getTaskOperationalDescription("unknown" as ServiceTaskType)).toBe(
        "Scheduled service task execution."
      );
    });
  });

  describe("computeAssignmentButtonLabel", () => {
    it("returns 'Assigning…' when mutation is in flight", () => {
      const label = computeAssignmentButtonLabel({
        isPending: true,
        totalTasks: 2,
        unassignedTasks: 2,
      });
      expect(label).toBe("Assigning…");
    });

    it("returns 'All tasks assigned' when all required tasks have staff assigned", () => {
      const label = computeAssignmentButtonLabel({
        isPending: false,
        totalTasks: 2,
        unassignedTasks: 0,
      });
      expect(label).toBe("All tasks assigned");
    });

    it("returns 'Assign both tasks' for a 2-task plan when neither is assigned yet", () => {
      const label = computeAssignmentButtonLabel({
        isPending: false,
        totalTasks: 2,
        unassignedTasks: 2,
      });
      expect(label).toBe("Assign both tasks");
    });

    it("returns 'Assign remaining task' when one task of a multi-task plan is already assigned", () => {
      const label = computeAssignmentButtonLabel({
        isPending: false,
        totalTasks: 2,
        unassignedTasks: 1,
      });
      expect(label).toBe("Assign remaining task");
    });

    it("returns 'Assign technician' for a single-task service", () => {
      const label = computeAssignmentButtonLabel({
        isPending: false,
        totalTasks: 1,
        unassignedTasks: 1,
      });
      expect(label).toBe("Assign technician");
    });
  });
});
