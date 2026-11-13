import { describe, it, expect } from "vitest";

describe("Phase 21: Customer Referral, Loyalty Rewards & Retention Automation Engine", () => {
  describe("Workstream 1 & 2: Customer Referral Lifecycle & Anti-Fraud Engine", () => {
    it("generates deterministic yet unique uppercase referral codes", () => {
      const generateCode = (name: string, phone: string, salt: number) => {
        const cleanName = (name.replace(/[^A-Za-z]/g, "").slice(0, 3) || "CWP").toUpperCase();
        const phoneTail = phone.replace(/\D/g, "").slice(-4) || "0000";
        const hex = (salt % 1000).toString(36).toUpperCase().padStart(2, "0");
        return `${cleanName}${phoneTail}${hex}`;
      };

      const code1 = generateCode("Ramesh Kumar", "9876543210", 42);
      const code2 = generateCode("Anita Singh", "9123456789", 99);
      const codeEmpty = generateCode("", "", 7);

      expect(code1).toBe("RAM321016");
      expect(code2).toBe("ANI67892R");
      expect(codeEmpty.startsWith("CWP")).toBe(true);
      expect(code1).toMatch(/^[A-Z0-9]{8,12}$/);
    });

    it("prevents self-referrals by customer ID or matching phone number", () => {
      type Customer = { id: number; phone: string };

      const validateReferral = (referrer: Customer, referee: Customer) => {
        if (referrer.id === referee.id) {
          return { valid: false, code: "SELF_REFERRAL_FORBIDDEN" };
        }
        if (referrer.phone.replace(/\D/g, "") === referee.phone.replace(/\D/g, "")) {
          return { valid: false, code: "SELF_PHONE_FORBIDDEN" };
        }
        return { valid: true };
      };

      const userA: Customer = { id: 101, phone: "+91-9876543210" };
      const userB: Customer = { id: 102, phone: "+91-9876543210" }; // same phone
      const userC: Customer = { id: 103, phone: "+91-9999999999" }; // distinct

      expect(validateReferral(userA, userA).valid).toBe(false);
      expect(validateReferral(userA, userA).code).toBe("SELF_REFERRAL_FORBIDDEN");

      expect(validateReferral(userA, userB).valid).toBe(false);
      expect(validateReferral(userA, userB).code).toBe("SELF_PHONE_FORBIDDEN");

      expect(validateReferral(userA, userC).valid).toBe(true);
    });

    it("enforces single referral attribution per customer", () => {
      const attributions = new Map<number, number>(); // refereeId -> referrerId

      const attribute = (refereeId: number, referrerId: number) => {
        if (attributions.has(refereeId)) {
          throw new Error("ALREADY_REFERRED");
        }
        attributions.set(refereeId, referrerId);
        return { success: true };
      };

      expect(attribute(201, 100).success).toBe(true);
      expect(() => attribute(201, 105)).toThrowError("ALREADY_REFERRED");
    });

    it("triggers referral reward exclusively upon referee's first completed paid booking", () => {
      const evaluateReferralRewardEligibility = (
        referral: { id: number; rewardStatus: string },
        booking: { status: string; paymentStatus: string; isFirstBooking: boolean }
      ) => {
        if (referral.rewardStatus !== "pending") {
          return { eligible: false, reason: "ALREADY_PROCESSED" };
        }
        if (booking.status !== "completed") {
          return { eligible: false, reason: "BOOKING_NOT_COMPLETED" };
        }
        if (booking.paymentStatus !== "paid") {
          return { eligible: false, reason: "BOOKING_NOT_PAID" };
        }
        if (!booking.isFirstBooking) {
          return { eligible: false, reason: "NOT_FIRST_BOOKING" };
        }
        return { eligible: true };
      };

      const referral = { id: 1, rewardStatus: "pending" };

      // Case 1: Pending booking
      expect(
        evaluateReferralRewardEligibility(referral, {
          status: "confirmed",
          paymentStatus: "paid",
          isFirstBooking: true,
        }).eligible
      ).toBe(false);

      // Case 2: Unpaid completed booking
      expect(
        evaluateReferralRewardEligibility(referral, {
          status: "completed",
          paymentStatus: "pending",
          isFirstBooking: true,
        }).eligible
      ).toBe(false);

      // Case 3: 2nd completed booking
      expect(
        evaluateReferralRewardEligibility(referral, {
          status: "completed",
          paymentStatus: "paid",
          isFirstBooking: false,
        }).eligible
      ).toBe(false);

      // Case 4: 1st completed paid booking -> Eligible!
      expect(
        evaluateReferralRewardEligibility(referral, {
          status: "completed",
          paymentStatus: "paid",
          isFirstBooking: true,
        }).eligible
      ).toBe(true);
    });

    it("ensures idempotent reward execution with unique idempotency keys", () => {
      const processedTransactions = new Set<string>();

      const executeRewardWithIdempotency = (idempotencyKey: string, points: number) => {
        if (processedTransactions.has(idempotencyKey)) {
          return { executed: false, duplicate: true };
        }
        processedTransactions.add(idempotencyKey);
        return { executed: true, duplicate: false, points };
      };

      const key = "referral_reward_referrer_12_booking_501";

      const firstCall = executeRewardWithIdempotency(key, 100);
      expect(firstCall.executed).toBe(true);
      expect(firstCall.points).toBe(100);

      // Webhook retry or rapid double-tap
      const retryCall = executeRewardWithIdempotency(key, 100);
      expect(retryCall.executed).toBe(false);
      expect(retryCall.duplicate).toBe(true);
    });
  });

  describe("Workstream 3: Loyalty Rules, Points Accrual & Redemption Engine", () => {
    it("resolves configuration via Branch > City > Global hierarchy", () => {
      type Config = {
        cityId: number | null;
        branchId: number | null;
        pointsPerHundredRs: number;
        firstBookingBonus: number;
      };

      const configs: Config[] = [
        { cityId: null, branchId: null, pointsPerHundredRs: 2, firstBookingBonus: 50 }, // Global
        { cityId: 1, branchId: null, pointsPerHundredRs: 3, firstBookingBonus: 75 },   // Varanasi
        { cityId: 1, branchId: 10, pointsPerHundredRs: 5, firstBookingBonus: 100 },   // Lanka Branch
      ];

      const resolveConfig = (cityId?: number | null, branchId?: number | null): Config => {
        if (branchId) {
          const match = configs.find((c) => c.branchId === branchId);
          if (match) return match;
        }
        if (cityId) {
          const match = configs.find((c) => c.cityId === cityId && c.branchId === null);
          if (match) return match;
        }
        return configs.find((c) => c.cityId === null && c.branchId === null)!;
      };

      // Lanka branch override
      expect(resolveConfig(1, 10).pointsPerHundredRs).toBe(5);
      expect(resolveConfig(1, 10).firstBookingBonus).toBe(100);

      // Varanasi general branch
      expect(resolveConfig(1, 11).pointsPerHundredRs).toBe(3);
      expect(resolveConfig(1, 11).firstBookingBonus).toBe(75);

      // Noida (city 2) without specific config -> falls back to Global
      expect(resolveConfig(2, null).pointsPerHundredRs).toBe(2);
      expect(resolveConfig(2, null).firstBookingBonus).toBe(50);
    });

    it("calculates points earned based on spend and first booking bonus", () => {
      const calculateEarnedPoints = (
        spendAmount: number,
        pointsPerHundredRs: number,
        isFirstBooking: boolean,
        firstBookingBonus: number
      ) => {
        const basePoints = Math.floor(spendAmount / 100) * pointsPerHundredRs;
        const bonusPoints = isFirstBooking ? firstBookingBonus : 0;
        return {
          basePoints,
          bonusPoints,
          totalPoints: basePoints + bonusPoints,
        };
      };

      // Order of ₹1450 with 2 pts / ₹100, repeat customer
      const r1 = calculateEarnedPoints(1450, 2, false, 50);
      expect(r1.basePoints).toBe(28); // 14 * 2
      expect(r1.bonusPoints).toBe(0);
      expect(r1.totalPoints).toBe(28);

      // Order of ₹2500 with 3 pts / ₹100, first booking
      const r2 = calculateEarnedPoints(2500, 3, true, 100);
      expect(r2.basePoints).toBe(75); // 25 * 3
      expect(r2.bonusPoints).toBe(100);
      expect(r2.totalPoints).toBe(175);
    });

    it("validates redemption rules strictly: balance, min points, max points, and percent caps", () => {
      const validateRedemption = (
        requestedPoints: number,
        userBalance: number,
        orderTotal: number,
        rules: {
          minPoints: number;
          maxPoints: number;
          maxPercent: number;
          rupeePerPoint: number;
        }
      ) => {
        if (requestedPoints <= 0) return { valid: false, reason: "POINTS_MUST_BE_POSITIVE" };
        if (requestedPoints > userBalance) return { valid: false, reason: "INSUFFICIENT_BALANCE" };
        if (requestedPoints < rules.minPoints) return { valid: false, reason: "BELOW_MINIMUM_REDEMPTION" };
        if (requestedPoints > rules.maxPoints) return { valid: false, reason: "EXCEEDS_MAX_CAP" };

        const discountValue = requestedPoints * rules.rupeePerPoint;
        const maxAllowedDiscount = (orderTotal * rules.maxPercent) / 100;

        if (discountValue > maxAllowedDiscount) {
          return { valid: false, reason: "EXCEEDS_ORDER_PERCENTAGE_CAP" };
        }

        return {
          valid: true,
          redeemedPoints: requestedPoints,
          discountValue,
          netPayable: Math.max(0, orderTotal - discountValue),
        };
      };

      const rules = { minPoints: 50, maxPoints: 500, maxPercent: 50, rupeePerPoint: 1 };

      // Case 1: Insufficient balance
      expect(validateRedemption(100, 40, 1000, rules).reason).toBe("INSUFFICIENT_BALANCE");

      // Case 2: Below minimum threshold
      expect(validateRedemption(30, 200, 1000, rules).reason).toBe("BELOW_MINIMUM_REDEMPTION");

      // Case 3: Exceeds max cap
      expect(validateRedemption(600, 1000, 2000, rules).reason).toBe("EXCEEDS_MAX_CAP");

      // Case 4: Exceeds 50% cap on ₹400 order (max discount ₹200 = 200 pts)
      expect(validateRedemption(300, 500, 400, rules).reason).toBe("EXCEEDS_ORDER_PERCENTAGE_CAP");

      // Case 5: Valid redemption of 150 points on ₹1000 order
      const validRes = validateRedemption(150, 500, 1000, rules);
      expect(validRes.valid).toBe(true);
      expect(validRes.discountValue).toBe(150);
      expect(validRes.netPayable).toBe(850);
    });
  });

  describe("Workstream 4: Immutable Points Ledger & Financial Accounting", () => {
    it("maintains strict mathematical balance continuity across credit and debit sequences", () => {
      type LedgerEntry = {
        id: number;
        type: "credit" | "debit" | "reversal" | "expiry";
        points: number;
        balanceAfter: number;
      };

      const entries: LedgerEntry[] = [];
      let currentBalance = 0;

      const recordTransaction = (type: "credit" | "debit" | "reversal" | "expiry", points: number) => {
        if (points <= 0) throw new Error("Points must be positive");
        if ((type === "debit" || type === "expiry") && currentBalance < points) {
          throw new Error("Insufficient balance for debit");
        }

        const delta = type === "credit" || type === "reversal" ? points : -points;
        currentBalance += delta;

        const entry: LedgerEntry = {
          id: entries.length + 1,
          type,
          points,
          balanceAfter: currentBalance,
        };
        entries.push(entry);
        return entry;
      };

      recordTransaction("credit", 100); // balance: 100
      recordTransaction("credit", 200); // balance: 300
      recordTransaction("debit", 50);   // balance: 250
      recordTransaction("credit", 50);  // balance: 300
      recordTransaction("debit", 100);  // balance: 200

      expect(currentBalance).toBe(200);
      expect(entries[0].balanceAfter).toBe(100);
      expect(entries[1].balanceAfter).toBe(300);
      expect(entries[2].balanceAfter).toBe(250);
      expect(entries[3].balanceAfter).toBe(300);
      expect(entries[4].balanceAfter).toBe(200);

      // Attempting overdraft
      expect(() => recordTransaction("debit", 300)).toThrowError("Insufficient balance for debit");
    });

    it("supports administrative ledger reversal and clawback", () => {
      let balance = 250;

      const reverseTransaction = (originalType: "credit" | "debit", points: number, allowNegative = false) => {
        if (originalType === "debit") {
          // Reversing a debit -> refund points
          balance += points;
          return { newBalance: balance, action: "REFUNDED" };
        } else {
          // Reversing a credit -> clawback points
          if (balance < points && !allowNegative) {
            throw new Error("CANNOT_CLAWBACK_INSUFFICIENT_BALANCE");
          }
          balance -= points;
          return { newBalance: balance, action: "CLAWED_BACK" };
        }
      };

      // Refund a debit of 50 points
      expect(reverseTransaction("debit", 50).newBalance).toBe(300);

      // Clawback 100 fraudulent credit points
      expect(reverseTransaction("credit", 100).newBalance).toBe(200);

      // Clawback 300 points when balance is only 200 without negative allowance -> throws
      expect(() => reverseTransaction("credit", 300, false)).toThrowError("CANNOT_CLAWBACK_INSUFFICIENT_BALANCE");
    });
  });

  describe("Workstream 5: Customer Retention & Re-engagement Automation", () => {
    it("identifies candidate customers across lifecycle triggers accurately", () => {
      const now = new Date("2026-11-13T12:00:00Z");

      const customers = [
        // Registered 10 days ago, 0 bookings -> matches registered_no_booking (>7d)
        { id: 1, createdAt: new Date("2026-11-03T12:00:00Z"), bookingsCount: 0, lastBookingAt: null },
        // Registered yesterday, 0 bookings -> too new
        { id: 2, createdAt: new Date("2026-11-12T12:00:00Z"), bookingsCount: 0, lastBookingAt: null },
        // Last booking 45 days ago -> matches inactive_customer (>30d)
        { id: 3, createdAt: new Date("2026-08-01T12:00:00Z"), bookingsCount: 3, lastBookingAt: new Date("2026-09-29T12:00:00Z") },
        // Last booking 5 days ago -> active
        { id: 4, createdAt: new Date("2026-08-01T12:00:00Z"), bookingsCount: 5, lastBookingAt: new Date("2026-11-08T12:00:00Z") },
      ];

      const matchRegisteredNoBooking = (c: (typeof customers)[0]) => {
        const daysSinceReg = (now.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return c.bookingsCount === 0 && daysSinceReg >= 7;
      };

      const matchInactiveCustomer = (c: (typeof customers)[0]) => {
        if (!c.lastBookingAt) return false;
        const daysSinceLast = (now.getTime() - c.lastBookingAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLast >= 30;
      };

      const regMatches = customers.filter(matchRegisteredNoBooking);
      expect(regMatches.map((c) => c.id)).toEqual([1]);

      const inactiveMatches = customers.filter(matchInactiveCustomer);
      expect(inactiveMatches.map((c) => c.id)).toEqual([3]);
    });

    it("respects marketing consent and suppresses opted-out customers", () => {
      const candidates = [
        { customerId: 10, hasMarketingConsent: true },
        { customerId: 11, hasMarketingConsent: false }, // opted out
        { customerId: 12, hasMarketingConsent: true },
      ];

      const filterConsented = (list: typeof candidates) => list.filter((c) => c.hasMarketingConsent);

      const filtered = filterConsented(candidates);
      expect(filtered.map((c) => c.customerId)).toEqual([10, 12]);
    });

    it("enforces frequency capping to avoid contacting customers multiple times within cap window", () => {
      const now = new Date("2026-11-13T12:00:00Z");

      const executions = [
        // Contacted 3 days ago for registered_no_booking
        { customerId: 101, automationKey: "welcome_reminder", sentAt: new Date("2026-11-10T12:00:00Z") },
        // Contacted 20 days ago
        { customerId: 102, automationKey: "welcome_reminder", sentAt: new Date("2026-10-24T12:00:00Z") },
      ];

      const isCapped = (customerId: number, capDays: number) => {
        const lastSent = executions.find((e) => e.customerId === customerId);
        if (!lastSent) return false;
        const daysElapsed = (now.getTime() - lastSent.sentAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysElapsed < capDays;
      };

      // Cap window of 7 days:
      expect(isCapped(101, 7)).toBe(true);  // 3 days < 7 days -> Capped!
      expect(isCapped(102, 7)).toBe(false); // 20 days > 7 days -> Not capped!
      expect(isCapped(103, 7)).toBe(false); // Never sent -> Not capped!
    });

    it("supports non-destructive dry-run mode without modifying communication state", () => {
      const simulateRetentionRun = (candidatesCount: number, dryRun: boolean) => {
        let sentCount = 0;
        let loggedCount = 0;

        if (!dryRun) {
          sentCount = candidatesCount;
          loggedCount = candidatesCount;
        }

        return {
          evaluated: candidatesCount,
          sent: sentCount,
          logged: loggedCount,
          dryRun,
        };
      };

      const dryResult = simulateRetentionRun(15, true);
      expect(dryResult.evaluated).toBe(15);
      expect(dryResult.sent).toBe(0);
      expect(dryResult.dryRun).toBe(true);

      const liveResult = simulateRetentionRun(15, false);
      expect(liveResult.evaluated).toBe(15);
      expect(liveResult.sent).toBe(15);
      expect(liveResult.dryRun).toBe(false);
    });
  });

  describe("Workstream 6: Multi-Tenant Governance & Role Security", () => {
    it("enforces staff and manager scope isolation on customer loyalty data", () => {
      type User = { role: string; cityId?: number; branchIds?: number[] };

      const canAccessCustomerLedger = (
        user: User,
        customerScope: { cityId: number | null; branchId: number | null }
      ) => {
        if (["superadmin", "central_admin", "admin"].includes(user.role)) return true;

        if (user.role === "city_admin") {
          return user.cityId === customerScope.cityId;
        }

        if (["branch_manager", "manager"].includes(user.role)) {
          if (!customerScope.branchId || !user.branchIds) return false;
          return user.branchIds.includes(customerScope.branchId);
        }

        return false;
      };

      const superAdmin: User = { role: "superadmin" };
      const noidaCityAdmin: User = { role: "city_admin", cityId: 2 };
      const lankaBranchMgr: User = { role: "branch_manager", cityId: 1, branchIds: [10] };

      const varanasiCust = { cityId: 1, branchId: 10 };
      const noidaCust = { cityId: 2, branchId: 20 };

      // Super admin can access both
      expect(canAccessCustomerLedger(superAdmin, varanasiCust)).toBe(true);
      expect(canAccessCustomerLedger(superAdmin, noidaCust)).toBe(true);

      // Noida City Admin can only access Noida
      expect(canAccessCustomerLedger(noidaCityAdmin, noidaCust)).toBe(true);
      expect(canAccessCustomerLedger(noidaCityAdmin, varanasiCust)).toBe(false);

      // Lanka Branch Manager can access Lanka customer, but not Noida
      expect(canAccessCustomerLedger(lankaBranchMgr, varanasiCust)).toBe(true);
      expect(canAccessCustomerLedger(lankaBranchMgr, noidaCust)).toBe(false);
    });

    it("restricts manual points adjustment exclusively to administrative roles", () => {
      const canAdjustPoints = (role: string) => {
        return ["superadmin", "central_admin", "admin"].includes(role);
      };

      expect(canAdjustPoints("superadmin")).toBe(true);
      expect(canAdjustPoints("admin")).toBe(true);
      expect(canAdjustPoints("branch_manager")).toBe(false);
      expect(canAdjustPoints("cleaner")).toBe(false);
      expect(canAdjustPoints("customer")).toBe(false);
    });
  });
});
