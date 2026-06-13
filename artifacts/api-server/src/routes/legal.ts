import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth";
import {
  db,
  legalPagesTable,
  legalPageVersionsTable,
  businessInfoTable,
  refundPolicySettingsTable,
  oauthComplianceSettingsTable,
  seoSettingsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

/** Safely extract a scalar string from Express route params (Express 5 types are string | string[]) */
function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0] : p;
}

const router: IRouter = Router();

const PUBLIC_CACHE = "public, max-age=120, stale-while-revalidate=600";
const ADMIN_ONLY_CACHE = "private, no-cache";

// ─── Public Legal Pages ───────────────────────────────────────────────────────

/** GET /legal/pages — list all published pages (public) */
router.get("/legal/pages", async (req: Request, res: Response) => {
  try {
    const pages = await db
      .select({
        id: legalPagesTable.id,
        slug: legalPagesTable.slug,
        title: legalPagesTable.title,
        status: legalPagesTable.status,
        seoTitle: legalPagesTable.seoTitle,
        seoDescription: legalPagesTable.seoDescription,
        updatedAt: legalPagesTable.updatedAt,
        publishedAt: legalPagesTable.publishedAt,
      })
      .from(legalPagesTable)
      .orderBy(legalPagesTable.slug);

    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(pages);
  } catch (err) {
    req.log.error({ err }, "Failed to list legal pages");
    res.status(500).json({ error: "Failed to list legal pages" });
  }
});

/** GET /legal/pages/:slug — get published page by slug (public) */
router.get("/legal/pages/:slug", async (req: Request, res: Response) => {
  const slug = param(req.params.slug);
  try {
    const [page] = await db
      .select()
      .from(legalPagesTable)
      .where(eq(legalPagesTable.slug, slug))
      .limit(1);

    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // Public endpoint only serves published pages
    if (page.status !== "published") {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(page);
  } catch (err) {
    req.log.error({ err }, "Failed to get legal page");
    res.status(500).json({ error: "Failed to get legal page" });
  }
});

// ─── Admin Legal Pages ────────────────────────────────────────────────────────

/** GET /admin/legal/pages — list all pages including drafts (admin) */
router.get(
  "/admin/legal/pages",
  requireAuth,
  requirePermission("settings", "view"),
  async (req: Request, res: Response) => {
    try {
      const pages = await db
        .select()
        .from(legalPagesTable)
        .orderBy(legalPagesTable.slug);
      res.set("Cache-Control", ADMIN_ONLY_CACHE);
      res.json(pages);
    } catch (err) {
      req.log.error({ err }, "Failed to list admin legal pages");
      res.status(500).json({ error: "Failed to list legal pages" });
    }
  },
);

/** GET /admin/legal/pages/:slug — get page by slug (admin, includes draft) */
router.get(
  "/admin/legal/pages/:slug",
  requireAuth,
  requirePermission("settings", "view"),
  async (req: Request, res: Response) => {
    const slug = param(req.params.slug);
    try {
      const [page] = await db
        .select()
        .from(legalPagesTable)
        .where(eq(legalPagesTable.slug, slug))
        .limit(1);

      if (!page) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      res.set("Cache-Control", ADMIN_ONLY_CACHE);
      res.json(page);
    } catch (err) {
      req.log.error({ err }, "Failed to get admin legal page");
      res.status(500).json({ error: "Failed to get legal page" });
    }
  },
);

/** PUT /admin/legal/pages/:slug — save draft (creates version snapshot) */
router.put(
  "/admin/legal/pages/:slug",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const slug = param(req.params.slug);
    const body = req.body ?? {};
    const editorName = req.user?.name ?? "Admin";

    const allowed = [
      "title", "content", "status",
      "seoTitle", "seoDescription", "seoKeywords", "canonicalUrl",
      "ogTitle", "ogDescription", "ogImage",
    ] as const;

    try {
      const [existing] = await db
        .select()
        .from(legalPagesTable)
        .where(eq(legalPagesTable.slug, slug))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      // Save version snapshot of current state before overwriting
      await db.insert(legalPageVersionsTable).values({
        pageId: existing.id,
        slug: existing.slug,
        title: existing.title,
        content: existing.content,
        seoTitle: existing.seoTitle,
        seoDescription: existing.seoDescription,
        seoKeywords: existing.seoKeywords,
        canonicalUrl: existing.canonicalUrl,
        ogTitle: existing.ogTitle,
        ogDescription: existing.ogDescription,
        savedBy: editorName,
      });

      // Prune — keep max 50 versions per page
      const versions = await db
        .select({ id: legalPageVersionsTable.id })
        .from(legalPageVersionsTable)
        .where(eq(legalPageVersionsTable.pageId, existing.id))
        .orderBy(desc(legalPageVersionsTable.createdAt));

      if (versions.length > 50) {
        const toDelete = versions.slice(50).map(v => v.id);
        for (const vId of toDelete) {
          await db
            .delete(legalPageVersionsTable)
            .where(eq(legalPageVersionsTable.id, vId));
        }
      }

      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
        lastUpdatedBy: editorName,
      };

      for (const key of allowed) {
        if (body[key] !== undefined) patch[key] = body[key];
      }

      if (patch.status === "published" && !existing.publishedAt) {
        patch.publishedAt = new Date();
      }

      const [updated] = await db
        .update(legalPagesTable)
        .set(patch)
        .where(eq(legalPagesTable.slug, slug))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to update legal page");
      res.status(500).json({ error: "Failed to update legal page" });
    }
  },
);

/** POST /admin/legal/pages/:slug/publish — publish page */
router.post(
  "/admin/legal/pages/:slug/publish",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const slug = param(req.params.slug);
    try {
      const [updated] = await db
        .update(legalPagesTable)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(legalPagesTable.slug, slug))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to publish legal page");
      res.status(500).json({ error: "Failed to publish legal page" });
    }
  },
);

/** POST /admin/legal/pages/:slug/unpublish — revert to draft */
router.post(
  "/admin/legal/pages/:slug/unpublish",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const slug = param(req.params.slug);
    try {
      const [updated] = await db
        .update(legalPagesTable)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(legalPagesTable.slug, slug))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to unpublish legal page");
      res.status(500).json({ error: "Failed to unpublish legal page" });
    }
  },
);

/** GET /admin/legal/pages/:slug/versions — version history */
router.get(
  "/admin/legal/pages/:slug/versions",
  requireAuth,
  requirePermission("settings", "view"),
  async (req: Request, res: Response) => {
    const slug = param(req.params.slug);
    try {
      const [page] = await db
        .select({ id: legalPagesTable.id })
        .from(legalPagesTable)
        .where(eq(legalPagesTable.slug, slug))
        .limit(1);

      if (!page) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      const versions = await db
        .select()
        .from(legalPageVersionsTable)
        .where(eq(legalPageVersionsTable.pageId, page.id))
        .orderBy(desc(legalPageVersionsTable.createdAt))
        .limit(50);

      res.json(versions);
    } catch (err) {
      req.log.error({ err }, "Failed to get legal page versions");
      res.status(500).json({ error: "Failed to get versions" });
    }
  },
);

/** POST /admin/legal/pages/:slug/restore/:versionId — rollback to version */
router.post(
  "/admin/legal/pages/:slug/restore/:versionId",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const slug = param(req.params.slug); const versionId = param(req.params.versionId);
    const editorName = req.user?.name ?? "Admin";

    try {
      const [page] = await db
        .select()
        .from(legalPagesTable)
        .where(eq(legalPagesTable.slug, slug))
        .limit(1);

      if (!page) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      const [version] = await db
        .select()
        .from(legalPageVersionsTable)
        .where(eq(legalPageVersionsTable.id, parseInt(versionId, 10)))
        .limit(1);

      if (!version || version.pageId !== page.id) {
        res.status(404).json({ error: "Version not found" });
        return;
      }

      // Snapshot current state before restoring
      await db.insert(legalPageVersionsTable).values({
        pageId: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        seoKeywords: page.seoKeywords,
        canonicalUrl: page.canonicalUrl,
        ogTitle: page.ogTitle,
        ogDescription: page.ogDescription,
        savedBy: `${editorName} (before restore)`,
      });

      const [updated] = await db
        .update(legalPagesTable)
        .set({
          title: version.title,
          content: version.content,
          seoTitle: version.seoTitle,
          seoDescription: version.seoDescription,
          seoKeywords: version.seoKeywords,
          canonicalUrl: version.canonicalUrl,
          ogTitle: version.ogTitle,
          ogDescription: version.ogDescription,
          updatedAt: new Date(),
          lastUpdatedBy: `${editorName} (restored from ${new Date(version.createdAt).toISOString()})`,
        })
        .where(eq(legalPagesTable.slug, slug))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to restore legal page version");
      res.status(500).json({ error: "Failed to restore version" });
    }
  },
);

// ─── Business Info ────────────────────────────────────────────────────────────

/** GET /business-info — public business info */
router.get("/business-info", async (req: Request, res: Response) => {
  try {
    const [info] = await db.select().from(businessInfoTable).where(eq(businessInfoTable.id, 1)).limit(1);
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(info ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to get business info");
    res.status(500).json({ error: "Failed to get business info" });
  }
});

/** PUT /admin/business-info — update business info (admin) */
router.put(
  "/admin/business-info",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const body = req.body ?? {};

    const allowed = [
      "businessName", "ownerName", "businessType", "gstNumber",
      "supportEmail", "supportPhone", "whatsappNumber", "alternatePhone",
      "addressLine1", "addressLine2", "city", "state", "pinCode", "country",
      "services", "facebook", "instagram", "youtube", "linkedin", "twitter", "website",
    ] as const;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    try {
      // Ensure singleton row exists (migration seeds it, this is a safety net)
      await db
        .insert(businessInfoTable)
        .values({
          id: 1,
          businessName: "CWP Detailers And Motors",
          ownerName: "Tushar Saraswat",
          businessType: "Proprietorship",
          supportEmail: "cwpdetailers@gmail.com",
          supportPhone: "+91-7054007733",
          addressLine1: "Seer Goverdhanpur, Behind BHU",
          city: "Varanasi",
          state: "Uttar Pradesh",
          pinCode: "221005",
          country: "India",
        })
        .onConflictDoNothing();

      const [updated] = await db
        .update(businessInfoTable)
        .set(patch)
        .where(eq(businessInfoTable.id, 1))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to update business info");
      res.status(500).json({ error: "Failed to update business info" });
    }
  },
);

// ─── Refund Policy Settings ───────────────────────────────────────────────────

/** GET /refund-settings — public refund settings */
router.get("/refund-settings", async (req: Request, res: Response) => {
  try {
    const [settings] = await db.select().from(refundPolicySettingsTable).where(eq(refundPolicySettingsTable.id, 1)).limit(1);
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(settings ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to get refund settings");
    res.status(500).json({ error: "Failed to get refund settings" });
  }
});

/** PUT /admin/refund-settings — update refund settings (admin) */
router.put(
  "/admin/refund-settings",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const body = req.body ?? {};

    const allowed = [
      "refundEligibleCases", "nonRefundableCases", "refundProcessingDays",
      "cancellationRules", "advancePaymentRules", "partialPaymentRules",
      "fullPaymentRules", "settlementInfo", "acceptedPaymentMethods",
    ] as const;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    try {
      await db.insert(refundPolicySettingsTable).values({
        id: 1,
        refundProcessingDays: "7-10 business days",
        cancellationRules: "Cancellations initiated by the customer are non-refundable.",
      }).onConflictDoNothing();

      const [updated] = await db
        .update(refundPolicySettingsTable)
        .set(patch)
        .where(eq(refundPolicySettingsTable.id, 1))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to update refund settings");
      res.status(500).json({ error: "Failed to update refund settings" });
    }
  },
);

// ─── OAuth Compliance Settings ────────────────────────────────────────────────

/** GET /oauth-compliance — public OAuth compliance info */
router.get("/oauth-compliance", async (req: Request, res: Response) => {
  try {
    const [settings] = await db.select().from(oauthComplianceSettingsTable).where(eq(oauthComplianceSettingsTable.id, 1)).limit(1);
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(settings ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to get OAuth compliance settings");
    res.status(500).json({ error: "Failed to get OAuth compliance settings" });
  }
});

/** PUT /admin/oauth-compliance — update OAuth compliance settings (admin) */
router.put(
  "/admin/oauth-compliance",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const body = req.body ?? {};

    const allowed = [
      "dataCollected", "dataUsageDescription", "dataRetentionDescription",
      "dataDeletionProcess", "privacyPolicyUrl", "termsUrl",
    ] as const;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    try {
      await db.insert(oauthComplianceSettingsTable).values({
        id: 1,
        dataCollected: "Name, Email address, Profile photo",
        dataUsageDescription: "We use your name, email and profile image solely to create and manage your account.",
        dataRetentionDescription: "We retain your personal data for as long as your account is active.",
        dataDeletionProcess: "Users can request data deletion by emailing cwpdetailers@gmail.com.",
        privacyPolicyUrl: "/privacy-policy",
        termsUrl: "/terms-and-conditions",
      }).onConflictDoNothing();

      const [updated] = await db
        .update(oauthComplianceSettingsTable)
        .set(patch)
        .where(eq(oauthComplianceSettingsTable.id, 1))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to update OAuth compliance settings");
      res.status(500).json({ error: "Failed to update OAuth compliance settings" });
    }
  },
);

// ─── SEO Settings ─────────────────────────────────────────────────────────────

/** GET /seo-settings — public SEO settings */
router.get("/seo-settings", async (req: Request, res: Response) => {
  try {
    const [settings] = await db.select().from(seoSettingsTable).where(eq(seoSettingsTable.id, 1)).limit(1);
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(settings ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to get SEO settings");
    res.status(500).json({ error: "Failed to get SEO settings" });
  }
});

/** PUT /admin/seo-settings — update SEO settings (admin) */
router.put(
  "/admin/seo-settings",
  requireAuth,
  requirePermission("settings", "edit"),
  async (req: Request, res: Response) => {
    const body = req.body ?? {};

    const allowed = [
      "siteTitle", "siteDescription", "metaKeywords", "canonicalDomain",
      "ogTitle", "ogDescription", "ogImage",
      "twitterCardType", "twitterTitle", "twitterDescription",
      "robotsIndex", "robotsFollow", "robotsAdditionalRules",
    ] as const;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    try {
      await db.insert(seoSettingsTable).values({
        id: 1,
        siteTitle: "CWP Detailers And Motors — Professional Car Detailing in Varanasi",
        siteDescription: "Professional car wash, vehicle detailing, ceramic coating, PPF, and solar panel cleaning services in Varanasi, UP.",
        canonicalDomain: "https://cwpdetailers.in",
      }).onConflictDoNothing();

      const [updated] = await db
        .update(seoSettingsTable)
        .set(patch)
        .where(eq(seoSettingsTable.id, 1))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to update SEO settings");
      res.status(500).json({ error: "Failed to update SEO settings" });
    }
  },
);

// ─── Sitemap XML ─────────────────────────────────────────────────────────────

/** GET /sitemap.xml — dynamic sitemap */
router.get("/sitemap.xml", async (req: Request, res: Response) => {
  try {
    const [seo] = await db.select().from(seoSettingsTable).where(eq(seoSettingsTable.id, 1)).limit(1);
    const domain = seo?.canonicalDomain ?? "https://cwpdetailers.in";

    const publishedPages = await db
      .select({ slug: legalPagesTable.slug, updatedAt: legalPagesTable.updatedAt })
      .from(legalPagesTable)
      .where(eq(legalPagesTable.status, "published"));

    type SitemapUrl = { loc: string; priority: string; changefreq: string; lastmod?: string };

    const staticUrls: SitemapUrl[] = [
      { loc: `${domain}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${domain}/register`, priority: "0.8", changefreq: "monthly" },
      { loc: `${domain}/login`, priority: "0.5", changefreq: "yearly" },
    ];

    const legalUrls: SitemapUrl[] = publishedPages.map(p => ({
      loc: `${domain}/${p.slug}`,
      priority: "0.6",
      changefreq: "monthly",
      lastmod: new Date(p.updatedAt).toISOString().split("T")[0],
    }));

    const allUrls: SitemapUrl[] = [...staticUrls, ...legalUrls];

    const urlEntries = allUrls
      .map(u =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    req.log.error({ err }, "Failed to generate sitemap");
    res.status(500).send("Failed to generate sitemap");
  }
});

/** GET /robots.txt — dynamic robots.txt */
router.get("/robots.txt", async (req: Request, res: Response) => {
  try {
    const [seo] = await db.select().from(seoSettingsTable).where(eq(seoSettingsTable.id, 1)).limit(1);
    const domain = seo?.canonicalDomain ?? "https://cwpdetailers.in";
    const indexAllow = seo?.robotsIndex !== false;
    const followAllow = seo?.robotsFollow !== false;

    let robotsTxt = `User-agent: *\n`;
    if (!indexAllow) {
      robotsTxt += `Disallow: /\n`;
    } else {
      robotsTxt += `Allow: /\n`;
      robotsTxt += `Disallow: /admin/\n`;
      robotsTxt += `Disallow: /api/\n`;
      robotsTxt += `Disallow: /customer/\n`;
      robotsTxt += `Disallow: /staff/\n`;
      robotsTxt += `Disallow: /franchisee/\n`;
    }

    if (seo?.robotsAdditionalRules) {
      robotsTxt += `\n${seo.robotsAdditionalRules}\n`;
    }

    robotsTxt += `\nSitemap: ${domain}/sitemap.xml\n`;

    res.set("Content-Type", "text/plain");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(robotsTxt);
  } catch (err) {
    req.log.error({ err }, "Failed to generate robots.txt");
    res.status(500).send("Failed to generate robots.txt");
  }
});

// ─── Schema.org JSON-LD ───────────────────────────────────────────────────────

/** GET /schema/local-business — LocalBusiness schema markup */
router.get("/schema/local-business", async (req: Request, res: Response) => {
  try {
    const [info] = await db.select().from(businessInfoTable).where(eq(businessInfoTable.id, 1)).limit(1);
    const [seo] = await db.select().from(seoSettingsTable).where(eq(seoSettingsTable.id, 1)).limit(1);

    const domain = seo?.canonicalDomain ?? "https://cwpdetailers.in";

    const schema = {
      "@context": "https://schema.org",
      "@type": ["LocalBusiness", "AutoBodyShop"],
      name: info?.businessName ?? "CWP Detailers And Motors",
      description: seo?.siteDescription ?? "Professional vehicle detailing and solar panel cleaning in Varanasi",
      url: domain,
      telephone: info?.supportPhone ?? "+91-7054007733",
      email: info?.supportEmail ?? "cwpdetailers@gmail.com",
      address: {
        "@type": "PostalAddress",
        streetAddress: [info?.addressLine1, info?.addressLine2].filter(Boolean).join(", "),
        addressLocality: info?.city ?? "Varanasi",
        addressRegion: info?.state ?? "Uttar Pradesh",
        postalCode: info?.pinCode ?? "221005",
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: "25.2677",
        longitude: "82.9913",
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          opens: "08:00",
          closes: "20:00",
        },
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Sunday"],
          opens: "09:00",
          closes: "18:00",
        },
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Detailing & Cleaning Services",
        itemListElement: (info?.services ?? []).map((s: string) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s },
        })),
      },
      sameAs: [
        info?.facebook,
        info?.instagram,
        info?.youtube,
        info?.linkedin,
        info?.twitter,
      ].filter(Boolean),
    };

    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(schema);
  } catch (err) {
    req.log.error({ err }, "Failed to generate schema");
    res.status(500).json({ error: "Failed to generate schema" });
  }
});

/** GET /schema/organization — Organization schema markup */
router.get("/schema/organization", async (req: Request, res: Response) => {
  try {
    const [info] = await db.select().from(businessInfoTable).where(eq(businessInfoTable.id, 1)).limit(1);
    const [seo] = await db.select().from(seoSettingsTable).where(eq(seoSettingsTable.id, 1)).limit(1);

    const domain = seo?.canonicalDomain ?? "https://cwpdetailers.in";

    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: info?.businessName ?? "CWP Detailers And Motors",
      url: domain,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: info?.supportPhone ?? "+91-7054007733",
        contactType: "customer support",
        availableLanguage: ["English", "Hindi"],
        areaServed: "IN",
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: info?.addressLine1 ?? "Seer Goverdhanpur, Behind BHU",
        addressLocality: info?.city ?? "Varanasi",
        addressRegion: info?.state ?? "Uttar Pradesh",
        postalCode: info?.pinCode ?? "221005",
        addressCountry: "IN",
      },
      sameAs: [
        info?.facebook,
        info?.instagram,
        info?.youtube,
        info?.linkedin,
        info?.twitter,
      ].filter(Boolean),
    };

    res.set("Cache-Control", PUBLIC_CACHE);
    res.json(schema);
  } catch (err) {
    req.log.error({ err }, "Failed to generate organization schema");
    res.status(500).json({ error: "Failed to generate schema" });
  }
});

export default router;
