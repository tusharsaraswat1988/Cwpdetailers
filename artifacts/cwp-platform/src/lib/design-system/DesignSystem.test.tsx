import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MaterialSymbol } from "./MaterialSymbol";
import { CwpStatusBadge } from "./CwpStatusBadge";
import { EmptyState } from "./EmptyState";
import { CwpCurrency, formatInr } from "./CwpCurrency";
import { CwpButton } from "./CwpButton";
import { CWP_PRIMITIVE_COLORS, CWP_SEMANTIC, M3_ICON_SPECS, CWP_ROLE_SCALES } from "./tokens";
import { StatusBadge, getStatusIcon } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState as SharedEmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { OfflineState } from "@/components/shared/OfflineState";
import { PermissionDeniedState } from "@/components/shared/PermissionDeniedState";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Toast, ToastClose, ToastProvider, ToastViewport } from "@/components/ui/toast";

// Polyfills for jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("CWP Universal Design System — Foundation Tokens", () => {
  it("defines canonical DTCG brand primitives", () => {
    expect(CWP_PRIMITIVE_COLORS.blue500).toBe("#1677FF");
    expect(CWP_PRIMITIVE_COLORS.dark900).toBe("#0B1D36");
    expect(CWP_PRIMITIVE_COLORS.green600).toBe("#16A34A");
    expect(CWP_PRIMITIVE_COLORS.red600).toBe("#DC2626");
  });

  it("contains complete semantic status mappings with M3 icon references", () => {
    expect(CWP_SEMANTIC.color.status.completed.icon).toBe("check_circle");
    expect(CWP_SEMANTIC.color.status.pending.icon).toBe("schedule");
    expect(CWP_SEMANTIC.color.status.syncPending.icon).toBe("sync");
    expect(CWP_SEMANTIC.color.status.cancelled.icon).toBe("cancel");
    expect(CWP_SEMANTIC.color.status.enRoute.icon).toBe("directions_car");
  });

  it("defines role-adapted scales for Admin, Staff, and Customer", () => {
    expect(CWP_ROLE_SCALES.admin.controlHeight).toBe("2.25rem");
    expect(CWP_ROLE_SCALES.staff.controlHeight).toBe("3.25rem");
    expect(CWP_ROLE_SCALES.customer.controlHeight).toBe("3rem");
    expect(CWP_ROLE_SCALES.staff.touchMin).toBe("3rem"); // 48px minimum
  });
});

describe("CWP Universal Design System — Components", () => {
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

  it("renders a decorative Material Symbol with aria-hidden", () => {
    act(() => {
      root.render(<MaterialSymbol name="directions_car" size="md" />);
    });
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span?.getAttribute("aria-hidden")).toBe("true");
    expect(span?.getAttribute("data-m3-symbol")).toBe("directions_car");
    expect(span?.textContent).toBe("directions_car");
    expect(span?.style.fontSize).toBe("24px");
  });

  it("renders an accessible Material Symbol when label is provided", () => {
    act(() => {
      root.render(<MaterialSymbol name="verified" size="sm" label="Verified Account" />);
    });
    const span = container.querySelector("span[aria-label='Verified Account']");
    expect(span).toBeTruthy();
    expect(span?.getAttribute("role")).toBe("img");
    expect(span?.getAttribute("aria-label")).toBe("Verified Account");
    expect(span?.style.fontSize).toBe("18px");
  });

  it("applies font variation settings for fill and stroke weight", () => {
    act(() => {
      root.render(<MaterialSymbol name="star" size="lg" weight={500} fill={true} />);
    });
    const span = container.querySelector("span");
    expect(span?.style.fontVariationSettings).toContain("'FILL' 1");
    expect(span?.style.fontVariationSettings).toContain("'wght' 500");
    expect(span?.style.fontSize).toBe("32px");
  });

  it("renders a non-color-only status badge with icon and label", () => {
    act(() => {
      root.render(<CwpStatusBadge tone="completed" label="काम पूरा हुआ" />);
    });
    const badge = container.querySelector("[data-testid='cwp-status-badge']");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain("काम पूरा हुआ");
    expect(badge?.querySelector("[data-m3-symbol='check_circle']")).toBeTruthy();
  });

  it("renders syncPending status badge for offline resilience", () => {
    act(() => {
      root.render(<CwpStatusBadge tone="syncPending" label="सिंक पेंडिंग" />);
    });
    const badge = container.querySelector("[data-testid='cwp-status-badge']");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain("सिंक पेंडिंग");
    expect(badge?.querySelector("[data-m3-symbol='sync']")).toBeTruthy();
  });

  it("renders encouraging headline, description, and handles action clicks in EmptyState", () => {
    const handleAction = vi.fn();
    const handleSecondary = vi.fn();

    act(() => {
      root.render(
        <EmptyState
          icon="directions_car"
          title="No vehicles registered yet"
          description="Add your first car to book daily cleaning or washing services."
          action={{
            label: "Add Vehicle",
            onClick: handleAction,
            icon: "add",
          }}
          secondaryAction={{
            label: "Learn More",
            onClick: handleSecondary,
          }}
        />
      );
    });

    expect(container.textContent).toContain("No vehicles registered yet");
    expect(
      container.textContent
    ).toContain("Add your first car to book daily cleaning or washing services.");

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);

    act(() => {
      buttons[0].click();
    });
    expect(handleAction).toHaveBeenCalledTimes(1);

    act(() => {
      buttons[1].click();
    });
    expect(handleSecondary).toHaveBeenCalledTimes(1);
  });

  it("formats Indian Rupee currency with tabular numerals and alignment classes", () => {
    expect(formatInr(1500)).toBe("₹1,500");
    expect(formatInr(125000.5, { minimumFractionDigits: 2 })).toBe("₹1,25,000.50");
    expect(formatInr(null)).toBe("—");

    act(() => {
      root.render(<CwpCurrency value={45000} tone="success" />);
    });
    const currency = container.querySelector("[data-testid='cwp-currency']");
    expect(currency).toBeTruthy();
    expect(currency?.textContent).toBe("₹45,000");
    expect(currency?.className).toContain("tabular-nums");
    expect(currency?.className).toContain("font-mono");
    expect(currency?.className).toContain("text-emerald-600");
  });

  it("renders role-adapted buttons with correct dimensions and M3 icons", () => {
    act(() => {
      root.render(
        <CwpButton roleVariant="staff" size="md" startIcon="camera_alt">
          फोटो लें
        </CwpButton>
      );
    });
    const staffBtn = container.querySelector("[data-testid='cwp-button']");
    expect(staffBtn).toBeTruthy();
    expect(staffBtn?.getAttribute("data-role-variant")).toBe("staff");
    expect(staffBtn?.className).toContain("min-h-[48px]"); // Staff 48px touch target
    expect(staffBtn?.textContent).toContain("फोटो लें");
    expect(staffBtn?.querySelector("[data-m3-symbol='camera_alt']")).toBeTruthy();
  });

  it("StatusBadge uses official Material Symbols for completed, pending, and in_progress", () => {
    act(() => {
      root.render(
        <div>
          <StatusBadge status="completed" label="Done" />
          <StatusBadge status="pending" label="Waiting" />
          <StatusBadge status="in_progress" label="Working" />
        </div>
      );
    });
    const badges = container.querySelectorAll("[data-testid='status-badge']");
    expect(badges.length).toBe(3);
    expect(badges[0].querySelector("[data-m3-symbol='check_circle']")).toBeTruthy();
    expect(badges[1].querySelector("[data-m3-symbol='schedule']")).toBeTruthy();
    expect(badges[2].querySelector("[data-m3-symbol='sync']")).toBeTruthy();
  });

  it("getStatusIcon returns Material Symbols across all semantic tones", () => {
    const successIcon = getStatusIcon("completed", "success");
    const warningIcon = getStatusIcon("pending", "warning");
    const destructiveIcon = getStatusIcon("cancelled", "destructive");

    expect(React.isValidElement(successIcon)).toBe(true);
    expect((successIcon as React.ReactElement).props.name).toBe("check_circle");

    expect(React.isValidElement(warningIcon)).toBe(true);
    expect((warningIcon as React.ReactElement).props.name).toBe("schedule");

    expect(React.isValidElement(destructiveIcon)).toBe(true);
    expect((destructiveIcon as React.ReactElement).props.name).toBe("cancel");
  });

  it("enforces WCAG 2.2 AA compliant focus ring on Button, Input, and Textarea primitives", () => {
    act(() => {
      root.render(
        <div>
          <Button data-testid="test-btn">Click</Button>
          <Input data-testid="test-input" placeholder="Type..." />
          <Textarea data-testid="test-textarea" placeholder="Notes..." />
        </div>
      );
    });
    const btn = container.querySelector("[data-testid='test-btn']");
    const input = container.querySelector("[data-testid='test-input']");
    const textarea = container.querySelector("[data-testid='test-textarea']");

    expect(btn?.className).toContain("focus-visible:ring-2");
    expect(btn?.className).toContain("focus-visible:ring-primary");
    expect(btn?.className).toContain("focus-visible:ring-offset-2");

    expect(input?.className).toContain("focus-visible:ring-2");
    expect(input?.className).toContain("focus-visible:ring-primary");
    expect(input?.className).toContain("focus-visible:ring-offset-2");

    expect(textarea?.className).toContain("focus-visible:ring-2");
    expect(textarea?.className).toContain("focus-visible:ring-primary");
    expect(textarea?.className).toContain("focus-visible:ring-offset-2");
  });

  it("shared states (EmptyState, ErrorState, OfflineState, PermissionDeniedState) render Material Symbols", () => {
    act(() => {
      root.render(
        <div>
          <SharedEmptyState title="Nothing" />
          <ErrorState title="Failed" />
          <OfflineState />
          <PermissionDeniedState />
        </div>
      );
    });
    expect(container.querySelector("[data-testid='empty-state'] [data-m3-symbol='inbox']")).toBeTruthy();
    expect(container.querySelector("[data-testid='error-state'] [data-m3-symbol='error']")).toBeTruthy();
    expect(container.querySelector("[data-testid='offline-state'] [data-m3-symbol='wifi_off']")).toBeTruthy();
    expect(container.querySelector("[data-testid='permission-denied-state'] [data-m3-symbol='shield']")).toBeTruthy();
  });

  it("Dialog and Sheet close buttons render canonical M3 Material Symbols with close icon", () => {
    act(() => {
      root.render(
        <div>
          <Dialog open={true}>
            <DialogContent data-testid="test-dialog">
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog Description</DialogDescription>
              <p>Dialog Body</p>
            </DialogContent>
          </Dialog>
        </div>
      );
    });

    const dialogContent = document.body.querySelector("[data-testid='test-dialog']");
    expect(dialogContent).toBeTruthy();
    const closeBtn = dialogContent?.querySelector("button:has([data-m3-symbol='close'])");
    expect(closeBtn).toBeTruthy();
    expect(closeBtn?.className).toContain("z-20");

    act(() => {
      root.render(
        <div>
          <Sheet open={true}>
            <SheetContent data-testid="test-sheet">
              <SheetTitle>Sheet Title</SheetTitle>
              <SheetDescription>Sheet Description</SheetDescription>
              <p>Sheet Body</p>
            </SheetContent>
          </Sheet>
        </div>
      );
    });

    const sheetContent = document.body.querySelector("[data-testid='test-sheet']");
    expect(sheetContent).toBeTruthy();
    const sheetCloseBtn = sheetContent?.querySelector("button:has([data-m3-symbol='close'])");
    expect(sheetCloseBtn).toBeTruthy();
  });

  it("ToastClose renders canonical Material Symbol close icon", () => {
    act(() => {
      root.render(
        <ToastProvider>
          <Toast open={true}>
            <span>Toast Message</span>
            <ToastClose data-testid="toast-close-btn" />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );
    });

    const toastClose = document.body.querySelector("[data-testid='toast-close-btn']");
    expect(toastClose).toBeTruthy();
    expect(toastClose?.querySelector("[data-m3-symbol='close']")).toBeTruthy();
  });
});
