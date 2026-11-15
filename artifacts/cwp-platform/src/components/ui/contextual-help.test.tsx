import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ContextualHelp } from "./contextual-help";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";

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

describe("ContextualHelp Component & Shared Integrations (M1.2 & M1.3)", () => {
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
  });

  function render(ui: React.ReactElement) {
    act(() => {
      root.render(ui);
    });
  }

  describe("ContextualHelp Unit Tests", () => {
    it("renders trigger button with accessible label and visible focus ring classes", () => {
      render(
        <ContextualHelp
          title="Polygon Ray-Casting"
          content="Point-in-polygon algorithm determines address coverage."
        />
      );

      const trigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      ) as HTMLButtonElement;
      expect(trigger).toBeTruthy();
      expect(trigger.getAttribute("aria-label")).toBe("Polygon Ray-Casting");
      expect(trigger.className).toContain("focus-visible:ring-2");
      expect(trigger.className).toContain("focus-visible:ring-ring");
    });

    it("uses default accessible label when title is omitted", () => {
      render(<ContextualHelp content="General operational notes." />);

      const trigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      ) as HTMLButtonElement;
      expect(trigger.getAttribute("aria-label")).toBe("Contextual information");
    });

    it("renders popover variant with title and rich content on trigger click", () => {
      render(
        <ContextualHelp
          variant="popover"
          title="Automated Worker Health"
          content="Workers communicate via background lease locks in PostgreSQL."
        />
      );

      const trigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      ) as HTMLButtonElement;
      expect(trigger).toBeTruthy();

      act(() => {
        trigger.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      });

      // Content portalled to body
      const titleEl = document.querySelector("h4");
      expect(titleEl?.textContent).toBe("Automated Worker Health");
      expect(document.body.textContent).toContain(
        "Workers communicate via background lease locks in PostgreSQL."
      );
    });

    it("renders help icon when icon='help' is specified", () => {
      render(
        <ContextualHelp
          icon="help"
          title="Help Guide"
          content="Instructions for rule creation."
        />
      );

      const trigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      );
      expect(trigger?.querySelector("svg")).toBeTruthy();
    });
  });

  describe("PageHeader Integration (M1.3)", () => {
    it("renders PageHeader without help when help prop is omitted", () => {
      render(
        <PageHeader
          title="Operational Zones"
          description="Manage zones and rules."
        />
      );

      const title = container.querySelector('[data-testid="page-title"]');
      expect(title?.textContent).toBe("Operational Zones");
      const helpTrigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      );
      expect(helpTrigger).toBeNull();
    });

    it("renders ContextualHelp next to title when help object is provided", () => {
      render(
        <PageHeader
          title="Operational Zones"
          help={{
            title: "Zone Hierarchy",
            content: "Polygons supersede radius circles.",
            variant: "popover",
          }}
        />
      );

      const helpTrigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      );
      expect(helpTrigger).toBeTruthy();
      expect(helpTrigger?.getAttribute("aria-label")).toBe("Zone Hierarchy");
    });

    it("renders custom ReactNode when help prop is a React element", () => {
      render(
        <PageHeader
          title="Custom Help Page"
          help={<span data-testid="custom-help-badge">Custom Info</span>}
        />
      );

      const customBadge = container.querySelector(
        '[data-testid="custom-help-badge"]'
      );
      expect(customBadge).toBeTruthy();
      expect(customBadge?.textContent).toBe("Custom Info");
    });
  });

  describe("StatCard Integration (M1.3)", () => {
    it("renders StatCard without help when help prop is omitted", () => {
      render(<StatCard label="Active Workers" value={4} />);

      const helpTrigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      );
      expect(helpTrigger).toBeNull();
    });

    it("renders ContextualHelp tooltip next to label when help prop is provided", () => {
      render(
        <StatCard
          label="Active Workers"
          value={4}
          help={{
            title: "Worker Threads",
            content: "Active background workers polling queues.",
          }}
        />
      );

      const helpTrigger = container.querySelector(
        '[data-testid="contextual-help-trigger"]'
      );
      expect(helpTrigger).toBeTruthy();
      expect(helpTrigger?.getAttribute("aria-label")).toBe("Worker Threads");
    });
  });
});
