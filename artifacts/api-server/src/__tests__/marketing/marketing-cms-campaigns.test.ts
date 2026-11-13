import { describe, it, expect } from "vitest";

describe("Phase 20: City/Branch-Wise Marketing, Homepage CMS & Campaign Management", () => {
  describe("Workstream 1: Homepage Section Content Resolution Hierarchy", () => {
    it("resolves branch-specific section over city and global fallbacks", () => {
      const sections = [
        { id: 1, sectionKey: "hero_banner", cityId: null, branchId: null, title: "Global Hero", sortOrder: 1 },
        { id: 2, sectionKey: "hero_banner", cityId: 1, branchId: null, title: "Varanasi City Hero", sortOrder: 1 },
        { id: 3, sectionKey: "hero_banner", cityId: 1, branchId: 10, title: "Lanka Branch Hero", sortOrder: 1 },
      ];

      const resolveSection = (key: string, cityId?: number | null, branchId?: number | null) => {
        if (branchId) {
          const branchSection = sections.find((s) => s.sectionKey === key && s.branchId === branchId);
          if (branchSection) return { section: branchSection, source: "branch_override" };
        }
        if (cityId) {
          const citySection = sections.find((s) => s.sectionKey === key && s.cityId === cityId && s.branchId === null);
          if (citySection) return { section: citySection, source: "city_override" };
        }
        const globalSection = sections.find((s) => s.sectionKey === key && s.cityId === null && s.branchId === null);
        if (globalSection) return { section: globalSection, source: "global_fallback" };
        return null;
      };

      // Query for Lanka Branch (branchId: 10, cityId: 1)
      const resBranch = resolveSection("hero_banner", 1, 10);
      expect(resBranch?.section.title).toBe("Lanka Branch Hero");
      expect(resBranch?.source).toBe("branch_override");

      // Query for another branch in Varanasi with no override (branchId: 11, cityId: 1)
      const resCity = resolveSection("hero_banner", 1, 11);
      expect(resCity?.section.title).toBe("Varanasi City Hero");
      expect(resCity?.source).toBe("city_override");

      // Query for a new city with no configuration (cityId: 99)
      const resGlobal = resolveSection("hero_banner", 99);
      expect(resGlobal?.section.title).toBe("Global Hero");
      expect(resGlobal?.source).toBe("global_fallback");
    });

    it("respects section reordering and sortOrder sequence", () => {
      const sections = [
        { id: 1, sectionKey: "reviews", sortOrder: 4 },
        { id: 2, sectionKey: "hero", sortOrder: 1 },
        { id: 3, sectionKey: "services", sortOrder: 2 },
        { id: 4, sectionKey: "offers", sortOrder: 3 },
      ];

      const ordered = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
      expect(ordered.map((s) => s.sectionKey)).toEqual(["hero", "services", "offers", "reviews"]);
    });
  });

  describe("Workstream 2: Temporal Scheduling Bounds", () => {
    it("excludes future-dated content from public customer discovery", () => {
      const now = new Date("2026-11-13T12:00:00Z");
      const launchDate = new Date("2026-11-20T00:00:00Z"); // in 7 days

      const section = {
        title: "Winter Festival Special",
        scheduledPublishAt: launchDate,
        expiresAt: null,
      };

      const isLive = (scheduled?: Date | null, expires?: Date | null) => {
        if (scheduled && scheduled > now) return false;
        if (expires && expires < now) return false;
        return true;
      };

      expect(isLive(section.scheduledPublishAt, section.expiresAt)).toBe(false);
    });

    it("excludes expired promotions and banners", () => {
      const now = new Date("2026-11-13T12:00:00Z");
      const expiryDate = new Date("2026-11-10T00:00:00Z"); // 3 days ago

      const banner = {
        title: "Diwali Early Bird Discount",
        startDate: new Date("2026-10-20T00:00:00Z"),
        endDate: expiryDate,
      };

      const isBannerActive = (b: typeof banner) => {
        if (b.startDate && b.startDate > now) return false;
        if (b.endDate && b.endDate < now) return false;
        return true;
      };

      expect(isBannerActive(banner)).toBe(false);
    });
  });

  describe("Workstream 3: Campaign & Coupon Discount Engine", () => {
    it("calculates percentage discount accurately without decimals leakage", () => {
      const campaign = {
        code: "WELCOME15",
        offerType: "percentage_discount",
        discountValue: 15, // 15%
        minOrderAmount: 500,
        maxDiscountAmount: null,
      };

      const calculateDiscount = (camp: typeof campaign, orderAmount: number) => {
        if (orderAmount < camp.minOrderAmount) {
          return { isValid: false, error: "MIN_ORDER_AMOUNT_NOT_MET", discount: 0, payable: orderAmount };
        }
        let discount = (orderAmount * camp.discountValue) / 100;
        if (camp.maxDiscountAmount && discount > camp.maxDiscountAmount) {
          discount = camp.maxDiscountAmount;
        }
        discount = Math.min(orderAmount, Math.round(discount * 100) / 100);
        return { isValid: true, discount, payable: orderAmount - discount };
      };

      // Order of ₹1,000 -> 15% discount is ₹150, payable is ₹850
      const res = calculateDiscount(campaign, 1000);
      expect(res.isValid).toBe(true);
      expect(res.discount).toBe(150);
      expect(res.payable).toBe(850);
    });

    it("enforces max discount amount cap when percentage exceeds threshold", () => {
      const campaign = {
        code: "SUPER50",
        offerType: "percentage_discount",
        discountValue: 50, // 50%
        minOrderAmount: 500,
        maxDiscountAmount: 200, // Capped at ₹200
      };

      const calculateDiscount = (camp: typeof campaign, orderAmount: number) => {
        let discount = (orderAmount * camp.discountValue) / 100;
        if (camp.maxDiscountAmount && discount > camp.maxDiscountAmount) {
          discount = camp.maxDiscountAmount;
        }
        return { discount, payable: orderAmount - discount };
      };

      // 50% of ₹1,000 would be ₹500, but capped at ₹200
      const res = calculateDiscount(campaign, 1000);
      expect(res.discount).toBe(200);
      expect(res.payable).toBe(800);
    });

    it("enforces minimum order amount threshold", () => {
      const campaign = {
        code: "SAVE100",
        offerType: "flat_discount",
        discountValue: 100,
        minOrderAmount: 799,
      };

      const validateOrder = (camp: typeof campaign, orderAmount: number) => {
        return orderAmount >= camp.minOrderAmount;
      };

      expect(validateOrder(campaign, 499)).toBe(false);
      expect(validateOrder(campaign, 799)).toBe(true);
      expect(validateOrder(campaign, 1200)).toBe(true);
    });

    it("enforces city scope restrictions on campaign coupons", () => {
      const campaign = {
        code: "NOIDAONLY",
        cityId: 2, // Scoped to Noida
      };

      const isApplicableInCity = (camp: typeof campaign, targetCityId?: number | null) => {
        if (camp.cityId == null) return true; // Global
        return camp.cityId === targetCityId;
      };

      expect(isApplicableInCity(campaign, 2)).toBe(true); // Noida
      expect(isApplicableInCity(campaign, 1)).toBe(false); // Varanasi
      expect(isApplicableInCity(campaign, null)).toBe(false);
    });

    it("enforces usage limits rejecting exhausted coupons", () => {
      const campaign = {
        code: "FIRST50",
        usageLimit: 50,
        usedCount: 50,
      };

      const canRedeem = (camp: typeof campaign) => {
        if (camp.usageLimit == null) return true;
        return camp.usedCount < camp.usageLimit;
      };

      expect(canRedeem(campaign)).toBe(false);

      const activeCampaign = { ...campaign, usedCount: 49 };
      expect(canRedeem(activeCampaign)).toBe(true);
    });

    it("guarantees discount never produces negative payable", () => {
      const campaign = {
        code: "FLAT1000",
        offerType: "flat_discount",
        discountValue: 1000,
      };

      const calculatePayable = (camp: typeof campaign, orderAmount: number) => {
        const discount = Math.min(orderAmount, camp.discountValue);
        return Math.max(0, orderAmount - discount);
      };

      expect(calculatePayable(campaign, 400)).toBe(0);
      expect(calculatePayable(campaign, 1500)).toBe(500);
    });
  });

  describe("Workstream 4: Multi-City Scope & Security Isolation", () => {
    it("prevents City Admin from modifying another city's marketing content", () => {
      const checkScopePermission = (user: { role: string; cityId?: number }, targetCityId?: number | null) => {
        if (["superadmin", "central_admin", "admin"].includes(user.role)) return true;
        if (user.role === "city_admin") {
          if (!targetCityId) return false; // cannot edit global
          return user.cityId === targetCityId;
        }
        return false;
      };

      const noidaAdmin = { role: "city_admin", cityId: 2 }; // Noida
      const varanasiAdmin = { role: "city_admin", cityId: 1 }; // Varanasi
      const superAdmin = { role: "superadmin" };

      // Noida admin editing Noida content -> Allowed
      expect(checkScopePermission(noidaAdmin, 2)).toBe(true);

      // Noida admin attempting to edit Varanasi content -> Rejected (403)
      expect(checkScopePermission(noidaAdmin, 1)).toBe(false);

      // Noida admin attempting to edit Global content -> Rejected (403)
      expect(checkScopePermission(noidaAdmin, null)).toBe(false);

      // Super admin editing any content -> Allowed
      expect(checkScopePermission(superAdmin, 1)).toBe(true);
      expect(checkScopePermission(superAdmin, 2)).toBe(true);
      expect(checkScopePermission(superAdmin, null)).toBe(true);
    });

    it("prevents Branch Manager from modifying content outside assigned branches", () => {
      const checkBranchPermission = (user: { role: string; branchIds: number[] }, targetBranchId?: number | null) => {
        if (["superadmin", "central_admin", "admin"].includes(user.role)) return true;
        if (["branch_manager", "manager"].includes(user.role)) {
          if (!targetBranchId) return false;
          return user.branchIds.includes(targetBranchId);
        }
        return false;
      };

      const lankaManager = { role: "branch_manager", branchIds: [10] };

      expect(checkBranchPermission(lankaManager, 10)).toBe(true);
      expect(checkBranchPermission(lankaManager, 11)).toBe(false);
      expect(checkBranchPermission(lankaManager, null)).toBe(false);
    });
  });

  describe("Workstream 5: Analytics & Campaign Telemetry", () => {
    it("calculates click-through rate (CTR %) accurately and prevents division by zero", () => {
      const calculateCtr = (impressions: number, clicks: number): number => {
        if (impressions <= 0) return 0;
        return Math.round((clicks / impressions) * 10000) / 100;
      };

      expect(calculateCtr(1000, 50)).toBe(5); // 5%
      expect(calculateCtr(2500, 85)).toBe(3.4); // 3.4%
      expect(calculateCtr(0, 0)).toBe(0); // Zero impressions -> 0%
    });

    it("attributes revenue cleanly without double-counting", () => {
      const events = [
        { id: 1, eventType: "campaign_conversion", campaignId: 101, conversionValue: 999 },
        { id: 2, eventType: "campaign_conversion", campaignId: 101, conversionValue: 1499 },
        { id: 3, eventType: "banner_click", campaignId: 101, conversionValue: null },
      ];

      const totalRevenue = events
        .filter((e) => e.eventType === "campaign_conversion")
        .reduce((sum, e) => sum + (e.conversionValue || 0), 0);

      expect(totalRevenue).toBe(2498);
    });
  });
});
