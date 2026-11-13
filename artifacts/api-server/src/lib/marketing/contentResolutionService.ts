import { db } from "@workspace/db";
import {
  homepageSectionsTable,
  promotionsTable,
  cityLandingPagesTable,
  citiesTable,
  branchesTable,
  servicesTable,
  type HomepageSection,
  type Promotion,
} from "@workspace/db";
import { eq, and, or, isNull, lte, gte, asc, desc, sql } from "drizzle-orm";

export interface ResolveSectionsOptions {
  cityId?: number | null;
  branchId?: number | null;
  includeDrafts?: boolean;
}

export interface ResolveBannersOptions {
  cityId?: number | null;
  branchId?: number | null;
  placement?: string;
  includeDrafts?: boolean;
  limit?: number;
}

export interface ResolveCityLandingOptions {
  citySlug: string;
  branchId?: number | null;
}

/**
 * Resolves Homepage Sections following the deterministic hierarchy:
 * Branch-Specific -> City-Specific -> Global Fallback
 */
export async function resolveHomepageSections(
  options: ResolveSectionsOptions = {}
): Promise<HomepageSection[]> {
  const { cityId, branchId, includeDrafts = false } = options;
  const now = new Date();

  // Step 1: Attempt to load branch-specific sections if branchId provided
  if (branchId) {
    const branchConditions = [
      eq(homepageSectionsTable.branchId, branchId),
      eq(homepageSectionsTable.isEnabled, true),
    ];
    if (!includeDrafts) {
      branchConditions.push(
        or(isNull(homepageSectionsTable.scheduledPublishAt), lte(homepageSectionsTable.scheduledPublishAt, now))!
      );
      branchConditions.push(
        or(isNull(homepageSectionsTable.expiresAt), gte(homepageSectionsTable.expiresAt, now))!
      );
    }

    const branchSections = await db
      .select()
      .from(homepageSectionsTable)
      .where(and(...branchConditions))
      .orderBy(asc(homepageSectionsTable.sortOrder), asc(homepageSectionsTable.id));

    if (branchSections.length > 0) {
      return branchSections;
    }
  }

  // Step 2: Attempt to load city-specific sections if cityId provided
  if (cityId) {
    const cityConditions = [
      eq(homepageSectionsTable.cityId, cityId),
      isNull(homepageSectionsTable.branchId),
      eq(homepageSectionsTable.isEnabled, true),
    ];
    if (!includeDrafts) {
      cityConditions.push(
        or(isNull(homepageSectionsTable.scheduledPublishAt), lte(homepageSectionsTable.scheduledPublishAt, now))!
      );
      cityConditions.push(
        or(isNull(homepageSectionsTable.expiresAt), gte(homepageSectionsTable.expiresAt, now))!
      );
    }

    const citySections = await db
      .select()
      .from(homepageSectionsTable)
      .where(and(...cityConditions))
      .orderBy(asc(homepageSectionsTable.sortOrder), asc(homepageSectionsTable.id));

    if (citySections.length > 0) {
      return citySections;
    }
  }

  // Step 3: Global fallback sections (cityId IS NULL and branchId IS NULL)
  const globalConditions = [
    isNull(homepageSectionsTable.cityId),
    isNull(homepageSectionsTable.branchId),
    eq(homepageSectionsTable.isEnabled, true),
  ];
  if (!includeDrafts) {
    globalConditions.push(
      or(isNull(homepageSectionsTable.scheduledPublishAt), lte(homepageSectionsTable.scheduledPublishAt, now))!
    );
    globalConditions.push(
      or(isNull(homepageSectionsTable.expiresAt), gte(homepageSectionsTable.expiresAt, now))!
    );
  }

  return db
    .select()
    .from(homepageSectionsTable)
    .where(and(...globalConditions))
    .orderBy(asc(homepageSectionsTable.sortOrder), asc(homepageSectionsTable.id));
}

/**
 * Resolves Banners/Promotions for Customer Homepage following the deterministic hierarchy:
 * Branch Banners -> City Banners -> Global Fallback Banners
 */
export async function resolveHeroBanners(
  options: ResolveBannersOptions = {}
): Promise<Promotion[]> {
  const {
    cityId,
    branchId,
    placement = "home_hero",
    includeDrafts = false,
    limit = 10,
  } = options;

  const now = new Date();
  const conditions = [
    eq(promotionsTable.placement, placement),
    eq(promotionsTable.isActive, true),
  ];

  if (!includeDrafts) {
    conditions.push(eq(promotionsTable.status, "published"));
    conditions.push(or(isNull(promotionsTable.startDate), lte(promotionsTable.startDate, now))!);
    conditions.push(or(isNull(promotionsTable.endDate), gte(promotionsTable.endDate, now))!);
  }

  // Scope filter: branch-specific, city-specific, or global fallback
  if (branchId && cityId) {
    conditions.push(
      or(
        eq(promotionsTable.branchId, branchId),
        and(eq(promotionsTable.cityId, cityId), isNull(promotionsTable.branchId)),
        and(isNull(promotionsTable.cityId), isNull(promotionsTable.branchId))
      )!
    );
  } else if (cityId) {
    conditions.push(
      or(
        and(eq(promotionsTable.cityId, cityId), isNull(promotionsTable.branchId)),
        and(isNull(promotionsTable.cityId), isNull(promotionsTable.branchId))
      )!
    );
  } else {
    conditions.push(
      and(isNull(promotionsTable.cityId), isNull(promotionsTable.branchId))!
    );
  }

  // Order clause: Branch override first (0), City override second (1), Global third (2)
  const branchVal = branchId || -1;
  const cityVal = cityId || -1;

  const orderClause = [
    sql`CASE
      WHEN ${promotionsTable.branchId} = ${branchVal} THEN 0
      WHEN ${promotionsTable.cityId} = ${cityVal} AND ${promotionsTable.branchId} IS NULL THEN 1
      ELSE 2
    END`,
    asc(promotionsTable.sortOrder),
    desc(promotionsTable.id),
  ];

  return db
    .select()
    .from(promotionsTable)
    .where(and(...conditions))
    .orderBy(...orderClause)
    .limit(limit);
}

/**
 * Resolves Dynamic City Landing Page & SEO
 */
export async function resolveCityLandingPage(options: ResolveCityLandingOptions) {
  const { citySlug, branchId } = options;

  // Find city by slug
  const [city] = await db
    .select()
    .from(citiesTable)
    .where(eq(citiesTable.slug, citySlug.toLowerCase().trim()))
    .limit(1);

  if (!city) {
    return null;
  }

  // Find custom landing page record
  const conditions = [
    eq(cityLandingPagesTable.cityId, city.id),
    eq(cityLandingPagesTable.isPublished, true),
  ];
  if (branchId) {
    conditions.push(eq(cityLandingPagesTable.branchId, branchId));
  } else {
    conditions.push(isNull(cityLandingPagesTable.branchId));
  }

  const [landingRow] = await db
    .select()
    .from(cityLandingPagesTable)
    .where(and(...conditions))
    .limit(1);

  // Return custom record if present, otherwise generate intelligent dynamic city landing data
  if (landingRow) {
    return {
      city: {
        id: city.id,
        name: city.name,
        slug: city.slug,
        code: city.code,
        status: city.status,
      },
      pageTitle: landingRow.pageTitle,
      seoTitle: landingRow.seoTitle || `${city.name} Car Detailing & Cleaning Services | CWP Detailers`,
      seoDescription:
        landingRow.seoDescription ||
        `Premium doorstep car wash, detailing and daily cleaning services in ${city.name}. Certified detailers, RO water, and live photo updates.`,
      seoKeywords: landingRow.seoKeywords || `${city.name} car wash, ${city.name} car detailing, doorstep car clean`,
      canonicalUrl: landingRow.canonicalUrl || `https://cwpdetailers.in/${city.slug}`,
      ogTitle: landingRow.ogTitle || `${city.name} Doorstep Car Detailing & Cleaning | CWP Detailers`,
      ogDescription: landingRow.ogDescription || `Book premium doorstep auto care in ${city.name}.`,
      ogImage: landingRow.ogImage || null,
      heroHeadline: landingRow.heroHeadline || `Showroom Shine at Your Doorstep in ${city.name}`,
      heroSubheadline:
        landingRow.heroSubheadline ||
        `Professional mobile car care and daily cleaning across top residential societies in ${city.name}.`,
      customFaqs: landingRow.customFaqs || [],
      customTestimonials: landingRow.customTestimonials || [],
      localizedContent: landingRow.localizedContent || {},
      isPublished: landingRow.isPublished,
    };
  }

  // Dynamic fallback
  return {
    city: {
      id: city.id,
      name: city.name,
      slug: city.slug,
      code: city.code,
      status: city.status,
    },
    pageTitle: `CWP Detailers ${city.name}`,
    seoTitle: `${city.name} Car Detailing & Cleaning Services | CWP Detailers`,
    seoDescription: `Premium doorstep car wash, detailing and daily cleaning services in ${city.name}. Certified detailers, RO water, and live photo updates.`,
    seoKeywords: `${city.name} car wash, ${city.name} car detailing, doorstep car clean`,
    canonicalUrl: `https://cwpdetailers.in/${city.slug}`,
    ogTitle: `${city.name} Doorstep Car Detailing & Cleaning | CWP Detailers`,
    ogDescription: `Book premium doorstep auto care in ${city.name}.`,
    ogImage: null,
    heroHeadline: `Showroom Shine at Your Doorstep in ${city.name}`,
    heroSubheadline: `Professional mobile car care and daily cleaning across top residential societies in ${city.name}.`,
    customFaqs: [
      {
        question: `How does doorstep car cleaning work in ${city.name}?`,
        answer: `Our certified technicians arrive at your society parking bay with 100% RO water, fresh microfibers, and eco-friendly products.`,
      },
      {
        question: `Which societies are covered in ${city.name}?`,
        answer: `We cover all major high-rise residential towers and gated communities across ${city.name}.`,
      },
    ],
    customTestimonials: [
      {
        author: "Rahul S.",
        rating: 5,
        review: `Best car cleaning service in ${city.name}! My car looks brand new every morning.`,
        vehicle: "Sedan",
      },
    ],
    localizedContent: {
      whyChooseUs: [
        "100% RO Water Wash",
        "Zero Scratch Guarantee",
        "Background-Verified Technicians",
        "Instant WhatsApp Photo Updates",
      ],
    },
    isPublished: true,
  };
}
