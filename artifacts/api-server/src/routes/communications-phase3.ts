import { Router } from "express";
import { tenantStamp } from "../middlewares/tenantScope";
import { logCommAudit } from "../lib/communications/audit";
import { listInbox, getInboxCounts } from "../lib/communications/inboxService";
import {
  getConversationWithMessages, replyToConversation, closeConversation,
  addInternalNote,
} from "../lib/communications/conversationService";
import { assignConversation, listTeams } from "../lib/communications/assignmentEngine";
import { getSlaDashboard, refreshSlaStatuses } from "../lib/communications/slaEngine";
import { getCustomerJourney, syncJourneyFromPlatformEvents } from "../lib/communications/journeyService";
import { getAiAssistance, refreshAiAssistance } from "../lib/communications/aiAssistanceService";
import { addManualTag, removeTag } from "../lib/communications/taggingService";
import { createTrackedLink, getLinkStats } from "../lib/communications/linkTrackingService";
import { getProfitabilityReport, recordChannelCosts } from "../lib/communications/profitabilityService";
import { getTeamPerformance, getCsatDashboard, computeAgentMetrics } from "../lib/communications/teamPerformanceService";
import { submitCsat, requestCsatSurvey } from "../lib/communications/csatService";
import { listKnowledgeBase, createKbArticle } from "../lib/communications/knowledgeBaseService";
import type { InboxFilter } from "../lib/communications/conversationService";

const router = Router();

// ─── Inbox ────────────────────────────────────────────────────────────────────

router.get("/communications/inbox", async (req, res) => {
  try {
    const filter = (req.query.filter as InboxFilter) ?? "all";
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    const data = await listInbox({
      filter,
      userId: req.user?.id,
      companyId: req.scope?.companyId,
      brandId,
      cursor,
    });
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Inbox list error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/inbox/counts", async (req, res) => {
  try {
    const data = await getInboxCounts(req.scope?.companyId, req.user?.id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Conversations ────────────────────────────────────────────────────────────

router.get("/communications/conversations/:id", async (req, res) => {
  try {
    const data = await getConversationWithMessages(parseInt(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/conversations/:id/reply", async (req, res) => {
  try {
    const { message, channel } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });
    const data = await replyToConversation(
      parseInt(req.params.id),
      req.user!.id,
      message,
      channel,
    );
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/communications/conversations/:id/assign", async (req, res) => {
  try {
    const { userId, teamId } = req.body;
    const data = await assignConversation({
      conversationId: parseInt(req.params.id),
      userId,
      teamId,
      assignedBy: req.user?.id,
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/conversations/:id/close", async (req, res) => {
  try {
    const data = await closeConversation(parseInt(req.params.id), req.user?.id);
    const survey = await requestCsatSurvey(parseInt(req.params.id));
    return res.json({ conversation: data, csatSurvey: survey });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/conversations/:id/notes", async (req, res) => {
  try {
    const { body, mentions } = req.body;
    if (!body) return res.status(400).json({ error: "body required" });
    const note = await addInternalNote(parseInt(req.params.id), req.user!.id, body, mentions ?? []);
    return res.status(201).json(note);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/conversations/:id/tags", async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ error: "tag required" });
    const row = await addManualTag(parseInt(req.params.id), tag, req.scope?.companyId);
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/communications/conversations/:id/tags/:tag", async (req, res) => {
  try {
    await removeTag(parseInt(req.params.id), req.params.tag);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── AI Suggestions ───────────────────────────────────────────────────────────

router.get("/communications/conversations/:id/ai", async (req, res) => {
  try {
    const conv = await getConversationWithMessages(parseInt(req.params.id), 20);
    if (conv?.messages?.length) {
      await refreshAiAssistance(parseInt(req.params.id), conv.messages.map(m => m.message));
    }
    const data = await getAiAssistance(parseInt(req.params.id));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Customer Journey ─────────────────────────────────────────────────────────

router.get("/communications/journey/customer/:customerId", async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    if (req.query.sync === "true") {
      await syncJourneyFromPlatformEvents(customerId, req.scope?.companyId);
    }
    const data = await getCustomerJourney(customerId, { brandId, cursor });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── SLA ──────────────────────────────────────────────────────────────────────

router.get("/communications/sla/dashboard", async (req, res) => {
  try {
    await refreshSlaStatuses(req.scope?.companyId);
    const data = await getSlaDashboard(req.scope?.companyId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Teams ────────────────────────────────────────────────────────────────────

router.get("/communications/teams", async (req, res) => {
  try {
    const data = await listTeams(req.scope?.companyId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Link Tracking ────────────────────────────────────────────────────────────

router.post("/communications/links/track", async (req, res) => {
  try {
    const { originalUrl, campaignId, customerId, brandId } = req.body;
    if (!originalUrl) return res.status(400).json({ error: "originalUrl required" });
    const data = await createTrackedLink({
      originalUrl, campaignId, customerId, brandId,
      companyId: req.scope?.companyId,
    });
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/links/stats/:campaignId", async (req, res) => {
  try {
    const data = await getLinkStats(parseInt(req.params.campaignId));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Profitability ────────────────────────────────────────────────────────────

router.get("/communications/profitability", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
    const data = await getProfitabilityReport({
      companyId: req.scope?.companyId,
      brandId,
      campaignId,
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/campaigns/:id/profitability", async (req, res) => {
  try {
    const data = await recordChannelCosts(parseInt(req.params.id));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Team Performance ─────────────────────────────────────────────────────────

router.get("/communications/performance/team", async (req, res) => {
  try {
    const periodDate = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
    const data = await getTeamPerformance(req.scope?.companyId, periodDate);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/performance/compute", async (req, res) => {
  try {
    const { userId, periodDate } = req.body;
    const data = await computeAgentMetrics(userId ?? req.user!.id, periodDate ?? new Date().toISOString().slice(0, 10), req.scope?.companyId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── CSAT ─────────────────────────────────────────────────────────────────────

router.get("/communications/csat/dashboard", async (req, res) => {
  try {
    const data = await getCsatDashboard(req.scope?.companyId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/csat/:conversationId", async (req, res) => {
  try {
    const { rating, feedback, customerId } = req.body;
    const data = await submitCsat({
      conversationId: parseInt(req.params.conversationId),
      rating,
      feedback,
      customerId,
    });
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ─── Knowledge Base ───────────────────────────────────────────────────────────

router.get("/communications/knowledge-base", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const category = req.query.category as string | undefined;
    const data = await listKnowledgeBase({ companyId: req.scope?.companyId, brandId, category });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/knowledge-base", async (req, res) => {
  try {
    const payload = tenantStamp(req, req.body);
    const data = await createKbArticle(payload);
    await logCommAudit({ action: "kb.create", resource: "knowledge_base", resourceId: data.id, userId: req.user?.id, companyId: data.companyId });
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── CRM Analytics ────────────────────────────────────────────────────────────

router.get("/communications/crm/analytics", async (req, res) => {
  try {
    const [inbox, sla, csat] = await Promise.all([
      getInboxCounts(req.scope?.companyId, req.user?.id),
      getSlaDashboard(req.scope?.companyId),
      getCsatDashboard(req.scope?.companyId),
    ]);
    return res.json({ inbox, sla, csat });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
