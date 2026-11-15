import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectivityProvider } from "@/services/ConnectivityContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProductsAndPlansPage from "./ProductsAndPlans";

// Polyfills for jsdom
(globalThis as any).React = React;
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

// Mock auth
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, phone: "9999999999", role: "admin", name: "Admin" },
    isLoading: false,
    hasPermission: () => true,
  }),
}));

// Mock branding
vi.mock("@/lib/branding", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useBranding: () => ({ brandName: "CWP Detailers", cssVariables: {} }),
    useBrandingPortal: () => ({ brandName: "CWP Detailers", cssVariables: {} }),
    BrandLoader: () => <div>Loading...</div>,
  };
});

// Mock store
vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) => selector({
    sidebarCollapsed: false,
    toggleSidebar: vi.fn(),
    activeBranchId: 1,
    activeCityId: 1,
  }),
}));

// Mock fetch
globalThis.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes("/api/branches")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 1, name: "Varanasi Central", city: "Varanasi", cityId: 1 }]),
    });
  }
  if (url.includes("/api/masters/cities")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 1, name: "Varanasi", slug: "varanasi", isActive: true }]),
    });
  }
  if (url.includes("/api/services")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([
        { id: 1, name: "Foam Wash", slug: "foam-wash", category: "doorstep_wash", basePrice: "499", isActive: true },
        { id: 2, name: "1 Time Wash", slug: null, category: "subscription", basePrice: "999", isActive: true },
      ]),
    });
  }
  if (url.includes("/api/catalog/matrix") || url.includes("/api/catalog/city-availability")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
  }
  if (url.includes("/api/catalog/settings")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ defaultPricingType: "inclusive", defaultGstRate: 18 }),
    });
  }
  if (url.includes("/api/catalog/homepage")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
  }
  if (url.includes("/api/branch-assignments/my-branches")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 1, name: "Varanasi Central", city: "Varanasi", cityId: 1 }]),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
  });
}) as any;

describe("ProductsAndPlansPage with ?tab=city matrix", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders with tab=city matrix and checks if city-matrix tab is active", async () => {
    delete (window as any).location;
    window.location = new URL("http://localhost:3000/admin/services?tab=city%20matrix") as any;

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ConnectivityProvider>
              <ProductsAndPlansPage />
            </ConnectivityProvider>
          </TooltipProvider>
        </QueryClientProvider>
      );
    });

    // Check if City Availability Matrix is rendered
    const matrixEl = container.querySelector('[data-testid="city-availability-matrix"]');
    console.log("Matrix rendered with tab=city matrix?", Boolean(matrixEl));
    console.log("Active tab button text:", container.querySelector('button[role="tab"][aria-selected="true"]')?.textContent);
  });

  it("renders with tab=city-matrix and tests CityAvailabilityMatrix functionality", async () => {
    delete (window as any).location;
    window.location = new URL("http://localhost:3000/admin/services?tab=city-matrix") as any;

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ConnectivityProvider>
              <ProductsAndPlansPage />
            </ConnectivityProvider>
          </TooltipProvider>
        </QueryClientProvider>
      );
    });

    const matrixEl = container.querySelector('[data-testid="city-availability-matrix"]');
    console.log("Matrix rendered with tab=city-matrix?", Boolean(matrixEl));

    // Try typing in search box when a service has slug: null
    const searchInput = container.querySelector('input[placeholder*="Search service"]') as HTMLInputElement;
    if (searchInput) {
      await act(async () => {
        searchInput.value = "wash";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  });
});
