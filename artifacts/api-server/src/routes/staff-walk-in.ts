import { Router } from "express";
import {
  searchWalkInTargets,
  getWalkInQuotaOptions,
  getWalkInCustomerContext,
  getWalkInDcmsStop,
  resolveWalkInJob,
  type WalkInServiceKind,
} from "../lib/staff/walkInService";
import {
  ServiceabilityValidationError,
  serviceabilityHttpBody,
  SERVICEABILITY_HTTP_STATUS,
} from "../lib/serviceability";

const router = Router();

function requireStaff(req: { user?: { staffId?: number; role?: string } }, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  if (req.user?.role !== "staff" || !req.user.staffId) {
    res.status(403).json({ error: "Staff account required" });
    return null;
  }
  return req.user.staffId;
}

router.get("/staff/walk-in/search", async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const data = await searchWalkInTargets(q);
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/staff/walk-in/customer/:customerId", async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const customerId = parseInt(req.params.customerId, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid customer id" });
    const vehicleId = req.query.vehicleId != null ? Number(req.query.vehicleId) : undefined;
    const context = await getWalkInCustomerContext(customerId, { vehicleId });
    if (!context) return res.status(404).json({ error: "Customer not found" });
    return res.json(context);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/staff/walk-in/customer/:customerId/quota", async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const customerId = parseInt(req.params.customerId, 10);
    const serviceKind = req.query.serviceKind as WalkInServiceKind;
    if (!serviceKind || !["car_wash", "solar_clean", "daily_clean", "daily_wash"].includes(serviceKind)) {
      return res.status(400).json({ error: "serviceKind required (car_wash, solar_clean, daily_clean, daily_wash)" });
    }
    const vehicleId = req.query.vehicleId != null ? Number(req.query.vehicleId) : undefined;
    const solarSiteId = req.query.solarSiteId != null ? Number(req.query.solarSiteId) : undefined;
    const options = await getWalkInQuotaOptions(customerId, serviceKind, { vehicleId, solarSiteId });
    return res.json({ options });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/staff/walk-in/dcms-stop/:subscriptionId", async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const subscriptionId = parseInt(req.params.subscriptionId, 10);
    const visitType = req.query.visitType === "wash" ? "wash" : "cleaning";
    if (!Number.isFinite(subscriptionId)) return res.status(400).json({ error: "Invalid subscription id" });
    const stop = await getWalkInDcmsStop(subscriptionId, visitType);
    if (!stop) return res.status(404).json({ error: "Subscription not found" });
    return res.json(stop);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.post("/staff/walk-in/resolve", async (req, res) => {
  try {
    const staffId = requireStaff(req, res);
    if (!staffId) return;
    const {
      customerId,
      serviceKind,
      vehicleId,
      solarSiteId,
      entitlementId,
      subscriptionId,
      legacySubscriptionId,
      latitude,
      longitude,
      accuracy,
      forceDraft,
    } = req.body ?? {};

    if (!customerId || !serviceKind) {
      return res.status(400).json({ error: "customerId and serviceKind are required" });
    }

    const result = await resolveWalkInJob(req, {
      customerId: Number(customerId),
      staffId,
      serviceKind: serviceKind as WalkInServiceKind,
      vehicleId: vehicleId != null ? Number(vehicleId) : undefined,
      solarSiteId: solarSiteId != null ? Number(solarSiteId) : undefined,
      entitlementId: entitlementId != null ? Number(entitlementId) : undefined,
      subscriptionId: subscriptionId != null ? Number(subscriptionId) : undefined,
      legacySubscriptionId: legacySubscriptionId != null ? Number(legacySubscriptionId) : undefined,
      latitude: latitude != null ? Number(latitude) : undefined,
      longitude: longitude != null ? Number(longitude) : undefined,
      accuracy: accuracy != null ? Number(accuracy) : undefined,
      forceDraft: forceDraft === true,
    });

    return res.json(result);
  } catch (e) {
    if (e instanceof ServiceabilityValidationError) {
      return res.status(SERVICEABILITY_HTTP_STATUS).json(serviceabilityHttpBody(e.result));
    }
    return res.status(400).json({ error: (e as Error).message });
  }
});

export default router;
