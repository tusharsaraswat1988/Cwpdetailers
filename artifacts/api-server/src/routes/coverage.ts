import { Router } from "express";
import {
  buildCoverageRequest,
  coverageEngine,
  toCoverageCheckResponse,
} from "../lib/coverage";
import { resolveRequestId } from "../lib/coverage/CoverageCorrelation";

const router = Router();

async function handleCoverageCheck(req: import("express").Request, res: import("express").Response) {
  try {
    const body = req.body as Record<string, unknown>;
    const request = buildCoverageRequest(body);
    const requestId = resolveRequestId(req.headers["x-request-id"] ?? req.id);

    const result = await coverageEngine.check(
      request,
      {
        requestSource: "coverage_check_api",
        requestId,
        serviceId: request.serviceId ?? undefined,
      },
      req.log,
    );

    return res.status(200).json(toCoverageCheckResponse(result));
  } catch (err) {
    req.log.error({ err }, "Coverage check error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/** Public coverage check — no auth required (optionalAuth at app level). */
router.post("/coverage/check", handleCoverageCheck);

/** Backward-compatible alias. */
router.post("/serviceability/check", handleCoverageCheck);

export default router;
