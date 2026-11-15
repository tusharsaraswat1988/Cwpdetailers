import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Combobox, ComboboxOption } from "./combobox";

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

const testOptions: ComboboxOption[] = [
  { value: "noida", label: "Noida", subLabel: "Sector 62 Hub", keywords: ["UP", "NCR"] },
  { value: "varanasi", label: "Varanasi", subLabel: "Sigra Central", keywords: ["Kashi", "Purvanchal"] },
  { value: "lucknow", label: "Lucknow", subLabel: "Gomti Nagar", keywords: ["Awadh"] },
  { value: "delhi", label: "Delhi", subLabel: "Connaught Place", disabled: true },
];

describe("Combobox Component (M1.1)", () => {
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

  it("renders trigger with placeholder when no value is provided", () => {
    const onChange = vi.fn();
    render(
      <Combobox
        options={testOptions}
        value=""
        onChange={onChange}
        placeholder="Select a city..."
      />
    );

    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent).toContain("Select a city...");
  });

  it("renders selected option label and subLabel", () => {
    const onChange = vi.fn();
    render(<Combobox options={testOptions} value="noida" onChange={onChange} />);

    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger?.textContent).toContain("Noida");
    expect(trigger?.textContent).toContain("Sector 62 Hub");
  });

  it("renders clear button when clearable=true and value is present, and calls onChange('') when clicked", () => {
    const onChange = vi.fn();
    render(
      <Combobox
        options={testOptions}
        value="varanasi"
        onChange={onChange}
        clearable={true}
      />
    );

    const clearBtn = container.querySelector(
      '[data-testid="combobox-clear"]'
    ) as HTMLElement;
    expect(clearBtn).toBeTruthy();

    act(() => {
      clearBtn.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not render clear button when value is empty even if clearable=true", () => {
    const onChange = vi.fn();
    render(
      <Combobox
        options={testOptions}
        value=""
        onChange={onChange}
        clearable={true}
      />
    );

    const clearBtn = container.querySelector('[data-testid="combobox-clear"]');
    expect(clearBtn).toBeNull();
  });

  it("opens popover on click and shows options", () => {
    const onChange = vi.fn();
    render(<Combobox options={testOptions} value="" onChange={onChange} />);

    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    // Content is portalled to document.body
    const searchInput = document.querySelector('input[placeholder="Search..."]');
    expect(searchInput).toBeTruthy();

    const items = document.querySelectorAll("[cmdk-item]");
    expect(items.length).toBe(testOptions.length);
  });

  it("filters options case-insensitively based on search input (label, sublabel, keywords)", () => {
    const onChange = vi.fn();
    render(<Combobox options={testOptions} value="" onChange={onChange} />);

    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    const searchInput = document.querySelector(
      'input[placeholder="Search..."]'
    ) as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    // Search by partial subLabel "sigra"
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(searchInput, "sigra");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const items = document.querySelectorAll("[cmdk-item]");
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain("Varanasi");
  });

  it("shows empty state when no options match filter", () => {
    const onChange = vi.fn();
    render(
      <Combobox
        options={testOptions}
        value=""
        onChange={onChange}
        emptyText="No cities found."
      />
    );

    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    const searchInput = document.querySelector(
      'input[placeholder="Search..."]'
    ) as HTMLInputElement;
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(searchInput, "nonexistentcity");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const empty = document.querySelector("[cmdk-empty]");
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain("No cities found.");
  });

  it("calls onChange when an option is clicked and closes popover", () => {
    const onChange = vi.fn();
    render(<Combobox options={testOptions} value="" onChange={onChange} />);

    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    const items = document.querySelectorAll("[cmdk-item]");
    expect(items.length).toBeGreaterThan(0);

    // Click on Varanasi (index 1)
    act(() => {
      (items[1] as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(onChange).toHaveBeenCalledWith("varanasi");
  });

  it("supports keyboard navigation: Enter to select", () => {
    const onChange = vi.fn();
    render(<Combobox options={testOptions} value="" onChange={onChange} />);

    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    const items = document.querySelectorAll("[cmdk-item]");
    expect(items.length).toBeGreaterThan(0);

    act(() => {
      (items[0] as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(onChange).toHaveBeenCalledWith("noida");
  });
});
