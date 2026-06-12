import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody } from "@workspace/api-zod";
import { createCloudinaryUploadSignature, StorageConfigError } from "../lib/cloudinaryStorage";

const router: IRouter = Router();

/**
 * POST /storage/uploads/request-url
 *
 * Returns Cloudinary signed upload parameters. The client uploads directly to
 * Cloudinary (no local/Replit storage). Persist the secure_url returned by
 * Cloudinary on the relevant asset/booking record.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const payload = createCloudinaryUploadSignature(parsed.data);
    res.json({
      uploadURL: payload.uploadURL,
      objectPath: payload.objectPath,
      metadata: payload.metadata,
      cloudinary: payload.cloudinary,
    });
  } catch (error) {
    if (error instanceof StorageConfigError) {
      req.log.error({ err: error }, "Cloudinary not configured");
      res.status(503).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Error generating Cloudinary upload signature");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * Legacy proxy routes removed — media is served from Cloudinary URLs stored on records.
 */
router.get("/storage/public-objects/*filePath", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "Local object storage is disabled. Media is hosted on Cloudinary.",
  });
});

router.get("/storage/objects/*path", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "Local object storage is disabled. Use the https URL stored on the booking record.",
  });
});

export default router;
