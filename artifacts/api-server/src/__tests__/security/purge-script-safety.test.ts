import { describe, it, expect, beforeAll } from "vitest";
import path from "path";

describe("HOTFIX A.1 & OBSERV-01: Production Database Reset Safety Validation", () => {
  let validatePurgeConfiguration: any;

  beforeAll(async () => {
    const scriptPath = path.resolve(__dirname, "../../../../../scripts/src/reset-production-db.ts");
    const mod = await import(scriptPath);
    validatePurgeConfiguration = mod.validatePurgeConfiguration;
  });

  // 1. Missing Target URL
  it("fails closed when TARGET_DATABASE_URL is missing or empty", () => {
    const res1 = validatePurgeConfiguration(undefined);
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain("TARGET_DATABASE_URL environment variable or target argument is required");

    const res2 = validatePurgeConfiguration("");
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain("No fallback is permitted");
  });

  // 2. Missing Confirmation
  it("fails closed when ALLOW_DATABASE_PURGE confirmation is missing or invalid", () => {
    const res1 = validatePurgeConfiguration("postgresql://postgres:postgres@localhost:5432/cwp_local", {
      ALLOW_DATABASE_PURGE: undefined,
    });
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain("ALLOW_DATABASE_PURGE=I_CONFIRM_DESTRUCTIVE_PURGE");

    const res2 = validatePurgeConfiguration("postgresql://postgres:postgres@localhost:5432/cwp_local", {
      ALLOW_DATABASE_PURGE: "true",
    });
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain("ALLOW_DATABASE_PURGE=I_CONFIRM_DESTRUCTIVE_PURGE");
  });

  // 3. Production Environment Lockout
  it("fails closed when NODE_ENV is production, even with confirmation flag", () => {
    const res = validatePurgeConfiguration("postgresql://postgres:postgres@localhost:5432/cwp_local", {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "production",
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("cannot be executed against PRODUCTION environments or targets");
  });

  // 4. Recognized Local Development Targets
  it("allows recognized local development targets (localhost, 127.0.0.1)", () => {
    const resLocalhost = validatePurgeConfiguration("postgresql://postgres:postgres@localhost:5432/cwp_local", {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
    });
    expect(resLocalhost.valid).toBe(true);
    expect(resLocalhost.targetDisplay).toContain("Host: localhost:5432");

    const res127 = validatePurgeConfiguration("postgresql://postgres:postgres@127.0.0.1:5432/cwp_local", {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
    });
    expect(res127.valid).toBe(true);
    expect(res127.targetDisplay).toContain("Host: 127.0.0.1:5432");
  });

  // 5. Unknown Hostname Default-Deny
  it("default-denies unknown database hostnames", () => {
    const res = validatePurgeConfiguration("postgresql://user:pass@custom-db.internal:5432/cwp_db", {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Target host 'custom-db.internal' is a non-local/remote database");
    expect(res.error).toContain("Remote database purge is disabled by default");
  });

  // 6. Supabase Host Default-Deny
  it("default-denies Supabase database targets", () => {
    const res = validatePurgeConfiguration("postgresql://postgres:secret@db.projectref.supabase.co:5432/postgres", {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Target host 'db.projectref.supabase.co' is a non-local/remote database");
    expect(res.error).toContain("Remote database purge is disabled by default");
  });

  // 7. Raw IP Default-Deny
  it("default-denies raw IP database targets (both private and public IPs)", () => {
    const resPrivateIp = validatePurgeConfiguration("postgresql://postgres:secret@192.168.1.50:5432/cwp_db", {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
    });
    expect(resPrivateIp.valid).toBe(false);
    expect(resPrivateIp.error).toContain("Target host '192.168.1.50' is a non-local/remote database");

    const resPublicIp = validatePurgeConfiguration("postgresql://postgres:secret@54.210.1.2:5432/cwp_db", {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
    });
    expect(resPublicIp.valid).toBe(false);
    expect(resPublicIp.error).toContain("Target host '54.210.1.2' is a non-local/remote database");
  });

  // 8. Production Database Targets Permanently Blocked
  it("permanently blocks known production database targets even with remote override flags", () => {
    const res = validatePurgeConfiguration(
      "postgresql://user:pass@ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      {
        ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
        NODE_ENV: "development",
        ALLOW_UNSAFE_REMOTE_PURGE: "CONFIRM_REMOTE_PURGE",
        ALLOWED_REMOTE_PURGE_HOST: "ep-flat-meadow-aozck6dv-pooler.c-2.ap-southeast-1.aws.neon.tech",
      },
    );
    expect(res.valid).toBe(false);
    expect(res.error).toContain("cannot be executed against PRODUCTION environments or targets");
  });

  // 9. Explicitly Allowed Remote Target Requires Both Tokens
  it("allows non-production remote target ONLY when both override and matching host are provided", () => {
    const target = "postgresql://user:pass@ep-staging-cluster-123.neon.tech:5432/staging_db";

    // Missing host allowlist
    const resMissingHost = validatePurgeConfiguration(target, {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
      ALLOW_UNSAFE_REMOTE_PURGE: "CONFIRM_REMOTE_PURGE",
    });
    expect(resMissingHost.valid).toBe(false);
    expect(resMissingHost.error).toContain("not explicitly allowlisted in ALLOWED_REMOTE_PURGE_HOST");

    // Mismatched host allowlist
    const resMismatchedHost = validatePurgeConfiguration(target, {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
      ALLOW_UNSAFE_REMOTE_PURGE: "CONFIRM_REMOTE_PURGE",
      ALLOWED_REMOTE_PURGE_HOST: "other-cluster.neon.tech",
    });
    expect(resMismatchedHost.valid).toBe(false);
    expect(resMismatchedHost.error).toContain("not explicitly allowlisted in ALLOWED_REMOTE_PURGE_HOST");

    // Matching host allowlist
    const resAllowed = validatePurgeConfiguration(target, {
      ALLOW_DATABASE_PURGE: "I_CONFIRM_DESTRUCTIVE_PURGE",
      NODE_ENV: "development",
      ALLOW_UNSAFE_REMOTE_PURGE: "CONFIRM_REMOTE_PURGE",
      ALLOWED_REMOTE_PURGE_HOST: "ep-staging-cluster-123.neon.tech",
    });
    expect(resAllowed.valid).toBe(true);
    expect(resAllowed.targetDisplay).toContain("Host: ep-staging-cluster-123.neon.tech:5432");
    expect(resAllowed.targetDisplay).not.toContain("user");
    expect(resAllowed.targetDisplay).not.toContain("pass");
  });
});
