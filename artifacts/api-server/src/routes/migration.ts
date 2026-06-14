import { Router, type Request } from "express";
import express from "express";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { previewWorkbook, importCustomers } from "../lib/migration/legacyImportEngine";

const router = Router();

const rawExcel = express.raw({
  limit: "15mb",
  type: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ],
});

function workbookBuffer(req: Request): Buffer | null {
  const body = req.body;
  if (!body || !Buffer.isBuffer(body) || body.length === 0) return null;
  return body;
}

function importOptsFromRequest(req: Request, filename?: string) {
  const scope = req.scope;
  return {
    filename: filename ?? null,
    createdByUserId: req.user?.id ?? null,
    companyId: scope?.companyId ?? null,
    franchiseeId: scope?.franchiseeId ?? null,
    defaultBranchId: scope?.branchIds?.[0] ?? null,
  };
}

function resolveSampleWorkbookPath(): string | null {
  const names = ["legacy-migration-sample.xlsx"];
  const roots = [
    path.join(process.cwd(), "fixtures"),
    path.join(process.cwd(), "..", "..", "fixtures"),
    path.join(process.cwd(), "..", "fixtures"),
  ];
  for (const root of roots) {
    for (const name of names) {
      const full = path.join(root, name);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

router.get("/migration/customers/sample", async (req, res) => {
  try {
    const samplePath = resolveSampleWorkbookPath();
    if (!samplePath) return res.status(404).json({ error: "Sample template not found on server" });
    const buffer = readFileSync(samplePath);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="customer-import-template.xlsx"');
    return res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Migration sample download error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/migration/customers/preview", rawExcel, async (req, res) => {
  try {
    const buffer = workbookBuffer(req);
    if (!buffer) return res.status(400).json({ error: "Upload an Excel (.xlsx) file in the request body" });

    const preview = await previewWorkbook(buffer);
    return res.json(preview);
  } catch (err) {
    req.log.error({ err }, "Migration preview error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/migration/customers/import", rawExcel, async (req, res) => {
  try {
    const buffer = workbookBuffer(req);
    if (!buffer) return res.status(400).json({ error: "Upload an Excel (.xlsx) file in the request body" });

    const dryRun = req.query.dryRun === "true";
    const filename = typeof req.headers["x-filename"] === "string" ? req.headers["x-filename"] : undefined;

    const result = await importCustomers(buffer, {
      ...importOptsFromRequest(req, filename),
      dryRun,
    });

    return res.json({ dryRun, ...result });
  } catch (err) {
    req.log.error({ err }, "Migration import error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
