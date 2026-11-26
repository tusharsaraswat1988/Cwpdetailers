/**
 * ARCH-P1-04: Fast2SMS Runtime Isolation & Elimination of Global process.env Mutation
 * 
 * Verifies that:
 * 1. Fast2SMS and MSG91 adapters receive credentials explicitly.
 * 2. No `process.env` mutation occurs during adapter construction or send operations.
 * 3. Separate adapter instances remain completely isolated.
 * 4. Concurrent SMS operations cannot cross-contaminate credentials or template IDs.
 * 5. Missing or invalid credentials fail safely.
 * 6. DB config resolution does not mutate process.env.
 * 7. Provider selection and fallback remain intact.
 * 8. Credentials never leak into error messages.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock DB before importing fastSmsService or providerRegistry
const mockDbRows: any[] = [];
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(mockDbRows),
        }),
      }),
    }),
  },
  commProvidersTable: {
    channel: "channel",
    providerType: "providerType",
    isActive: "isActive",
    isPrimary: "isPrimary",
    priority: "priority",
    companyId: "companyId",
  },
}));

import { Fast2SmsAdapter, Msg91Adapter, createDefaultSmsAdapter } from "../../lib/notifications/channels/sms";
import { sendSms, resolveFastSmsConfig } from "../../lib/communications/fastSmsService";
import { getProviderForChannel } from "../../lib/communications/providerRegistry";

describe("ARCH-P1-04: Fast2SMS Explicit Configuration & Runtime Isolation", () => {
  const originalEnv = { ...process.env };
  const mockFetchCalls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];

  beforeEach(() => {
    mockFetchCalls.length = 0;
    mockDbRows.length = 0;
    // Clear SMS env vars for clean test baseline
    delete process.env.FAST2SMS_API_KEY;
    delete process.env.FAST2SMS_SENDER_ID;
    delete process.env.FAST2SMS_TEMPLATE_ID;
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_SENDER_ID;

    // Mock global.fetch
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      mockFetchCalls.push({ url, headers, body });

      if (url.includes("fast2sms.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ return: true, request_id: "req_mock_123", message: ["SMS sent successfully"] }),
        };
      }
      if (url.includes("msg91.com")) {
        return {
          ok: true,
          status: 200,
          text: async () => "msg91_req_789",
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("1. Explicit Configuration & Zero process.env Mutation", () => {
    it("1. Fast2SmsAdapter receives explicit credentials and does NOT mutate process.env", async () => {
      const initialKey = process.env.FAST2SMS_API_KEY;
      const initialSender = process.env.FAST2SMS_SENDER_ID;
      const initialTmpl = process.env.FAST2SMS_TEMPLATE_ID;

      const adapter = new Fast2SmsAdapter({
        apiKey: "fast_explicit_key_001",
        senderId: "CWPEXP",
        templateId: "TMPL_001",
      });

      expect(adapter.isConfigured()).toBe(true);

      const result = await adapter.sendSms("9876543210", "Hello from CWP");
      expect(result.success).toBe(true);
      expect(result.externalId).toBe("req_mock_123");

      // Verify fetch payload
      expect(mockFetchCalls.length).toBe(1);
      expect(mockFetchCalls[0].headers["authorization"]).toBe("fast_explicit_key_001");
      expect(mockFetchCalls[0].body.sender_id).toBe("CWPEXP");
      expect(mockFetchCalls[0].body.template_id).toBe("TMPL_001");
      expect(mockFetchCalls[0].body.route).toBe("dlt");

      // Verify process.env was NEVER touched
      expect(process.env.FAST2SMS_API_KEY).toBe(initialKey);
      expect(process.env.FAST2SMS_SENDER_ID).toBe(initialSender);
      expect(process.env.FAST2SMS_TEMPLATE_ID).toBe(initialTmpl);
    });

    it("2. Msg91Adapter receives explicit credentials and does NOT mutate process.env", async () => {
      const initialAuth = process.env.MSG91_AUTH_KEY;
      const initialSender = process.env.MSG91_SENDER_ID;

      const adapter = new Msg91Adapter({
        authKey: "msg91_explicit_auth_999",
        senderId: "CWPM91",
      });

      expect(adapter.isConfigured()).toBe(true);

      const result = await adapter.sendSms("9876543210", "OTP message");
      expect(result.success).toBe(true);
      expect(result.externalId).toBe("msg91_req_789");

      expect(mockFetchCalls.length).toBe(1);
      expect(mockFetchCalls[0].url).toContain("authkey=msg91_explicit_auth_999");
      expect(mockFetchCalls[0].url).toContain("sender=CWPM91");

      // Verify process.env was NEVER touched
      expect(process.env.MSG91_AUTH_KEY).toBe(initialAuth);
      expect(process.env.MSG91_SENDER_ID).toBe(initialSender);
    });

    it("3. sendSms per-call options override base template and sender without env pollution", async () => {
      const adapter = new Fast2SmsAdapter({
        apiKey: "base_api_key",
        senderId: "BASESND",
        templateId: "BASETMPL",
      });

      await adapter.sendSms("9876543210", "Special alert", {
        senderId: "OVERRIDE_SND",
        dltTemplateId: "OVERRIDE_TMPL",
      });

      expect(mockFetchCalls[0].headers["authorization"]).toBe("base_api_key");
      expect(mockFetchCalls[0].body.sender_id).toBe("OVERRIDE_SND");
      expect(mockFetchCalls[0].body.template_id).toBe("OVERRIDE_TMPL");

      expect(process.env.FAST2SMS_SENDER_ID).toBeUndefined();
      expect(process.env.FAST2SMS_TEMPLATE_ID).toBeUndefined();
    });
  });

  describe("2. Multi-Tenant Instance Isolation & Concurrency Safety", () => {
    it("4. Two adapter instances configured with different company credentials remain isolated", async () => {
      const companyA = new Fast2SmsAdapter({
        apiKey: "key_company_noida",
        senderId: "NOIDA1",
        templateId: "TMPL_NOIDA",
      });

      const companyB = new Fast2SmsAdapter({
        apiKey: "key_company_varanasi",
        senderId: "VARAN1",
        templateId: "TMPL_VARANASI",
      });

      await companyA.sendSms("9876543210", "Noida notification");
      await companyB.sendSms("9876543211", "Varanasi notification");

      expect(mockFetchCalls.length).toBe(2);

      // Company A call
      expect(mockFetchCalls[0].headers["authorization"]).toBe("key_company_noida");
      expect(mockFetchCalls[0].body.sender_id).toBe("NOIDA1");
      expect(mockFetchCalls[0].body.template_id).toBe("TMPL_NOIDA");

      // Company B call
      expect(mockFetchCalls[1].headers["authorization"]).toBe("key_company_varanasi");
      expect(mockFetchCalls[1].body.sender_id).toBe("VARAN1");
      expect(mockFetchCalls[1].body.template_id).toBe("TMPL_VARANASI");
    });

    it("5. Concurrent send operations with distinct credentials cannot cross-contaminate", async () => {
      const tenantConfigs = [
        { key: "key_tenant_1", sender: "SND1", tmpl: "T1", phone: "9000000001" },
        { key: "key_tenant_2", sender: "SND2", tmpl: "T2", phone: "9000000002" },
        { key: "key_tenant_3", sender: "SND3", tmpl: "T3", phone: "9000000003" },
        { key: "key_tenant_4", sender: "SND4", tmpl: "T4", phone: "9000000004" },
        { key: "key_tenant_5", sender: "SND5", tmpl: "T5", phone: "9000000005" },
      ];

      // Execute all 5 concurrently
      await Promise.all(
        tenantConfigs.map((tc) => {
          const adapter = new Fast2SmsAdapter({
            apiKey: tc.key,
            senderId: tc.sender,
            templateId: tc.tmpl,
          });
          return adapter.sendSms(tc.phone, `Message to ${tc.phone}`);
        })
      );

      expect(mockFetchCalls.length).toBe(5);

      // For every outgoing request, ensure authorization and sender_id exactly match the target phone
      for (const call of mockFetchCalls) {
        const matchingConfig = tenantConfigs.find((c) => c.phone === call.body.numbers);
        expect(matchingConfig).toBeDefined();
        expect(call.headers["authorization"]).toBe(matchingConfig!.key);
        expect(call.body.sender_id).toBe(matchingConfig!.sender);
        expect(call.body.template_id).toBe(matchingConfig!.tmpl);
      }

      // Assert global process.env was never modified by any concurrent thread
      expect(process.env.FAST2SMS_API_KEY).toBeUndefined();
      expect(process.env.FAST2SMS_SENDER_ID).toBeUndefined();
      expect(process.env.FAST2SMS_TEMPLATE_ID).toBeUndefined();
    });
  });

  describe("3. Missing Credentials & Fail-Closed Behavior", () => {
    it("6. Missing credentials fail safely without throwing unhandled exceptions", async () => {
      const unconfiguredAdapter = new Fast2SmsAdapter();
      expect(unconfiguredAdapter.isConfigured()).toBe(false);

      const result = await unconfiguredAdapter.sendSms("9876543210", "Test");
      expect(result.success).toBe(false);
      expect(result.error).toContain("FAST2SMS_API_KEY not configured");

      // No network request made
      expect(mockFetchCalls.length).toBe(0);
    });

    it("7. Fallback to process.env works safely if explicit config is not passed", async () => {
      process.env.FAST2SMS_API_KEY = "env_fallback_key_456";
      process.env.FAST2SMS_SENDER_ID = "ENVSND";

      const adapter = new Fast2SmsAdapter();
      expect(adapter.isConfigured()).toBe(true);

      const result = await adapter.sendSms("9876543210", "Env message");
      expect(result.success).toBe(true);
      expect(mockFetchCalls[0].headers["authorization"]).toBe("env_fallback_key_456");
      expect(mockFetchCalls[0].body.sender_id).toBe("ENVSND");
    });

    it("8. Explicit config takes precedence over process.env", async () => {
      process.env.FAST2SMS_API_KEY = "stale_env_key";
      process.env.FAST2SMS_SENDER_ID = "STALESND";

      const adapter = new Fast2SmsAdapter({
        apiKey: "override_instance_key",
        senderId: "NEWSND",
      });

      await adapter.sendSms("9876543210", "Explicit precedence test");
      expect(mockFetchCalls[0].headers["authorization"]).toBe("override_instance_key");
      expect(mockFetchCalls[0].body.sender_id).toBe("NEWSND");
    });
  });

  describe("4. Database Provider Integration & fastSmsService.ts", () => {
    it("9. resolveFastSmsConfig returns explicit config without mutating process.env", async () => {
      mockDbRows.push({
        id: 1,
        channel: "sms",
        providerType: "fast2sms",
        isActive: true,
        isPrimary: true,
        priority: 10,
        companyId: null,
        config: {
          apiKey: "db_retrieved_key_777",
          senderId: "DBSNDR",
          templateId: "DBTMPL",
        },
      });

      const config = await resolveFastSmsConfig();
      expect(config.apiKey).toBe("db_retrieved_key_777");
      expect(config.senderId).toBe("DBSNDR");
      expect(config.templateId).toBe("DBTMPL");

      // Verify zero process.env pollution
      expect(process.env.FAST2SMS_API_KEY).toBeUndefined();
      expect(process.env.FAST2SMS_SENDER_ID).toBeUndefined();
      expect(process.env.FAST2SMS_TEMPLATE_ID).toBeUndefined();
    });

    it("10. sendSms routes through Fast2SmsAdapter with explicit DB config without mutating process.env", async () => {
      mockDbRows.push({
        id: 1,
        channel: "sms",
        providerType: "fast2sms",
        isActive: true,
        isPrimary: true,
        priority: 10,
        companyId: 5,
        config: {
          apiKey: "company5_key_888",
          senderId: "CO5SND",
          templateId: "CO5TMPL",
        },
      });

      const res = await sendSms({
        phone: "9876543210",
        message: "Booking confirmed",
        companyId: 5,
        dltTemplateId: "CUSTOM_DLT_ID",
      });

      expect(res.success).toBe(true);
      expect(mockFetchCalls.length).toBe(1);
      expect(mockFetchCalls[0].headers["authorization"]).toBe("company5_key_888");
      expect(mockFetchCalls[0].body.sender_id).toBe("CO5SND");
      expect(mockFetchCalls[0].body.template_id).toBe("CUSTOM_DLT_ID");

      // Confirm process.env remained untouched throughout the entire DB -> service -> adapter flow
      expect(process.env.FAST2SMS_API_KEY).toBeUndefined();
      expect(process.env.FAST2SMS_SENDER_ID).toBeUndefined();
      expect(process.env.FAST2SMS_TEMPLATE_ID).toBeUndefined();
    });

    it("11. Never leaks API key into error responses", async () => {
      vi.stubGlobal("fetch", async () => {
        return {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: async () => ({ return: false, message: "Invalid credentials" }),
        };
      });

      const adapter = new Fast2SmsAdapter({
        apiKey: "SUPER_SECRET_KEY_12345",
      });

      const result = await adapter.sendSms("9876543210", "Test");
      expect(result.success).toBe(false);
      expect(result.error).not.toContain("SUPER_SECRET_KEY_12345");
      expect(result.error).toBe("Invalid credentials");
    });
  });
});
