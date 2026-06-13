import { Router } from "express";
import {
  processWhatsAppInbound, processSmsInbound, processEmailInbound,
  verifyWhatsAppWebhook,
} from "../lib/communications/inboundWebhookService";
import { resolveTrackedLink } from "../lib/communications/linkTrackingService";

const router = Router();

/** Meta WhatsApp webhook verification + inbound */
router.get("/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;
  const result = verifyWhatsAppWebhook(mode, token, challenge);
  if (result) return res.status(200).send(result);
  return res.status(403).send("Forbidden");
});

router.post("/webhooks/whatsapp", async (req, res) => {
  try {
    const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
    const results = await processWhatsAppInbound(req.body, companyId);
    return res.json({ ok: true, processed: results.length, results });
  } catch (err) {
    req.log?.error({ err }, "WhatsApp webhook error");
    return res.status(200).json({ ok: true });
  }
});

/** SMS inbound webhook (Fast2SMS/MSG91 callback) */
router.post("/webhooks/sms", async (req, res) => {
  try {
    const { phone, message, messageId } = req.body;
    if (!phone || !message) return res.status(400).json({ error: "phone and message required" });
    const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
    const saved = await processSmsInbound({ phone, message, providerMessageId: messageId, companyId });
    return res.json({ ok: true, messageId: saved.id });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** Email inbound webhook (Resend/SMTP relay) */
router.post("/webhooks/email", async (req, res) => {
  try {
    const { from, to, subject, body, threadId, inReplyTo, customerId } = req.body;
    if (!from || !body) return res.status(400).json({ error: "from and body required" });
    const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
    const saved = await processEmailInbound({
      from, to: to ?? "", subject: subject ?? "Re:",
      body, threadId, inReplyTo, companyId, customerId,
    });
    return res.json({ ok: true, messageId: saved.id });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** Campaign link redirect /r/{trackingId} */
router.get("/r/:trackingId", async (req, res) => {
  try {
    const url = await resolveTrackedLink(req.params.trackingId);
    if (!url) return res.status(404).send("Link not found");
    return res.redirect(302, url);
  } catch (err) {
    return res.status(500).send("Error");
  }
});

export default router;
