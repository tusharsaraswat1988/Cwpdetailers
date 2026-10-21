import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isTrustedApiUrl, resolveApiUrl } from "./apiConfig";

describe("fetchInterceptor logic", () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    });

    mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as Record<string, unknown>).__CWP_API_URL__;
    vi.unstubAllGlobals();
  });

  it("identifies trusted API calls and attaches credentials safely", async () => {
    localStorage.setItem("cwp_token_customer", "test_cust_token_123");

    // Simulate the interceptor behavior
    const intercept = (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (!isTrustedApiUrl(input)) return mockFetch(input, init);

      const resolved = resolveApiUrl(input);
      const headers = new Headers(init.headers);
      headers.set("X-Auth-Portal", "customer");
      headers.set("Authorization", `Bearer ${localStorage.getItem("cwp_token_customer")}`);

      return mockFetch(resolved, { ...init, headers });
    };

    // 1. Relative API call in web mode
    await intercept("/api/auth/me");
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const firstCallHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(firstCallHeaders.get("X-Auth-Portal")).toBe("customer");
    expect(firstCallHeaders.get("Authorization")).toBe("Bearer test_cust_token_123");

    // 2. Relative API call in native mode with configured remote API
    (globalThis as Record<string, unknown>).__CWP_API_URL__ = "https://production-api.cwpdetailers.com";
    await intercept("/api/customers/me");
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://production-api.cwpdetailers.com/api/customers/me",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const secondCallHeaders = mockFetch.mock.calls[1][1].headers as Headers;
    expect(secondCallHeaders.get("Authorization")).toBe("Bearer test_cust_token_123");

    // 3. Third-party call (Cloudinary upload) MUST NOT leak auth token or portal header
    const cloudinaryUrl = "https://api.cloudinary.com/v1_1/demo/image/upload";
    await intercept(cloudinaryUrl, { method: "POST" });
    expect(mockFetch).toHaveBeenLastCalledWith(cloudinaryUrl, { method: "POST" });
    const thirdCallHeaders = mockFetch.mock.calls[2][1]?.headers as Headers | undefined;
    expect(thirdCallHeaders?.get?.("Authorization")).toBeUndefined();
    expect(thirdCallHeaders?.get?.("X-Auth-Portal")).toBeUndefined();
  });
});
