import { Router } from "express";
import {
  bookingCapability,
  addressSelectionService,
  serviceDiscoveryService,
  resolveBookingTraceId,
  BookingValidationError,
  BookingCoverageError,
} from "../lib/booking";
import {
  serviceabilityHttpBody,
  SERVICEABILITY_HTTP_STATUS,
} from "../lib/serviceability";

const router = Router();

/** GET /booking-platform/address-selection/:customerId — saved + current addresses */
router.get("/booking-platform/address-selection/:customerId", async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    if (!Number.isFinite(customerId)) {
      return res.status(400).json({ error: "Invalid customerId" });
    }
    const result = await addressSelectionService.getSelectionOptions(customerId, req.log);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Address selection error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /booking-platform/address-selection/validate — validate address + discover services */
router.post("/booking-platform/address-selection/validate", async (req, res) => {
  try {
    const { customerId, addressId, address, locationLat, locationLng, placeId, serviceId, cityId } = req.body;
    if (!customerId) return res.status(400).json({ error: "customerId is required" });

    const result = await addressSelectionService.validateSelection(
      { customerId, addressId, address, locationLat, locationLng, placeId, serviceId, cityId },
      req.log,
    );

    if (!result.valid && result.coverage) {
      return res.status(SERVICEABILITY_HTTP_STATUS).json({
        ...serviceabilityHttpBody(result.coverage),
        addressOption: result.addressOption,
        services: result.services,
      });
    }

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Address selection validate error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /booking-platform/services/discover — dynamic service discovery at location */
router.post("/booking-platform/services/discover", async (req, res) => {
  try {
    const result = await serviceDiscoveryService.discover(req.body, req.log);
    return res.json({
      valid: result.valid,
      traceId: result.traceId,
      validationId: result.validationId,
      coverageStatus: result.coverage.coverageStatus,
      services: result.services,
    });
  } catch (err) {
    req.log.error({ err }, "Service discovery error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /booking-platform/bookings/:id/context — full BookingContext */
router.get("/booking-platform/bookings/:id/context", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const traceId = resolveBookingTraceId(req.headers["x-trace-id"] ?? req.headers["x-request-id"]);
    const ctx = await bookingCapability.getBookingContext(id, {
      traceId,
      requestId: String(req.id ?? req.headers["x-request-id"] ?? traceId),
      logger: req.log,
    });
    if (!ctx) return res.status(404).json({ error: "Booking not found" });
    return res.json(ctx);
  } catch (err) {
    req.log.error({ err }, "Get booking context error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /booking-platform/bookings/:id/timeline — immutable booking timeline */
router.get("/booking-platform/bookings/:id/timeline", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const timeline = await bookingCapability.getTimeline(id);
    return res.json({ bookingId: id, timeline });
  } catch (err) {
    req.log.error({ err }, "Get booking timeline error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /booking-platform/bookings/:id/snapshots — booking snapshots */
router.get("/booking-platform/bookings/:id/snapshots", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const snapshots = await bookingCapability.getSnapshots(id);
    return res.json({ bookingId: id, snapshots });
  } catch (err) {
    req.log.error({ err }, "Get booking snapshots error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /booking-platform/bookings/search — booking search provider */
router.post("/booking-platform/bookings/search", async (req, res) => {
  try {
    const result = await bookingCapability.search(req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Booking search error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
