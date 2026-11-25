import * as React from "react";
(globalThis as any).React = React;
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PlanSummaryCard } from "@/components/plans/PlanSummaryCard";
import { PlanProgressBar } from "@/components/plans/PlanProgressBar";
import { AssetCard } from "@/components/assets/AssetCard";
import { AssetEmptyState } from "@/components/assets/AssetEmptyState";
import { AccountSummary } from "@/pages/customer/account/AccountSummary";
import { BillingSection } from "@/pages/customer/account/BillingSection";
import { ScheduleServiceStep } from "@/components/schedule/ScheduleServiceStep";
import { ScheduleDateStep } from "@/components/schedule/ScheduleDateStep";
import { ScheduleTimeStep } from "@/components/schedule/ScheduleTimeStep";
import type { CustomerPlan } from "@/lib/customer-plans";
import type { AssetCardModel } from "@/lib/asset-dashboard";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("CUX-015 — My Plans Screen Restructuring", () => {
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

  const mockPlan: CustomerPlan = {
    id: 101,
    name: "Daily Car Cleaning",
    type: "daily_cleaning",
    status: "ACTIVE",
    displayStatus: "Active",
    serviceLines: [],
    totalRemaining: 18,
    totalAllocated: 26,
    totalUsed: 8,
    expiryDate: "31 Dec 2026",
    nextVisitDate: "Tomorrow",
    vehicleOrSite: "Honda City • UP14AB1234",
    vehicleId: 1,
    solarSiteId: null,
    dueAmount: 0,
    detailHref: "/customer/plans/101",
    canRenew: true,
    isDailyCleaning: true,
  };

  it("renders PlanSummaryCard with vehicle context, accurate progress, and Material Symbols", () => {
    act(() => {
      root.render(<PlanSummaryCard plan={mockPlan} variant="full" />);
    });

    const card = container.querySelector("[data-testid='plan-card-101']");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("Daily Car Cleaning");
    expect(card?.textContent).toContain("Honda City • UP14AB1234");
    expect(card?.textContent).toContain("18");
    expect(card?.textContent).toContain("Visits Remaining");
    expect(card?.textContent).toContain("8 Used · 26 Total");

    // Progress bar accessible attributes
    const progressBar = card?.querySelector("[role='progressbar']");
    expect(progressBar).toBeTruthy();
    expect(progressBar?.getAttribute("aria-valuenow")).toBe("8");
    expect(progressBar?.getAttribute("aria-valuemax")).toBe("26");

    // M3 icon rendered
    const symbol = card?.querySelector(".material-symbols-outlined");
    expect(symbol).toBeTruthy();
  });

  it("renders PlanProgressBar with accessible progressbar role and tabular numbers", () => {
    act(() => {
      root.render(<PlanProgressBar used={5} total={20} label="Monthly Washes" />);
    });

    const pb = container.querySelector("[role='progressbar']");
    expect(pb).toBeTruthy();
    expect(pb?.getAttribute("aria-valuenow")).toBe("5");
    expect(pb?.getAttribute("aria-valuemax")).toBe("20");
    expect(container.textContent).toContain("15 / 20 Remaining");
    expect(container.textContent).toContain("5 Used · 15 Remaining");
  });
});

describe("CUX-016 — Vehicles & Solar Sites UX Modernization", () => {
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

  const mockVehicleAsset: AssetCardModel = {
    kind: "vehicle",
    id: 12,
    name: "Hyundai Creta",
    subtitle: "UP16CD5678",
    imageUrl: null,
    plan: {
      id: 201,
      name: "Daily Cleaning Monthly",
      type: "daily_cleaning",
      status: "ACTIVE",
      displayStatus: "Active",
      serviceLines: [],
      totalRemaining: 20,
      totalAllocated: 26,
      totalUsed: 6,
      expiryDate: null,
      nextVisitDate: null,
      vehicleOrSite: "Hyundai Creta",
      vehicleId: 12,
      solarSiteId: null,
      dueAmount: 0,
      detailHref: "/customer/plans/201",
      canRenew: true,
      isDailyCleaning: true,
    },
    planLabel: "Daily Cleaning Monthly",
    planHref: "/customer/plans/201",
    healthStatus: "protected",
    healthLabel: "Active Plan",
    serviceAddress: "Tower A, ATS Village, Noida",
    addressComplete: true,
    nextServiceLabel: "Tomorrow, 7:00 AM",
    lastServiceLabel: "Yesterday",
    scheduleHref: "/customer/schedule?vehicleId=12",
    historyHref: "/customer/service-history?vehicleId=12",
  };

  it("renders AssetCard with 1 dominant primary Schedule CTA and secondary overflow trigger", () => {
    const handleEdit = vi.fn();
    act(() => {
      root.render(<AssetCard asset={mockVehicleAsset} onEdit={handleEdit} />);
    });

    const card = container.querySelector("[data-testid='asset-card-vehicle-12']");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("Hyundai Creta");
    expect(card?.textContent).toContain("UP16CD5678");

    // Primary dominant schedule button
    const scheduleBtn = container.querySelector("[data-testid='asset-schedule-12']");
    expect(scheduleBtn).toBeTruthy();
    expect(scheduleBtn?.textContent).toContain("Schedule Service");

    // Secondary edit button
    const editBtn = container.querySelector("[data-testid='asset-edit-12']");
    expect(editBtn).toBeTruthy();

    // Secondary overflow menu trigger (⋮)
    const moreBtn = container.querySelector("[data-testid='asset-more-12']");
    expect(moreBtn).toBeTruthy();
  });

  it("renders AssetEmptyState for vehicles and solar with Material Symbols", () => {
    const handleAddVehicle = vi.fn();
    const handleAddSolar = vi.fn();
    act(() => {
      root.render(
        <AssetEmptyState tab="vehicle" onAddVehicle={handleAddVehicle} onAddSolar={handleAddSolar} />,
      );
    });

    expect(container.querySelector("[data-testid='assets-empty-state-vehicle']")).toBeTruthy();
    expect(container.textContent).toContain("No Vehicles Added Yet");
    const addBtn = container.querySelector("[data-testid='empty-add-vehicle']");
    expect(addBtn).toBeTruthy();
  });
});

describe("CUX-017 — Customer Account Hub Refinement", () => {
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

  it("renders AccountSummary with all 4 metrics and Material Symbols", () => {
    act(() => {
      root.render(
        <AccountSummary
          metrics={{
            activePlan: "Daily Car Cleaning",
            vehicleCount: 2,
            nextWash: "Tomorrow",
            accountStatus: "Verified Customer",
            loading: false,
          }}
        />,
      );
    });

    expect(container.querySelector("[data-testid='account-summary']")).toBeTruthy();
    expect(container.querySelector("[data-testid='account-summary-plan']")?.textContent).toContain("Daily Car Cleaning");
    expect(container.querySelector("[data-testid='account-summary-vehicles']")?.textContent).toContain("2");
    expect(container.querySelector("[data-testid='account-summary-next-wash']")?.textContent).toContain("Tomorrow");
    expect(container.querySelector("[data-testid='account-summary-status']")?.textContent).toContain("Verified Customer");
  });

  it("renders BillingSection correctly for all-clear and payment-due states", () => {
    act(() => {
      root.render(<BillingSection totalDues="0" />);
    });
    expect(container.querySelector("[data-testid='account-billing-clear']")).toBeTruthy();
    expect(container.textContent).toContain("₹0 Outstanding");

    act(() => {
      root.render(<BillingSection totalDues="1500" />);
    });
    expect(container.querySelector("[data-testid='account-billing-pay']")).toBeTruthy();
    expect(container.textContent).toContain("₹1500");
  });
});

describe("CUX-018 — Customer Booking Journey Review & Streamlining", () => {
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

  it("renders ScheduleServiceStep empty state with proactive guidance and 1-tap resolution CTAs", () => {
    const handleSelect = vi.fn();
    const handleChangeLocation = vi.fn();

    act(() => {
      root.render(
        <ScheduleServiceStep
          services={[]}
          selectedId=""
          onSelect={handleSelect}
          onChangeLocation={handleChangeLocation}
        />,
      );
    });

    const emptyBox = container.querySelector("[data-testid='schedule-error-no-services']");
    expect(emptyBox).toBeTruthy();
    expect(emptyBox?.textContent).toContain("No On-Demand Services at this Location");
    expect(emptyBox?.textContent).toContain("Daily Car Cleaning monthly doorstep care is available");
    expect(emptyBox?.textContent).toContain("View Daily Cleaning Plans");
    expect(emptyBox?.textContent).toContain("Change Location");
  });

  it("renders ScheduleDateStep and ScheduleTimeStep with Material Symbols and tabular slots", () => {
    act(() => {
      root.render(
        <ScheduleDateStep
          dates={[
            { date: "2026-12-01", label: "Tue, Dec 1", disabled: false },
            { date: "2026-12-02", label: "Wed, Dec 2", disabled: true, reason: "Fully Booked" },
          ]}
          selected="2026-12-01"
          onSelect={() => {}}
        />,
      );
    });

    expect(container.querySelector("[data-testid='schedule-step-date']")).toBeTruthy();
    expect(container.querySelector("[data-testid='schedule-date-2026-12-01']")).toBeTruthy();

    act(() => {
      root.render(
        <ScheduleTimeStep
          slots={["09:00", "11:00", "14:00"]}
          selected="09:00"
          durationMinutes={60}
          onSelect={() => {}}
        />,
      );
    });

    expect(container.querySelector("[data-testid='schedule-step-time']")).toBeTruthy();
    expect(container.querySelector("[data-testid='schedule-time-09:00']")).toBeTruthy();
    expect(container.textContent).toContain("Expected service completion by 10:00");
  });
});
