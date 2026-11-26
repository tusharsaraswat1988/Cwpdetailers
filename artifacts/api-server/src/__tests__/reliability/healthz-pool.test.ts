import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";

// State for mock pool
let shouldFailPing = false;
let shouldTimeoutPing = false;

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();

  const fakePool = {
    query: vi.fn(async (queryText: string) => {
      if (shouldTimeoutPing) {
        // Hang longer than timeoutMs
        await new Promise((r) => setTimeout(r, 500));
      }
      if (shouldFailPing) {
        throw new Error("Connection terminated unexpectedly");
      }
      return { rows: [{ "?column?": 1 }] };
    }),
    totalCount: 30,
    idleCount: 28,
    waitingCount: 0,
  };

  return {
    ...actual,
    pool: fakePool,
  };
});

import healthRouter from "../../routes/health";

describe("ARCH-P0-02: Database Connection Pool Sizing & Healthz Probes", () => {
  let app: express.Express;
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl: string;

  beforeEach(() => {
    shouldFailPing = false;
    shouldTimeoutPing = false;
  });

  beforeAll(async () => {
    app = express();
    app.use("/api", healthRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("1. Returns HTTP 200 OK with status 'ok' and database 'connected' when pool ping succeeds", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(body.timestamp).toBeDefined();
  });

  it("2. Returns HTTP 503 Service Unavailable when database pool query fails", async () => {
    shouldFailPing = true;

    const res = await fetch(`${baseUrl}/healthz`);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("disconnected");
    expect(body.error).toContain("Connection terminated unexpectedly");
  });

  it("3. Returns HTTP 503 Service Unavailable when connection pool is starved and query times out", async () => {
    shouldTimeoutPing = true;

    // Use a small timeoutMs to keep test fast
    const res = await fetch(`${baseUrl}/healthz?timeoutMs=50`);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("disconnected");
    expect(body.error).toContain("Database ping timed out");
  });

  it("4. Supports shallow liveness probe bypass via ?shallow=true without querying database", async () => {
    shouldFailPing = true; // Database is down

    const res = await fetch(`${baseUrl}/healthz?shallow=true`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.database).toBeUndefined();
  });
});
