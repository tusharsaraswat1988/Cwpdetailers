import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  approveExtraServiceRequest,
  createExtraServiceRequest,
  getStaffExtraServiceContext,
  listCustomerExtraServiceInbox,
  listStaffExtraServiceRequests,
  rejectExtraServiceRequest,
  verifyExtraServiceOtp,
} from "../lib/extra-service/extraServiceService";
import type { ExtraServiceCommercialSource } from "@workspace/db";

const router = Router();

function requireStaff(req: { user?: { staffId?: number | null; role?: string } }, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  if (req.user?.role !== "staff" || req.user.staffId == null) {
    res.status(403).json({ error: "Staff account required" });
    return null;
  }
  return req.user.staffId;
}

function requireCustomer(req: { user?: { customerId?: number | null; role?: string } }, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  if (req.user?.role !== "customer" || req.user.customerId == null) {
    res.status(403).json({ error: "Customer account required" });
    return null;
  }
  return req.user.customerId;
}

function handleError(res: { status: (n: number) => { json: (b: unknown) => unknown } }, err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  const status =
    /not found/i.test(msg) ? 404
      : /required|select|waiting|expired|incorrect|too many|already|not active|not valid|must be/i.test(msg) ? 400
        : 500;
  return res.status(status).json({ error: msg });
}

router.get("/staff/extra-service/context", requireAuth, async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const customerId = req.query.customerId != null ? Number(req.query.customerId) : undefined;
    const subscriptionId = req.query.subscriptionId != null ? Number(req.query.subscriptionId) : undefined;
    const vehicleId = req.query.vehicleId != null ? Number(req.query.vehicleId) : undefined;
    const data = await getStaffExtraServiceContext(staffId, { customerId, subscriptionId, vehicleId });
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "extra-service context");
    return handleError(res, err);
  }
});

router.get("/staff/extra-service/requests", requireAuth, async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const customerId = req.query.customerId != null ? Number(req.query.customerId) : undefined;
    const requests = await listStaffExtraServiceRequests(staffId, customerId);
    return res.json({ requests });
  } catch (err) {
    req.log.error({ err }, "extra-service staff list");
    return handleError(res, err);
  }
});

router.post("/staff/extra-service/requests", requireAuth, async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const body = req.body as {
      customerId?: number;
      vehicleId?: number;
      serviceId?: number;
      addonIds?: number[];
      commercialSource?: ExtraServiceCommercialSource;
      dcmsSubscriptionId?: number | null;
    };
    if (!body.customerId || !body.vehicleId || !body.serviceId || !body.commercialSource) {
      return res.status(400).json({ error: "Customer, vehicle, service, and payment source are required" });
    }
    const request = await createExtraServiceRequest(req, staffId, {
      customerId: body.customerId,
      vehicleId: body.vehicleId,
      serviceId: body.serviceId,
      addonIds: body.addonIds,
      commercialSource: body.commercialSource,
      dcmsSubscriptionId: body.dcmsSubscriptionId,
    });
    return res.status(201).json({ request });
  } catch (err) {
    req.log.error({ err }, "extra-service create");
    return handleError(res, err);
  }
});

router.post("/staff/extra-service/requests/:id/verify-otp", requireAuth, async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid request" });
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const request = await verifyExtraServiceOtp(req, staffId, id, code);
    return res.json({ request });
  } catch (err) {
    req.log.error({ err }, "extra-service verify otp");
    return handleError(res, err);
  }
});

router.get("/customer/extra-service/pending", requireAuth, async (req, res) => {
  try {
    const customerId = requireCustomer(req, res);
    if (!customerId) return;
    const requests = await listCustomerExtraServiceInbox(customerId);
    return res.json({ requests });
  } catch (err) {
    req.log.error({ err }, "extra-service customer inbox");
    return handleError(res, err);
  }
});

router.post("/customer/extra-service/requests/:id/approve", requireAuth, async (req, res) => {
  try {
    const customerId = requireCustomer(req, res);
    if (!customerId) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid request" });
    const request = await approveExtraServiceRequest(customerId, id);
    return res.json({ request });
  } catch (err) {
    req.log.error({ err }, "extra-service approve");
    return handleError(res, err);
  }
});

router.post("/customer/extra-service/requests/:id/reject", requireAuth, async (req, res) => {
  try {
    const customerId = requireCustomer(req, res);
    if (!customerId) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid request" });
    const request = await rejectExtraServiceRequest(customerId, id);
    return res.json({ request });
  } catch (err) {
    req.log.error({ err }, "extra-service reject");
    return handleError(res, err);
  }
});

export default router;
