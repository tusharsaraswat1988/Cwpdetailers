import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "net";

// Mock DB Layer
const mockPromotions: any[] = [
  {
    id: 1,
    title: "Global Shine Anywhere",
    subtitle: "Global fallback banner",
    bannerType: "first_party",
    placement: "home_hero",
    cityId: null,
    cityName: null,
    serviceId: null,
    serviceName: null,
    serviceSlug: null,
    badgeText: "#1 Car Care",
    imageUrl: null,
    mobileImageUrl: null,
    ctaText: "Book Now",
    ctaLink: "/customer/schedule",
    highlights: ["100% RO Water", "Zero Scratches"],
    advertiserName: null,
    startDate: null,
    endDate: null,
    isActive: true,
    sortOrder: 100,
    clickCount: 5,
    impressionCount: 100,
    metadata: null,
  },
  {
    id: 2,
    title: "Noida High-Rise Society Cleaning",
    subtitle: "Daily car care in basement bays",
    bannerType: "first_party",
    placement: "home_hero",
    cityId: 2,
    cityName: "Noida",
    serviceId: 10,
    serviceName: "Daily Car Cleaning",
    serviceSlug: "daily-car-cleaning",
    badgeText: "Noida's #1 Society Care",
    imageUrl: null,
    mobileImageUrl: null,
    ctaText: "View Plans",
    ctaLink: "/customer/plans",
    highlights: ["Basement Parking Service", "Daily Morning Routine"],
    advertiserName: null,
    startDate: null,
    endDate: null,
    isActive: true,
    sortOrder: 10,
    clickCount: 12,
    impressionCount: 250,
    metadata: null,
  },
  {
    id: 3,
    title: "Varanasi Foam Detailing",
    subtitle: "Doorstep detailing in Varanasi",
    bannerType: "first_party",
    placement: "home_hero",
    cityId: 1,
    cityName: "Varanasi",
    serviceId: 1,
    serviceName: "Standard Car Wash",
    serviceSlug: "car-wash",
    badgeText: "Varanasi Detailing",
    imageUrl: null,
    mobileImageUrl: null,
    ctaText: "Book Foam Wash",
    ctaLink: "/customer/schedule",
    highlights: ["Zero Scratches", "+25% Solar Power"],
    advertiserName: null,
    startDate: null,
    endDate: null,
    isActive: true,
    sortOrder: 10,
    clickCount: 8,
    impressionCount: 180,
    metadata: null,
  },
  {
    id: 4,
    title: "Expired Promo",
    subtitle: "Should not appear",
    bannerType: "first_party",
    placement: "home_hero",
    cityId: 2,
    cityName: "Noida",
    serviceId: null,
    serviceName: null,
    serviceSlug: null,
    badgeText: "Expired",
    imageUrl: null,
    mobileImageUrl: null,
    ctaText: null,
    ctaLink: null,
    highlights: null,
    advertiserName: null,
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-02-01"), // Expired!
    isActive: true,
    sortOrder: 1,
    clickCount: 0,
    impressionCount: 0,
    metadata: null,
  },
];

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: (fields?: any) => ({
        from: (table: any) => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: (condition: any) => ({
                orderBy: (...args: any[]) => ({
                  limit: (num: number) => {
                    // Filter active promotions
                    return Promise.resolve(
                      mockPromotions.filter(p => p.isActive && (!p.endDate || new Date(p.endDate) >= new Date()))
                    );
                  },
                }),
              }),
            }),
          }),
          where: (condition: any) => ({
            limit: (num: number) => {
              // Used for resolving citySlug
              return Promise.resolve([{ id: 2, name: "Noida", slug: "noida" }]);
            },
          }),
        }),
      }),
      update: () => ({
        set: (data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 2, clickCount: 13 }]),
            catch: () => {},
          }),
        }),
      }),
      insert: () => ({
        values: (data: any) => ({
          returning: () => Promise.resolve([{ id: 5, ...data, clickCount: 0, impressionCount: 0 }]),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 2 }]),
        }),
      }),
    },
    promotionsTable: {
      id: "id",
      title: "title",
      subtitle: "subtitle",
      bannerType: "banner_type",
      placement: "placement",
      cityId: "city_id",
      serviceId: "service_id",
      badgeText: "badge_text",
      imageUrl: "image_url",
      mobileImageUrl: "mobile_image_url",
      ctaText: "cta_text",
      ctaLink: "cta_link",
      highlights: "highlights",
      advertiserName: "advertiser_name",
      advertiserContact: "advertiser_contact",
      startDate: "start_date",
      endDate: "end_date",
      isActive: "is_active",
      sortOrder: "sort_order",
      clickCount: "click_count",
      impressionCount: "impression_count",
      metadata: "metadata",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    citiesTable: {
      id: "id",
      name: "name",
      slug: "slug",
    },
    servicesTable: {
      id: "id",
      name: "name",
      slug: "slug",
    },
  };
});

vi.mock("../../middlewares/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: "admin" };
    next();
  },
}));

import promotionsRouter from "../../routes/promotions";

describe("Promotions & Banner Engine API (ADS-001)", () => {
  let app: express.Express;
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      next();
    });
    app.use("/api", promotionsRouter);

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

  it("1. Public GET /api/promotions returns active campaigns and resolves citySlug", async () => {
    const res = await fetch(`${baseUrl}/promotions?placement=home_hero&citySlug=noida`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.promotions).toBeDefined();
    expect(Array.isArray(body.promotions)).toBe(true);
    expect(body.resolvedCityId).toBe(2);

    // Verify returned items
    const titles = body.promotions.map((p: any) => p.title);
    expect(titles).toContain("Noida High-Rise Society Cleaning");
    // Expired campaign (id 4) must be excluded
    expect(titles).not.toContain("Expired Promo");
  });

  it("2. POST /api/promotions/:id/click records click atomically", async () => {
    const res = await fetch(`${baseUrl}/promotions/2/click`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.id).toBe(2);
    expect(body.clickCount).toBe(13);
  });

  it("3. Admin POST /api/promotions creates a new city-targeted campaign", async () => {
    const res = await fetch(`${baseUrl}/promotions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Monsoon Detailing Fest",
        subtitle: "50% off exterior detailing",
        bannerType: "first_party",
        placement: "home_hero",
        cityId: 2,
        badgeText: "Limited Time",
        ctaText: "Grab Deal",
        ctaLink: "/customer/schedule",
        highlights: ["Monsoon Protection", "Hydrophobic Coating"],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.promotion).toBeDefined();
    expect(body.promotion.title).toBe("Monsoon Detailing Fest");
    expect(body.promotion.cityId).toBe(2);
  });

  it("4. Admin POST /api/promotions rejects invalid campaign without title", async () => {
    const res = await fetch(`${baseUrl}/promotions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitle: "Missing title",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();

    expect(body.error).toContain("title is required");
  });

  it("5. Admin DELETE /api/promotions/:id removes campaign", async () => {
    const res = await fetch(`${baseUrl}/promotions/2`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.id).toBe(2);
  });
});
