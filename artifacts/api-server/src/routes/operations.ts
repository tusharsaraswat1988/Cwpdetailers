import { Router } from "express";
import { getOperationsTimeline } from "../lib/operations/operationsTimeline";
import { getServiceUpdatesSummary } from "../lib/executions/executionService";
import { getTodayIST } from "../subscriptions/service";

const router = Router();

router.get("/operations/timeline", async (req, res) => {
  try {
    const date = (req.query.date as string) || getTodayIST();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const timeline = await getOperationsTimeline(req, date);
    const summary = await getServiceUpdatesSummary(req, date);
    return res.json({ ...timeline, summary });
  } catch (err) {
    req.log.error({ err }, "Operations timeline error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
