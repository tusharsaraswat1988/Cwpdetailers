import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { loadRepoEnv } from "../../lib/env/load-env.mjs";
import { db, platformBrandingTable, eq } from "@workspace/db";
import { processLogoAssets } from "../../artifacts/api-server/src/lib/brandIdentityService";

loadRepoEnv(import.meta.url);

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || "cwp/varanasi";

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Cloudinary credentials missing in .env");
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const logoPath = path.join(root, "artifacts/cwp-platform/public/logo.png");

  if (!fs.existsSync(logoPath)) {
    console.error("Logo file not found:", logoPath);
    process.exit(1);
  }

  console.log("Uploading logo to Cloudinary...");
  const uploadResult = await cloudinary.uploader.upload(logoPath, {
    folder,
    resource_type: "image",
    overwrite: true,
  });

  console.log("Uploaded successfully:", uploadResult.secure_url);
  const secureUrl = uploadResult.secure_url;

  console.log("Generating derivative assets...");
  const derivatives = await processLogoAssets(secureUrl, { backgroundColor: "#0b132b" });

  const [active] = await db
    .select()
    .from(platformBrandingTable)
    .where(eq(platformBrandingTable.isActive, true))
    .limit(1);

  if (active) {
    const nextVersion = (active.version ?? 0) + 1;
    console.log(`Updating active branding row ${active.id} to version ${nextVersion}...`);

    await db
      .update(platformBrandingTable)
      .set({
        fullLogoUrl: secureUrl,
        navbarLogoUrl: secureUrl,
        mobileLogoUrl: secureUrl,
        loginLogoUrl: secureUrl,
        lightLogoUrl: secureUrl,
        darkLogoUrl: secureUrl,
        logoWhiteUrl: secureUrl,
        logoTransparentUrl: secureUrl,
        logoSquareUrl: secureUrl,
        logoIconUrl: secureUrl,
        pwaIconUrl: secureUrl,
        faviconUrl: derivatives.favicon32 ?? secureUrl,
        appleTouchIconUrl: derivatives.appleTouchIcon ?? secureUrl,
        emailLogoUrl: secureUrl,
        invoiceLogoUrl: secureUrl,
        pdfLogoUrl: secureUrl,
        splashLogoUrl: secureUrl,
        generatedAssets: derivatives,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(platformBrandingTable.id, active.id));

    console.log("Active branding row updated successfully in database!");
  } else {
    console.log("No active branding row found; creating one...");
    await db.insert(platformBrandingTable).values({
      companyName: "CWP Detailers + Kleansolar",
      brandName: "CWP Detailers",
      tagline: "Premium Car Care & Solar Cleaning",
      fullLogoUrl: secureUrl,
      navbarLogoUrl: secureUrl,
      mobileLogoUrl: secureUrl,
      loginLogoUrl: secureUrl,
      pwaIconUrl: secureUrl,
      generatedAssets: derivatives,
      isActive: true,
      version: 1,
    });
    console.log("Created active branding row!");
  }
}

main()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error updating brand logo:", err);
    process.exit(1);
  });
