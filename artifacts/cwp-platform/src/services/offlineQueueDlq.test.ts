import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock idb and apiRetry before importing offlineQueue
const memoryStore = {
  queue: [] as any[],
};

vi.mock("./idb", () => ({
  isIndexedDBAvailable: () => false, // Test fallback localStorage path reliably
  idbGetAll: vi.fn(),
  idbPut: vi.fn(),
  idbDelete: vi.fn(),
}));

const mockFetchWithRetry = vi.fn();
vi.mock("./apiRetry", () => ({
  fetchWithRetry: (...args: any[]) => mockFetchWithRetry(...args),
}));

vi.mock("./connectivityService", () => ({
  connectivityService: {
    canExecuteWrites: () => true,
    markSyncSuccess: vi.fn(),
  },
}));

import {
  offlineQueue,
  classifySyncError,
  handleConflictResponse,
  extractEntityRef,
  MAX_RETRY_ATTEMPTS,
  type QueueItem,
} from "./offlineQueue";

describe("ARCH-P1-02: Offline Queue Dead Letter Queue (DLQ) & Bounded Retry Architecture", () => {
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStore = {};
    vi.unstubAllGlobals();
  });

  describe("1. Error Classification Engine", () => {
    it("1. classifies HTTP 400 Bad Request as permanent validation failure (non-retryable)", () => {
      const result = classifySyncError(new Error("HTTP 400"), { status: 400 } as Response);
      expect(result.classification).toBe("permanent_validation");
      expect(result.isRetryable).toBe(false);
      expect(result.httpStatus).toBe(400);
      expect(result.safeMessage).toContain("400");
    });

    it("2. classifies HTTP 422 Unprocessable Entity as permanent validation failure (non-retryable)", () => {
      const result = classifySyncError(new Error("HTTP 422"), { status: 422 } as Response);
      expect(result.classification).toBe("permanent_validation");
      expect(result.isRetryable).toBe(false);
      expect(result.httpStatus).toBe(422);
      expect(result.safeMessage).toContain("422");
    });

    it("3. classifies HTTP 403 Forbidden as permanent authorization failure (non-retryable)", () => {
      const result = classifySyncError(new Error("HTTP 403"), { status: 403 } as Response);
      expect(result.classification).toBe("permanent_forbidden");
      expect(result.isRetryable).toBe(false);
      expect(result.httpStatus).toBe(403);
      expect(result.safeMessage).toContain("Unauthorized");
    });

    it("4. classifies network loss / fetch failures as retryable network errors", () => {
      const result = classifySyncError(new TypeError("Failed to fetch"));
      expect(result.classification).toBe("retryable_network");
      expect(result.isRetryable).toBe(true);
      expect(result.httpStatus).toBeNull();
      expect(result.safeMessage).toContain("Network connection unavailable");
    });

    it("5. classifies HTTP 5xx server errors as retryable server errors", () => {
      const res500 = classifySyncError(new Error("HTTP 500"), { status: 500 } as Response);
      expect(res500.classification).toBe("retryable_server");
      expect(res500.isRetryable).toBe(true);
      expect(res500.httpStatus).toBe(500);

      const res503 = classifySyncError(new Error("HTTP 503"), { status: 503 } as Response);
      expect(res503.classification).toBe("retryable_server");
      expect(res503.isRetryable).toBe(true);
      expect(res503.httpStatus).toBe(503);
    });

    it("6. classifies HTTP 429 Too Many Requests as retryable with rate-limit guidance", () => {
      const result = classifySyncError(new Error("HTTP 429"), { status: 429 } as Response);
      expect(result.classification).toBe("retryable_server");
      expect(result.isRetryable).toBe(true);
      expect(result.httpStatus).toBe(429);
      expect(result.safeMessage).toContain("rate-limited");
    });

    it("7. classifies HTTP 408 Request Timeout as retryable server failure", () => {
      const result = classifySyncError(new Error("HTTP 408"), { status: 408 } as Response);
      expect(result.classification).toBe("retryable_server");
      expect(result.isRetryable).toBe(true);
      expect(result.httpStatus).toBe(408);
      expect(result.safeMessage).toContain("timed out");
    });

    it("8. classifies HTTP 401 Unauthorized as auth_required and pauses queue", () => {
      const result = classifySyncError(new Error("HTTP 401"), { status: 401 } as Response);
      expect(result.classification).toBe("auth_required");
      expect(result.isRetryable).toBe(false);
      expect(result.httpStatus).toBe(401);
      expect(result.safeMessage).toContain("Session expired");
    });

    it("9. classifies HTTP 409 Conflict with workflow-specific inspection", () => {
      const itemPunch: QueueItem = {
        id: "1",
        type: "staff_attendance",
        label: "Morning Punch",
        url: "/api/staff/10/attendance",
        method: "POST",
        headers: {},
        body: JSON.stringify({ date: "2026-11-26" }),
        createdAt: new Date().toISOString(),
        retries: 0,
        status: "pending",
      };

      // Attendance punch conflict means attendance is already on server -> reconciled
      expect(handleConflictResponse(itemPunch, new Error("Already punched"))).toBe(true);

      const itemBooking: QueueItem = {
        ...itemPunch,
        type: "booking",
        url: "/api/bookings",
      };
      // Generic booking slot conflict is not automatically reconciled -> requires quarantine
      expect(handleConflictResponse(itemBooking, new Error("Slot taken"))).toBe(false);
    });
  });

  describe("2. Dead Letter Queue & Quarantine Execution", () => {
    it("10. quarantines HTTP 400 validation error promptly into DLQ without endless retry", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const item = await offlineQueue.enqueue({
        type: "customer",
        label: "Invalid Customer",
        url: "/api/customers",
        method: "POST",
        headers: { Authorization: "Bearer secret-token", "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "123" }), // invalid phone
      });

      await offlineQueue.processQueue();

      const quarantined = await offlineQueue.getQuarantinedItems();
      expect(quarantined.length).toBe(1);
      expect(quarantined[0].id).toBe(item.id);
      expect(quarantined[0].status).toBe("quarantined");
      expect(quarantined[0].dlq).toBeDefined();
      expect(quarantined[0].dlq?.classification).toBe("permanent_validation");
      expect(quarantined[0].dlq?.httpStatus).toBe(400);

      // Sensitive authorization token is redacted from DLQ record
      expect(quarantined[0].headers["Authorization"]).toBeUndefined();

      // Item is removed from pending queue
      const pending = await offlineQueue.getPendingItems();
      expect(pending.length).toBe(0);
    });

    it("11. bounds retries for retryable network errors to MAX_RETRY_ATTEMPTS before quarantine", async () => {
      // Simulate persistent 503 Service Unavailable
      mockFetchWithRetry.mockResolvedValue({
        ok: false,
        status: 503,
      });

      await offlineQueue.enqueue({
        type: "staff_visit",
        label: "Visit completion",
        url: "/api/daily-cleaning/visits/1",
        method: "POST",
        headers: {},
        body: JSON.stringify({ status: "completed" }),
      });

      // Attempt 1: retryable failure, stays pending
      await offlineQueue.processQueue();
      let pending = await offlineQueue.getPendingItems();
      expect(pending.length).toBe(1);
      expect(pending[0].retries).toBe(1);
      expect(pending[0].status).toBe("pending");

      // Attempt 2: retryable failure, stays pending
      await offlineQueue.processQueue();
      pending = await offlineQueue.getPendingItems();
      expect(pending.length).toBe(1);
      expect(pending[0].retries).toBe(2);

      // Attempt 3: exceeds MAX_RETRY_ATTEMPTS (3) -> quarantined into DLQ
      await offlineQueue.processQueue();
      pending = await offlineQueue.getPendingItems();
      expect(pending.length).toBe(0);

      const quarantined = await offlineQueue.getQuarantinedItems();
      expect(quarantined.length).toBe(1);
      expect(quarantined[0].status).toBe("quarantined");
      expect(quarantined[0].dlq?.classification).toBe("exhausted_retries");
      expect(quarantined[0].dlq?.attempts).toBe(MAX_RETRY_ATTEMPTS);
    });

    it("12. quarantines HTTP 403 Forbidden with safe feedback", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await offlineQueue.enqueue({
        type: "expense",
        label: "Branch Expense",
        url: "/api/expenses",
        method: "POST",
        headers: {},
        body: JSON.stringify({ amount: 500 }),
      });

      await offlineQueue.processQueue();

      const quarantined = await offlineQueue.getQuarantinedItems();
      expect(quarantined.length).toBe(1);
      expect(quarantined[0].dlq?.classification).toBe("permanent_forbidden");
      expect(quarantined[0].dlq?.safeErrorMessage).toContain("Unauthorized");
    });

    it("13. pauses queue on HTTP 401 without infinite loops or dropping items", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await offlineQueue.enqueue({
        type: "staff_job",
        label: "Job Action",
        url: "/api/bookings/1/transition",
        method: "POST",
        headers: {},
        body: JSON.stringify({ action: "start" }),
      });

      await offlineQueue.processQueue();

      expect(offlineQueue.isAuthPaused()).toBe(true);

      // Item remains pending with lastError set, not discarded or burned
      const pending = await offlineQueue.getPendingItems();
      expect(pending.length).toBe(1);
      expect(pending[0].retries).toBe(0); // Not burned as a standard retry
      expect(pending[0].lastError).toContain("Session expired");

      // Further sync attempts are suspended while authPaused
      mockFetchWithRetry.mockClear();
      await offlineQueue.processQueue();
      expect(mockFetchWithRetry).not.toHaveBeenCalled();

      // When auth recovery occurs, resumeAuthQueue resumes processing
      mockFetchWithRetry.mockResolvedValueOnce({ ok: true, status: 200 });
      await offlineQueue.resumeAuthQueue();
      expect(offlineQueue.isAuthPaused()).toBe(false);
      expect(mockFetchWithRetry).toHaveBeenCalled();
    });

    it("14. automatically reconciles 409 Conflict when item was already completed on server", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      await offlineQueue.enqueue({
        type: "staff_attendance",
        label: "Attendance Punch",
        url: "/api/staff/10/attendance",
        method: "POST",
        headers: {},
        body: JSON.stringify({ date: "2026-11-26", status: "present" }),
      });

      await offlineQueue.processQueue();

      // Attendance was reconciled and removed from both pending and DLQ
      const pending = await offlineQueue.getPendingItems();
      const quarantined = await offlineQueue.getQuarantinedItems();
      expect(pending.length).toBe(0);
      expect(quarantined.length).toBe(0);
    });

    it("15. ensures a quarantined item does NOT block unrelated valid pending items", async () => {
      // Item 1 fails with permanent 422
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 422,
      });
      // Item 2 succeeds with 200
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const badItem = await offlineQueue.enqueue({
        type: "customer",
        label: "Bad Customer",
        url: "/api/customers",
        method: "POST",
        headers: {},
        body: JSON.stringify({ invalid: true }),
      });

      const goodItem = await offlineQueue.enqueue({
        type: "note",
        label: "Good Note",
        url: "/api/notes",
        method: "POST",
        headers: {},
        body: JSON.stringify({ text: "Hello" }),
      });

      await offlineQueue.processQueue();

      // Item 1 is quarantined
      const quarantined = await offlineQueue.getQuarantinedItems();
      expect(quarantined.length).toBe(1);
      expect(quarantined[0].id).toBe(badItem.id);

      // Item 2 synced successfully and cleared
      const pending = await offlineQueue.getPendingItems();
      expect(pending.length).toBe(0);
    });
  });

  describe("3. Persistence & Manual Recovery Workflow", () => {
    it("16. persists DLQ records across app restart/reload", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const item = await offlineQueue.enqueue({
        type: "customer",
        label: "Test Customer",
        url: "/api/customers",
        method: "POST",
        headers: {},
        body: JSON.stringify({ phone: "999" }),
      });

      await offlineQueue.processQueue();

      // Inspect localStorage raw data directly to verify persistence
      const raw = localStorage.getItem("cwp_offline_queue_fallback");
      expect(raw).toBeDefined();
      const parsed: QueueItem[] = JSON.parse(raw!);
      const storedItem = parsed.find((x) => x.id === item.id);
      expect(storedItem?.status).toBe("quarantined");
      expect(storedItem?.dlq?.classification).toBe("permanent_validation");
      expect(storedItem?.dlq?.safeErrorMessage).toContain("400");
    });

    it("17. restores quarantined item correctly to active queue upon manual retry", async () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const item = await offlineQueue.enqueue({
        type: "customer",
        label: "Customer with fixable error",
        url: "/api/customers",
        method: "POST",
        headers: {},
        body: JSON.stringify({ name: "Ramesh" }),
      });

      await offlineQueue.processQueue();
      expect(await offlineQueue.getQuarantinedCount()).toBe(1);

      // Manual retry: mock next sync to succeed
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const recovered = await offlineQueue.retryQuarantinedItem(item.id);
      expect(recovered).toBe(true);

      // Successfully synced after recovery
      expect(await offlineQueue.getPendingCount()).toBe(0);
      expect(await offlineQueue.getQuarantinedCount()).toBe(0);
    });

    it("18. safely handles and quarantines corrupted items without crashing the sync loop", async () => {
      // Inject corrupted item directly into storage
      const corruptedItem = {
        id: "corrupted-1",
        label: "Broken item",
        // missing url, method, type
      };
      localStorage.setItem("cwp_offline_queue_fallback", JSON.stringify([corruptedItem]));

      // Valid item in queue
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      await offlineQueue.enqueue({
        type: "note",
        label: "Valid Note",
        url: "/api/notes",
        method: "POST",
        headers: {},
        body: JSON.stringify({ text: "Valid" }),
      });

      await offlineQueue.processQueue();

      // Corrupted item quarantined safely
      const quarantined = await offlineQueue.getQuarantinedItems();
      const corrupted = quarantined.find((x) => x.id === "corrupted-1");
      expect(corrupted).toBeDefined();
      expect(corrupted?.dlq?.classification).toBe("corrupted");

      // Valid note succeeded
      expect(await offlineQueue.getPendingCount()).toBe(0);
    });
  });
});
