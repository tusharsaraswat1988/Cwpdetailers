import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { Server } from "http";
import app from "../../app";
import { resolveStoredMediaUrl } from "../../lib/cloudinaryStorage";
import { cookieOptions } from "../../lib/sessionCookie";

describe("SEC-025: SSL/HTTPS Hardening, Reverse Proxy Trust & HSTS Suite", () => {
  let server: Server;
  let baseUrl: string;
  const originalEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("1. Reverse proxy trust is enabled in Express app", () => {
    expect(app.get("trust proxy")).toBeTruthy();
  });

  it("2. X-Powered-By header is disabled to prevent stack fingerprinting", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`, {
      headers: {
        "X-Forwarded-Host": "cwpdetailers.in",
        "X-Forwarded-Proto": "https",
      },
    });
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("3. HTTP requests permanently redirect (301) to HTTPS in production", async () => {
    const res = await fetch(`${baseUrl}/customer/plans`, {
      method: "GET",
      headers: {
        "X-Forwarded-Host": "cwpdetailers.in",
        "X-Forwarded-Proto": "http",
      },
      redirect: "manual",
    });

    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://cwpdetailers.in/customer/plans");
  });

  it("4. Canonical domain normalizer 301-redirects www.cwpdetailers.in to cwpdetailers.in", async () => {
    const res = await fetch(`${baseUrl}/customer/plans`, {
      method: "GET",
      headers: {
        "X-Forwarded-Host": "www.cwpdetailers.in",
        "X-Forwarded-Proto": "https",
      },
      redirect: "manual",
    });

    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://cwpdetailers.in/customer/plans");
  });

  it("5. Strict-Transport-Security (HSTS) header is enforced in production", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`, {
      headers: {
        "X-Forwarded-Host": "cwpdetailers.in",
        "X-Forwarded-Proto": "https",
      },
    });

    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
  });

  it("6. Content-Security-Policy includes upgrade-insecure-requests and trusted frame sources", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`, {
      headers: {
        "X-Forwarded-Host": "cwpdetailers.in",
        "X-Forwarded-Proto": "https",
      },
    });

    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("frame-src 'self' https:");
  });

  it("7. Standard defense-in-depth headers are sent (nosniff, referrer-policy, frame-options)", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`, {
      headers: {
        "X-Forwarded-Host": "cwpdetailers.in",
        "X-Forwarded-Proto": "https",
      },
    });

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("8. Localhost HTTP requests bypass HTTPS redirect for local development", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`, {
      headers: {
        "X-Forwarded-Host": "localhost:8080",
        "X-Forwarded-Proto": "http",
      },
      redirect: "manual",
    });

    // Localhost must not be redirected to 301
    expect(res.status).not.toBe(301);
    expect(res.status).toBe(200);
  });

  it("9. resolveStoredMediaUrl upgrades http to https for remote CDN assets", () => {
    const insecure = "http://res.cloudinary.com/dhfphz6nv/image/upload/v1234/test.png";
    const secure = resolveStoredMediaUrl(insecure);
    expect(secure).toBe("https://res.cloudinary.com/dhfphz6nv/image/upload/v1234/test.png");

    // Localhost media preserved
    const local = "http://localhost:8080/uploads/test.png";
    expect(resolveStoredMediaUrl(local)).toBe(local);

    // Existing HTTPS preserved
    const existingHttps = "https://res.cloudinary.com/demo/image.png";
    expect(resolveStoredMediaUrl(existingHttps)).toBe(existingHttps);
  });

  it("10. cookieOptions enforces Secure flag in production", () => {
    expect(cookieOptions.secure).toBe(true);
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe("lax");
  });
});
