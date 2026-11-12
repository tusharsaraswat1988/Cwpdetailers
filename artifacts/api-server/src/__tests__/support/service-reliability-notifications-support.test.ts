import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTicketNumber,
  createSupportTicket,
  getSupportTicketDetail,
  addTicketMessage,
  resolveSupportTicket,
} from "../../lib/support/supportTicketService";
import {
  dispatchNotification,
  notifySubscriptionActivated,
} from "../../lib/notifications/dispatcher";
import { societyValidator } from "../../lib/coverage/validators/SocietyValidator";

// In-memory test state
const state = {
  notifications: [] as any[],
  complaints: [] as any[],
  messages: [] as any[],
  subscriptions: [] as any[],
  exceptions: [] as any[],
  societies: [] as any[],
  customers: [] as any[],
  staff: [] as any[],
  auditLogs: [] as any[],
};

function extractParamValues(expr: any): any[] {
  const vals: any[] = [];
  if (expr == null) return vals;
  if (typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") {
    vals.push(expr);
    return vals;
  }
  if (Array.isArray(expr)) {
    for (const item of expr) vals.push(...extractParamValues(item));
    return vals;
  }
  if (expr.constructor && expr.constructor.name === "Param") {
    vals.push(expr.value);
    return vals;
  }
  if (expr.value !== undefined && typeof expr.value !== "object") {
    vals.push(expr.value);
    return vals;
  }
  if (expr.queryChunks && Array.isArray(expr.queryChunks)) {
    for (const chunk of expr.queryChunks) {
      if (chunk == null) continue;
      if (chunk.constructor && chunk.constructor.name === "StringChunk") continue;
      vals.push(...extractParamValues(chunk));
    }
  }
  return vals;
}

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => {
        return {
          from: vi.fn((table: any) => {
            let lastCondition: any = null;

            const builder: any = {
              innerJoin: vi.fn(() => builder),
              leftJoin: vi.fn(() => builder),
              where: vi.fn((condition: any) => {
                lastCondition = condition;
                return builder;
              }),
              orderBy: vi.fn(() => builder),
              groupBy: vi.fn(() => builder),
              limit: vi.fn((lim: number) => {
                if (table === actual.residentialSocietiesTable) {
                  const params = extractParamValues(lastCondition);
                  if (params.includes(2)) {
                    return Promise.resolve(state.societies.filter((s) => s.id === 2));
                  }
                  if (params.includes(1)) {
                    return Promise.resolve(state.societies.filter((s) => s.id === 1));
                  }
                  return Promise.resolve(state.societies.slice(0, lim));
                }
                if (table === actual.complaintsTable) {
                  return Promise.resolve(state.complaints.slice(0, lim));
                }
                if (table === actual.customersTable) {
                  return Promise.resolve(state.customers.slice(0, lim));
                }
                if (table === actual.dcmsSubscriptionsTable) {
                  return Promise.resolve(state.subscriptions.slice(0, lim));
                }
                if (table === actual.dcmsOperationalExceptionsTable) {
                  return Promise.resolve(state.exceptions.slice(0, lim));
                }
                if (table === actual.supportTicketMessagesTable) {
                  const params = extractParamValues(lastCondition);
                  let msgs = [...state.messages];
                  if (params.includes(false)) {
                    msgs = msgs.filter((m) => m.isInternal === false);
                  }
                  return Promise.resolve(msgs.slice(0, lim));
                }
                if (table === actual.notificationsTable) {
                  const params = extractParamValues(lastCondition);
                  const matching = state.notifications.filter((n) =>
                    params.some((p) => p === n.dedupeKey)
                  );
                  return Promise.resolve(matching.slice(0, lim));
                }
                return Promise.resolve([]);
              }),
              then: (resolve: (val: any) => void) => {
                if (table === actual.supportTicketMessagesTable) {
                  const params = extractParamValues(lastCondition);
                  let msgs = [...state.messages];
                  if (params.includes(false)) {
                    msgs = msgs.filter((m) => m.isInternal === false);
                  }
                  resolve(msgs);
                  return;
                }
                if (table === actual.notificationsTable) {
                  resolve(state.notifications);
                  return;
                }
                resolve([]);
              },
            };
            return builder;
          }),
        };
      }),
      insert: vi.fn((table: any) => {
        return {
          values: vi.fn((vals: any) => {
            const arr = Array.isArray(vals) ? vals : [vals];
            const inserted = arr.map((v, i) => ({
              id: Math.floor(Math.random() * 100000) + 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...v,
            }));
            if (table === actual.notificationsTable) {
              state.notifications.push(...inserted);
            } else if (table === actual.complaintsTable) {
              state.complaints.push(...inserted);
            } else if (table === actual.supportTicketMessagesTable) {
              state.messages.push(...inserted);
            } else if (table === actual.dcmsAuditLogsTable) {
              state.auditLogs.push(...inserted);
            }
            return {
              returning: vi.fn(async () => inserted),
              then: (resolve: any) => resolve(inserted),
            };
          }),
        };
      }),
      update: vi.fn((table: any) => {
        return {
          set: vi.fn((patch: any) => {
            return {
              where: vi.fn(() => {
                if (table === actual.dcmsSubscriptionsTable) {
                  state.subscriptions.forEach((s) => {
                    if (patch.remainingCleanings) s.remainingCleanings += 1;
                    const { remainingCleanings, ...rest } = patch;
                    Object.assign(s, rest);
                  });
                }
                if (table === actual.dcmsOperationalExceptionsTable) {
                  state.exceptions.forEach((e) => Object.assign(e, patch));
                }
                if (table === actual.complaintsTable) {
                  state.complaints.forEach((c) => Object.assign(c, patch));
                }
                return {
                  returning: vi.fn(async () => {
                    if (table === actual.complaintsTable) return state.complaints;
                    if (table === actual.dcmsSubscriptionsTable) return state.subscriptions;
                    return [];
                  }),
                  then: (resolve: any) => {
                    if (table === actual.complaintsTable) resolve(state.complaints);
                    else if (table === actual.dcmsSubscriptionsTable) resolve(state.subscriptions);
                    else resolve([]);
                  },
                };
              }),
            };
          }),
        };
      }),
    },
  };
});

describe("PRD v2.0 Service Reliability, Notifications & Customer Support", () => {
  beforeEach(() => {
    state.notifications = [];
    state.complaints = [];
    state.messages = [];
    state.subscriptions = [
      {
        id: 10,
        customerId: 101,
        remainingCleanings: 5,
        status: "active",
      },
    ];
    state.exceptions = [
      {
        id: 55,
        societyId: 1,
        status: "open",
        resolutionNotes: null,
      },
    ];
    state.societies = [
      {
        id: 1,
        name: "Cleo County Sector 121",
        code: "CLEO-121",
        cityId: 2,
        isActive: true,
      },
      {
        id: 2,
        name: "Inactive Heights",
        code: "INACTIVE-99",
        cityId: 2,
        isActive: false,
      },
    ];
    state.customers = [
      {
        id: 101,
        name: "Rohan Verma",
        phone: "9876543210",
        cityId: 2,
        branchId: 5,
      },
    ];
    state.staff = [
      {
        id: 7,
        name: "Vikram Supervisor",
        phone: "9876500000",
      },
    ];
  });

  describe("1. Notification & Event Delivery Engine", () => {
    it("dispatches customer in-app notifications and records tenant metadata", async () => {
      const res = await dispatchNotification({
        type: "payment_success",
        title: "Payment Received",
        message: "Your payment of ₹1,499 was successful.",
        customerId: 101,
        cityId: 2,
        actionUrl: "/customer/subscriptions",
        metadata: { invoiceId: 901, amount: 1499 },
      });

      expect(res.inAppDelivered).toBe(true);
      expect(state.notifications.length).toBeGreaterThan(0);
      const notif = state.notifications[0];
      expect(notif.customerId).toBe(101);
      expect(notif.cityId).toBe(2);
      expect(notif.actionUrl).toBe("/customer/subscriptions");
      expect(notif.metadata).toEqual({ invoiceId: 901, amount: 1499 });
    });

    it("enforces event idempotency via dedupeKey", async () => {
      const dedupeKey = "order-pay-cf_ord_99887766";

      const first = await dispatchNotification({
        type: "payment_success",
        title: "Payment Received",
        message: "Payment confirmed.",
        customerId: 101,
        dedupeKey,
      });
      expect(first.inAppDelivered).toBe(true);

      const second = await dispatchNotification({
        type: "payment_success",
        title: "Payment Received",
        message: "Duplicate webhook.",
        customerId: 101,
        dedupeKey,
      });

      expect(second.success).toBe(true);
      expect(second.skipped).toBe(true);
      expect(second.reason).toBe("duplicate");
    });

    it("formats lifecycle notification helper payloads correctly", async () => {
      await notifySubscriptionActivated({
        customerId: 101,
        subscriptionId: 10,
        planName: "Daily Exterior 26-Day",
        remainingCleanings: 26,
      });

      const notif = state.notifications.find((n) => n.type === "subscription_activated");
      expect(notif).toBeDefined();
      expect(notif.title).toContain("Activated");
      expect(notif.message).toContain("ACTIVE");
    });
  });

  describe("2. Support Ticketing & Sequential Ticket Numbering", () => {
    it("generates atomic sequential ticket numbers with TKT-YYYYMM-XXXX pattern", async () => {
      const ticketNum = await generateTicketNumber();
      expect(ticketNum).toMatch(/^TKT-\d{6}-\d{4}$/);
    });

    it("creates a support ticket and records the initial message", async () => {
      const ticket = await createSupportTicket({
        caller: { isStaffOrAdmin: false, customerId: 101, name: "Rohan Verma" },
        customerId: 101,
        type: "quality",
        priority: "medium",
        title: "Streaks on front windshield",
        description: "Windshield had water marks after cleaning this morning.",
        subscriptionId: 10,
      });

      expect(ticket.ticketNumber).toMatch(/^TKT-/);
      expect(ticket.customerId).toBe(101);
      expect(ticket.title).toBe("Streaks on front windshield");
      expect(["open", "assigned"]).toContain(ticket.status);

      // Verify message recorded
      expect(state.messages.length).toBe(1);
      expect(state.messages[0].complaintId).toBe(ticket.id);
      expect(state.messages[0].senderName).toBe("Rohan Verma");
      expect(state.messages[0].isInternal).toBe(false);
    });
  });

  describe("3. Customer IDOR Protection & Shielded Internal Notes", () => {
    let testTicket: any;

    beforeEach(async () => {
      testTicket = await createSupportTicket({
        caller: { isStaffOrAdmin: false, customerId: 101, name: "Rohan Verma" },
        customerId: 101,
        type: "reclean",
        priority: "high",
        title: "Mud spots missed",
        description: "Lower door panel has dry mud spots.",
        subscriptionId: 10,
      });

      // Staff adds an internal supervisor note
      await addTicketMessage(testTicket.id, {
        senderType: "staff",
        senderId: 7,
        senderName: "Vikram Supervisor",
        message: "Spoke to cleaner Rajesh. Heavy rain caused dirt buildup. Grant makeup cleaning.",
        isInternal: true,
      });

      // Staff adds a customer-visible update
      await addTicketMessage(testTicket.id, {
        senderType: "staff",
        senderId: 7,
        senderName: "Vikram Supervisor",
        message: "We apologize for the oversight. Our team has reviewed this and will make it right.",
        isInternal: false,
      });
    });

    it("blocks unauthorized customers from viewing another customer's ticket (IDOR guard)", async () => {
      await expect(
        getSupportTicketDetail(testTicket.id, {
          isStaffOrAdmin: false,
          customerId: 999, // Different customer
        })
      ).rejects.toThrow(/Access denied/);
    });

    it("strictly strips internal notes and internal messages for customer callers", async () => {
      const customerView = await getSupportTicketDetail(testTicket.id, {
        isStaffOrAdmin: false,
        customerId: 101,
      });

      expect(customerView.messages.length).toBe(2); // Initial ticket description + 1 public reply
      const internalMsg = customerView.messages.find((m) => m.isInternal === true);
      expect(internalMsg).toBeUndefined(); // Internal note MUST NOT appear
      expect(customerView.internalNotes).toBeUndefined();
    });

    it("exposes internal messages and audit notes to staff/admin callers", async () => {
      const staffView = await getSupportTicketDetail(testTicket.id, {
        isStaffOrAdmin: true,
      });

      expect(staffView.messages.length).toBe(3); // Initial + 1 internal + 1 public
      const internalMsg = staffView.messages.find((m) => m.isInternal === true);
      expect(internalMsg).toBeDefined();
      expect(internalMsg?.message).toContain("Spoke to cleaner Rajesh");
    });

    it("prevents customer from posting messages with isInternal = true", async () => {
      const addedMsg = await addTicketMessage(testTicket.id, {
        senderType: "customer",
        senderId: 101,
        senderName: "Rohan Verma",
        message: "Customer trying to set internal flag",
        isInternal: true, // Attempt to set internal
      });

      expect(addedMsg.isInternal).toBe(false); // Security guard forces false
    });
  });

  describe("4. Operational Exception & Support Ticket Resolution with Makeup Credit", () => {
    it("resolving ticket with grant_makeup_credit atomically credits subscription and closes linked exception", async () => {
      const ticket = await createSupportTicket({
        caller: { isStaffOrAdmin: false, customerId: 101, name: "Rohan Verma" },
        customerId: 101,
        type: "missed",
        priority: "urgent",
        title: "Car was not cleaned today",
        description: "Vehicle was parked in bay B2-104 all morning.",
        subscriptionId: 10,
        operationalExceptionId: 55,
      });

      const initialRemaining = state.subscriptions[0].remainingCleanings; // 5

      const resolved = await resolveSupportTicket({
        ticketId: ticket.id,
        action: "grant_makeup_credit",
        resolution: "Granted 1 makeup cleaning credit due to gate access delay.",
        resolvedBy: 7,
        resolvedByName: "Vikram Supervisor",
        internalNotes: "Gate security log confirmed staff entry delay.",
      });

      expect(resolved.status).toBe("resolved");
      expect(state.subscriptions[0].remainingCleanings).toBe(initialRemaining + 1); // 6
      expect(state.exceptions[0].status).toBe("resolved");

      // Verify customer resolution notification dispatched
      const resolutionNotif = state.notifications.find(
        (n) => n.type === "ticket_resolved" || n.type === "exception_resolved"
      );
      expect(resolutionNotif).toBeDefined();
    });
  });

  describe("5. Residential Society Coverage Validator", () => {
    it("succeeds for active residential societies and links cityId", async () => {
      const stateInput: any = {
        request: {
          societyId: 1, // Cleo County (active, cityId: 2)
          address: "Cleo County, Sector 121, Noida",
        },
        parsedAddress: {},
        correlation: {},
        requestSource: "test",
      };

      const result = await societyValidator.validate(stateInput);
      expect(result.halt).toBe(false);
      if (!result.halt) {
        expect(result.state.request.cityId).toBe(2);
      }
    });

    it("halts with SOCIETY_NOT_SERVICEABLE and friendly message when society is inactive", async () => {
      const stateInput: any = {
        request: {
          societyId: 2, // Inactive Heights (isActive: false)
          address: "Inactive Heights, Noida",
        },
        parsedAddress: {},
        correlation: {},
        requestSource: "test",
      };

      const result = await societyValidator.validate(stateInput);
      expect(result.halt).toBe(true);
      if (result.halt) {
        expect(result.status).toBe("SOCIETY_NOT_SERVICEABLE");
        expect(result.message).toContain("We do not currently service Inactive Heights");
        expect(result.message).toContain("Join the waitlist for your society");
      }
    });

    it("halts when society city conflicts with selected city", async () => {
      const stateInput: any = {
        request: {
          societyId: 1, // Cleo County is cityId: 2 (Noida)
          cityId: 1, // Request specified Varanasi
        },
        city: { id: 1, name: "Varanasi" },
        parsedAddress: {},
        correlation: {},
        requestSource: "test",
      };

      const result = await societyValidator.validate(stateInput);
      expect(result.halt).toBe(true);
      if (result.halt) {
        expect(result.status).toBe("SOCIETY_NOT_SERVICEABLE");
        expect(result.message).toContain("located outside the selected service city");
      }
    });
  });
});
