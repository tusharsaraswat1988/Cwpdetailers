import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MarketingCMSPage from "./MarketingCMSPage";

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

const mockCities = [
  { id: 71, name: "Varanasi", slug: "varanasi", status: "active", isActive: true },
  { id: 77, name: "Noida", slug: "noida", status: "setup_in_progress", isActive: true },
];

const mockBranches = [
  { id: 3, name: "CWP Varanasi Central", city: "Varanasi", cityId: 71, status: "active", isActive: true },
  { id: 4, name: "CWP Noida Sector 78", city: "Noida", cityId: 77, status: "active", isActive: true },
];

const mockSections = [
  {
    id: 1,
    sectionKey: "promotional_offers",
    title: "Varanasi Inaugural Discount",
    subtitle: "20% off for first 100 customers",
    cityId: 71,
    cityName: "Varanasi",
    branchId: 3,
    branchName: "CWP Varanasi Central",
    isEnabled: true,
    sortOrder: 1,
    content: {},
  },
];

describe("MKT-005: MarketingCMSPage Scope & Section Creation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let fetchMock: any;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const method = init?.method || "GET";

      if (urlStr.includes("/api/cities")) {
        return { ok: true, json: async () => mockCities };
      }
      if (urlStr.includes("/api/branches")) {
        return { ok: true, json: async () => mockBranches };
      }
      if (urlStr.includes("/api/marketing/sections")) {
        if (method === "POST") {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              section: {
                id: 2,
                sectionKey: "promotional_offers",
                title: "New Custom Section",
                cityId: 71,
                branchId: 3,
                isEnabled: true,
                sortOrder: 2,
              },
            }),
          };
        }
        if (method === "DELETE") {
          return { ok: true, json: async () => ({ success: true, id: 1 }) };
        }
        return { ok: true, json: async () => ({ sections: mockSections }) };
      }
      if (urlStr.includes("/api/marketing/campaigns")) {
        return { ok: true, json: async () => ({ campaigns: [] }) };
      }
      if (urlStr.includes("/api/marketing/media")) {
        return { ok: true, json: async () => ({ mediaAssets: [] }) };
      }
      if (urlStr.includes("/api/marketing/analytics")) {
        return {
          ok: true,
          json: async () => ({
            overview: {
              totalImpressions: 120,
              totalClicks: 24,
              ctrPercent: 20,
              totalCouponsApplied: 5,
              totalConversions: 4,
              attributedRevenue: 3500,
            },
            topCampaigns: [],
          }),
        };
      }
      if (urlStr.includes("/api/marketing/funnel/analytics")) {
        return {
          ok: true,
          json: async () => ({
            summary: {
              totalTopFunnelSessions: 50,
              totalConfirmedBookings: 10,
              overallConversionRate: 20,
              couponAppliedCount: 4,
              loyaltyRedeemedCount: 2,
              paymentFailedCount: 0,
              cancelledCount: 1,
            },
            stages: [],
            cityBreakdown: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders Marketing CMS hub with city and branch scope controls and sections list", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MarketingCMSPage />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain("City/Branch-Wise Marketing & Campaigns");
    expect(container.textContent).toContain("Marketing & CMS Hub");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container.textContent).toContain("Varanasi Inaugural Discount");
    expect(container.textContent).toContain("CWP Varanasi Central");
  });

  it("opens Add Custom Section dialog modal when '+ Add Custom Section' button is clicked", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MarketingCMSPage />
        </QueryClientProvider>
      );
    });

    const addBtn = container.querySelector('[data-testid="add-custom-section-btn"]') as HTMLButtonElement;
    expect(addBtn).not.toBeNull();

    await act(async () => {
      addBtn.click();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(document.body.textContent).toContain("Add Custom Homepage Section");
    expect(document.body.querySelector('[data-testid="input-section-title"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="save-section-btn"]')).not.toBeNull();
  });

  it("opens Edit Section dialog when pencil icon is clicked", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MarketingCMSPage />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const editBtn = container.querySelector('button[title="Edit Section"]') as HTMLButtonElement;
    expect(editBtn).not.toBeNull();

    await act(async () => {
      editBtn.click();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(document.body.textContent).toContain("Edit Homepage Section");
    const titleInput = document.body.querySelector('[data-testid="input-section-title"]') as HTMLInputElement;
    expect(titleInput.value).toBe("Varanasi Inaugural Discount");
  });

  it("opens Delete Confirmation dialog when trash icon is clicked", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MarketingCMSPage />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const deleteBtn = container.querySelector('button[title="Delete Section"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn.click();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(document.body.textContent).toContain("Delete Homepage Section");
    expect(document.body.textContent).toContain('Are you sure you want to remove "Varanasi Inaugural Discount"?');
  });
});
