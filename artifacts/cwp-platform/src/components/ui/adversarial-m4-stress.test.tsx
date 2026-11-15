import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StatCard } from "@/components/shared/StatCard";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";

// Polyfills for jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

describe("Adversarial Stress Test Suite (M4 Challenger)", () => {
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
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function render(ui: React.ReactElement) {
    act(() => {
      root.render(ui);
    });
  }

  // =========================================================================
  // FOCUS 1 & 2: StatCard & KPI rendering under null/undefined/0/extreme states
  // =========================================================================
  describe("StatCard Subtitle Polymorphism & Null/Undefined/Zero Robustness", () => {
    it("renders clean <p> tag when subtitle is a plain string", () => {
      render(
        <StatCard
          label="Total Schedulers"
          value={12}
          subtitle="4 active schedulers"
        />
      );

      const subtitleP = container.querySelector("p.mt-1.text-muted-foreground.text-xs");
      expect(subtitleP).not.toBeNull();
      expect(subtitleP?.tagName.toLowerCase()).toBe("p");
      expect(subtitleP?.textContent).toBe("4 active schedulers");
    });

    it("renders clean <div> wrapper when subtitle is a complex ReactNode (avoids <p> nesting)", () => {
      render(
        <StatCard
          label="Active Workers"
          value={0}
          tone="warning"
          subtitle={
            <span data-testid="amber-warning-badge" className="text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" /> 0 Active Workers (Idle)
            </span>
          }
        />
      );

      const badge = container.querySelector('[data-testid="amber-warning-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.parentElement?.tagName.toLowerCase()).toBe("div");
      expect(badge?.textContent).toContain("0 Active Workers (Idle)");
    });

    it("renders amber warning badge and warning tone when activeWorkersCount === 0", () => {
      const kpis = {
        totalJobs: 15,
        activeJobs: 10,
        activeWorkersCount: 0,
        successJobs24h: 120,
        failedJobs24h: 0,
        overdueJobs: 0,
        runningJobs: 0,
      };

      render(
        <StatCard
          label="Active Workers"
          value={kpis?.activeWorkersCount ?? 0}
          tone={(kpis?.activeWorkersCount ?? 0) > 0 ? "success" : "warning"}
          subtitle={
            (kpis?.activeWorkersCount ?? 0) > 0 ? (
              <span data-testid="cluster-healthy" className="text-xs text-blue-600 font-medium inline-flex items-center">
                Cluster Healthy
              </span>
            ) : (
              <span data-testid="cluster-warning" className="text-xs text-amber-600 font-medium inline-flex items-center">
                0 Active Workers (Idle)
              </span>
            )
          }
        />
      );

      const valueEl = container.querySelector("p.font-display");
      expect(valueEl?.textContent).toBe("0");
      expect(valueEl?.className).toContain("text-[hsl(var(--tone-warning-fg");

      const warningBadge = container.querySelector('[data-testid="cluster-warning"]');
      expect(warningBadge).not.toBeNull();
      expect(warningBadge?.textContent).toContain("0 Active Workers (Idle)");
      expect(container.querySelector('[data-testid="cluster-healthy"]')).toBeNull();
    });

    it("renders healthy cluster badge and success tone when activeWorkersCount > 0", () => {
      const kpis = {
        activeWorkersCount: 3,
      };

      render(
        <StatCard
          label="Active Workers"
          value={kpis?.activeWorkersCount ?? 0}
          tone={(kpis?.activeWorkersCount ?? 0) > 0 ? "success" : "warning"}
          subtitle={
            (kpis?.activeWorkersCount ?? 0) > 0 ? (
              <span data-testid="cluster-healthy" className="text-xs text-blue-600 font-medium inline-flex items-center">
                Cluster Healthy
              </span>
            ) : (
              <span data-testid="cluster-warning" className="text-xs text-amber-600 font-medium inline-flex items-center">
                0 Active Workers (Idle)
              </span>
            )
          }
        />
      );

      const valueEl = container.querySelector("p.font-display");
      expect(valueEl?.textContent).toBe("3");
      expect(valueEl?.className).toContain("text-[hsl(var(--tone-success-fg");

      const healthyBadge = container.querySelector('[data-testid="cluster-healthy"]');
      expect(healthyBadge).not.toBeNull();
      expect(healthyBadge?.textContent).toContain("Cluster Healthy");
      expect(container.querySelector('[data-testid="cluster-warning"]')).toBeNull();
    });

    it("safely handles null and undefined kpis object without throwing", () => {
      const nullKpis: any = null;
      const undefinedKpis: any = undefined;

      // Null case
      expect(() => {
        render(
          <div data-testid="kpi-grid">
            <StatCard
              label="Total Schedulers"
              value={nullKpis?.totalJobs ?? 0}
              subtitle={`${nullKpis?.activeJobs ?? 0} active`}
            />
            <StatCard
              label="Active Workers"
              value={nullKpis?.activeWorkersCount ?? 0}
              tone={(nullKpis?.activeWorkersCount ?? 0) > 0 ? "success" : "warning"}
              subtitle={
                (nullKpis?.activeWorkersCount ?? 0) > 0 ? (
                  <span>Cluster Healthy</span>
                ) : (
                  <span data-testid="null-warning">0 Active Workers (Idle)</span>
                )
              }
            />
            <StatCard
              label="24h Completed"
              value={nullKpis?.successJobs24h ?? 0}
              subtitle={`Avg ${nullKpis?.avgExecutionDurationMs ?? 0}ms`}
            />
            <StatCard
              label="24h Failed"
              value={nullKpis?.failedJobs24h ?? 0}
              tone={(nullKpis?.failedJobs24h ?? 0) > 0 ? "destructive" : "default"}
              subtitle={`${nullKpis?.retryQueueCount ?? 0} in retry backoff`}
            />
            <StatCard
              label="Pending / Overdue"
              value={nullKpis?.overdueJobs ?? 0}
              tone={(nullKpis?.overdueJobs ?? 0) > 0 ? "warning" : "default"}
              subtitle="Tolerance: 5 min"
            />
            <StatCard
              label="Running Now"
              value={nullKpis?.runningJobs ?? 0}
              subtitle="Skip-Locked Leased"
            />
          </div>
        );
      }).not.toThrow();

      expect(container.querySelector('[data-testid="null-warning"]')).not.toBeNull();

      // Undefined case
      expect(() => {
        render(
          <div data-testid="kpi-grid-undef">
            <StatCard
              label="Active Workers"
              value={undefinedKpis?.activeWorkersCount ?? 0}
              tone={(undefinedKpis?.activeWorkersCount ?? 0) > 0 ? "success" : "warning"}
              subtitle={
                (undefinedKpis?.activeWorkersCount ?? 0) > 0 ? (
                  <span>Cluster Healthy</span>
                ) : (
                  <span data-testid="undef-warning">0 Active Workers (Idle)</span>
                )
              }
            />
          </div>
        );
      }).not.toThrow();

      expect(container.querySelector('[data-testid="undef-warning"]')).not.toBeNull();
    });

    it("does not render subtitle when subtitle is undefined, null, or empty string", () => {
      render(
        <StatCard
          label="Test Null Subtitle"
          value={100}
          subtitle={null}
        />
      );
      expect(container.querySelector("p.mt-1.text-muted-foreground.text-xs")).toBeNull();

      render(
        <StatCard
          label="Test Undefined Subtitle"
          value={100}
          subtitle={undefined}
        />
      );
      expect(container.querySelector("p.mt-1.text-muted-foreground.text-xs")).toBeNull();

      render(
        <StatCard
          label="Test Empty String Subtitle"
          value={100}
          subtitle=""
        />
      );
      expect(container.querySelector("p.mt-1.text-muted-foreground.text-xs")).toBeNull();
    });
  });

  // =========================================================================
  // FOCUS 4: Combobox Search Filtering, Adversarial Inputs & Keyboard Bindings
  // =========================================================================
  describe("Combobox Adversarial Stress & Resiliency", () => {
    const stressOptions: ComboboxOption[] = [
      { value: "noida", label: "Noida", subLabel: "Sector 62 Hub", keywords: ["UP", "NCR", "Expressway"] },
      { value: "varanasi", label: "Varanasi", subLabel: "Sigra Central", keywords: ["Kashi", "Purvanchal", "Ghats"] },
      { value: "greater_noida", label: "Greater Noida", subLabel: "Knowledge Park III", keywords: ["Pari Chowk", "NCR"] },
      { value: "special_chars", label: "Zone (North [A+B])", subLabel: "Special *.* & ?!", keywords: ["regex(test)"] },
    ];

    it("filters options case-insensitively with mixed upper and lower case queries", () => {
      const onChange = vi.fn();
      render(<Combobox options={stressOptions} value="" onChange={onChange} />);

      const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
      act(() => {
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;

      // Query "NoIdA" should match both "Noida" and "Greater Noida"
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(searchInput, "NoIdA");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      });

      const items = document.querySelectorAll("[cmdk-item]");
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain("Noida");
      expect(items[1].textContent).toContain("Greater Noida");
    });

    it("filters correctly by keyword with leading and trailing whitespace", () => {
      const onChange = vi.fn();
      render(<Combobox options={stressOptions} value="" onChange={onChange} />);

      const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
      act(() => {
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;

      // Query "  Kashi  " matches Varanasi
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(searchInput, "   KaShI   ");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      });

      const items = document.querySelectorAll("[cmdk-item]");
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain("Varanasi");
    });

    it("handles adversarial regex characters without syntax errors or unhandled exceptions", () => {
      const onChange = vi.fn();
      render(<Combobox options={stressOptions} value="" onChange={onChange} />);

      const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
      act(() => {
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;

      // Adversarial regex syntax query: "[A+B])"
      expect(() => {
        act(() => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          setter?.call(searchInput, "[A+B])");
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }).not.toThrow();

      const items = document.querySelectorAll("[cmdk-item]");
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain("Zone (North [A+B])");
    });

    it("resets search term when popover closes and reopens", () => {
      const onChange = vi.fn();
      render(<Combobox options={stressOptions} value="" onChange={onChange} />);

      const trigger = container.querySelector('[role="combobox"]') as HTMLElement;

      // Open
      act(() => {
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      let searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(searchInput, "Ghats");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      });

      expect(document.querySelectorAll("[cmdk-item]").length).toBe(1);

      // Select Varanasi
      const item = document.querySelector("[cmdk-item]") as HTMLElement;
      act(() => {
        item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(onChange).toHaveBeenCalledWith("varanasi");

      // Re-open: search query should be reset to empty and show all options
      act(() => {
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      const reopenedItems = document.querySelectorAll("[cmdk-item]");
      expect(reopenedItems.length).toBe(stressOptions.length);
    });

    it("supports keyboard Enter selection on focused clear button", () => {
      const onChange = vi.fn();
      render(<Combobox options={stressOptions} value="noida" onChange={onChange} clearable={true} />);

      const clearBtn = container.querySelector('[data-testid="combobox-clear"]') as HTMLElement;
      expect(clearBtn).not.toBeNull();

      act(() => {
        clearBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith("");
    });

    it("supports Space key selection on focused clear button", () => {
      const onChange = vi.fn();
      render(<Combobox options={stressOptions} value="noida" onChange={onChange} clearable={true} />);

      const clearBtn = container.querySelector('[data-testid="combobox-clear"]') as HTMLElement;
      expect(clearBtn).not.toBeNull();

      act(() => {
        clearBtn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith("");
    });

    it("renders gracefully with empty options array []", () => {
      const onChange = vi.fn();
      render(<Combobox options={[]} value="" onChange={onChange} />);

      const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
      act(() => {
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(document.querySelector("[cmdk-empty]")).not.toBeNull();
      expect(document.querySelectorAll("[cmdk-item]").length).toBe(0);
    });
  });
});
