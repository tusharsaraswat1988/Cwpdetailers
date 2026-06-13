import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth";
import {
  assignBrandingAsset,
  buildPwaManifest,
  getBrandingForAdmin,
  getPublicBranding,
  processLogoAssets,
  sanitizeSvgContent,
  updateBranding,
  validateUpload,
  type BrandAssetSlot,
} from "../lib/brandIdentityService";

const router: IRouter = Router();

const PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=300";

/** GET /branding/public — cached public branding for all portals */
router.get("/branding/public", async (req: Request, res: Response) => {
  try {
    const branding = await getPublicBranding();
    res.set("Cache-Control", PUBLIC_CACHE);
    res.set("ETag", `"branding-v${branding.version}"`);
    res.json(branding);
  } catch (err) {
    req.log.error({ err }, "Failed to load public branding");
    res.status(500).json({ error: "Failed to load branding" });
  }
});

/** GET /branding/public/manifest/:portal — dynamic PWA manifest */
router.get("/branding/public/manifest/:portal", async (req: Request, res: Response) => {
  const portal = req.params.portal as "admin" | "customer" | "staff" | "franchisee";
  if (!["admin", "customer", "staff", "franchisee"].includes(portal)) {
    res.status(400).json({ error: "Invalid portal" });
    return;
  }
  try {
    const branding = await getPublicBranding();
    const manifest = buildPwaManifest(branding, portal);
    res.set("Cache-Control", PUBLIC_CACHE);
    res.set("Content-Type", "application/manifest+json");
    res.json(manifest);
  } catch (err) {
    req.log.error({ err }, "Failed to build PWA manifest");
    res.status(500).json({ error: "Failed to build manifest" });
  }
});

/** GET /branding — admin view (full record) */
router.get("/branding", requireAuth, requirePermission("settings", "view"), async (req: Request, res: Response) => {
  try {
    const row = await getBrandingForAdmin();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to load branding");
    res.status(500).json({ error: "Failed to load branding" });
  }
});

/** PUT /branding — update company info, colors, SEO */
router.put("/branding", requireAuth, requirePermission("settings", "edit"), async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const allowed = [
      "companyName", "brandName", "tagline", "website", "supportEmail", "supportPhone",
      "gstNumber", "address", "primaryColor", "secondaryColor", "accentColor", "backgroundColor",
      "metaTitleTemplate", "metaDescriptionTemplate", "ogTitle", "ogDescription",
      "twitterCardType", "twitterTitle", "twitterDescription", "socialLinks", "schemaOrg",
      "fullLogoUrl", "navbarLogoUrl", "mobileLogoUrl", "lightLogoUrl", "darkLogoUrl",
      "loginLogoUrl", "faviconUrl", "pwaIconUrl", "appleTouchIconUrl",
      "emailLogoUrl", "invoiceLogoUrl", "pdfLogoUrl", "ogImageUrl",
    ] as const;

    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    const updated = await updateBranding(patch);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update branding");
    res.status(500).json({ error: "Failed to update branding" });
  }
});

const VALID_SLOTS = new Set<BrandAssetSlot>([
  "full_logo", "navbar_logo", "mobile_logo", "favicon", "pwa_icon",
  "apple_touch_icon", "email_logo", "invoice_logo", "pdf_logo", "og_image",
  "login_logo", "light_logo", "dark_logo",
]);

/**
 * POST /branding/upload
 * Body: { url: string, slot: BrandAssetSlot, contentType?, size?, svgContent?, regenerateDerivatives? }
 *
 * Client uploads to Cloudinary first, then posts the secure_url here for processing.
 */
router.post("/branding/upload", requireAuth, requirePermission("settings", "edit"), async (req: Request, res: Response) => {
  try {
    const { url, slot, contentType, size, svgContent, regenerateDerivatives } = req.body ?? {};

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url is required" });
      return;
    }
    if (!slot || !VALID_SLOTS.has(slot)) {
      res.status(400).json({ error: "Invalid or missing slot" });
      return;
    }

    if (contentType && size) {
      validateUpload({ contentType, size, name: slot });
    }

    if (contentType === "image/svg+xml" && svgContent && typeof svgContent === "string") {
      sanitizeSvgContent(svgContent);
    }

    const updated = await assignBrandingAsset(slot as BrandAssetSlot, url, {
      regenerateDerivatives: regenerateDerivatives ?? slot === "full_logo",
    });

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    req.log.error({ err }, "Branding upload failed");
    res.status(400).json({ error: message });
  }
});

/** POST /branding/process — regenerate derivatives from existing full logo */
router.post("/branding/process", requireAuth, requirePermission("settings", "edit"), async (req: Request, res: Response) => {
  try {
    const row = await getBrandingForAdmin();
    const source = row.fullLogoUrl ?? row.pwaIconUrl;
    if (!source) {
      res.status(400).json({ error: "No source logo to process" });
      return;
    }
    const generated = await processLogoAssets(source);
    const updated = await updateBranding({ generatedAssets: generated });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Branding process failed");
    res.status(500).json({ error: "Failed to process branding assets" });
  }
});

export default router;
