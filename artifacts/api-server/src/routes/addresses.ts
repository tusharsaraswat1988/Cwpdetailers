import { Router } from "express";
import { addressCapability } from "../lib/address/capability/AddressCapability";
import { AddressDuplicateError, AddressValidationError } from "../lib/address/AddressService";
import { addressSnapshotService } from "../lib/address/AddressSnapshotService";
import { legacyAddressMigrator } from "../lib/address/migration/LegacyAddressMigrator";
import { resolveAddressTraceId } from "../lib/address/correlation/AddressTraceContext";
import type { AddressType, AddressSource, AddressVerificationStatus } from "@workspace/db";

const router = Router();

function parseCustomerId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function assertCustomerAccess(req: import("express").Request, customerId: number) {
  if (req.user?.role === "customer" && req.scope?.customerId && req.scope.customerId !== customerId) {
    return false;
  }
  return true;
}

function capabilityOpts(req: import("express").Request) {
  return {
    traceId: resolveAddressTraceId(req.headers["x-request-id"] ?? req.id),
    requestId: resolveAddressTraceId(req.headers["x-request-id"] ?? req.id),
    logger: req.log,
  };
}

function bodyToCreateInput(body: Record<string, unknown>, customerId: number) {
  return {
    customerId,
    nickname: body.nickname as string | undefined,
    addressType: body.addressType as AddressType | undefined,
    houseNumber: body.houseNumber as string | undefined,
    buildingName: body.buildingName as string | undefined,
    floor: body.floor as string | undefined,
    apartment: body.apartment as string | undefined,
    street: body.street as string | undefined,
    landmark: body.landmark as string | undefined,
    area: body.area as string | undefined,
    locality: body.locality as string | undefined,
    subLocality: body.subLocality as string | undefined,
    cityId: body.cityId != null ? Number(body.cityId) : undefined,
    district: body.district as string | undefined,
    stateId: body.stateId != null ? Number(body.stateId) : undefined,
    country: body.country as string | undefined,
    postalCode: body.postalCode as string | undefined,
    latitude: body.latitude != null ? Number(body.latitude) : body.locationLat != null ? Number(body.locationLat) : undefined,
    longitude: body.longitude != null ? Number(body.longitude) : body.locationLng != null ? Number(body.locationLng) : undefined,
    placeId: body.placeId as string | undefined,
    formattedAddress: (body.formattedAddress as string | undefined) ?? (body.address as string | undefined),
    plusCode: body.plusCode as string | undefined,
    addressComponents: body.addressComponents as never,
    instructions: body.instructions as string | undefined,
    isDefault: body.isDefault as boolean | undefined,
    verificationStatus: body.verificationStatus as AddressVerificationStatus | undefined,
    source: body.source as AddressSource | undefined,
    allowDuplicate: body.allowDuplicate as boolean | undefined,
    validateCoverage: body.validateCoverage as boolean | undefined,
    serviceId: body.serviceId != null ? Number(body.serviceId) : undefined,
  };
}

router.post("/addresses", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const customerId = parseCustomerId(body.customerId);
    if (!customerId) return res.status(400).json({ error: "customerId is required" });
    if (!assertCustomerAccess(req, customerId)) return res.status(403).json({ error: "Forbidden" });

    const result = await addressCapability.createAddress(bodyToCreateInput(body, customerId), capabilityOpts(req));
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof AddressDuplicateError) {
      return res.status(409).json({ error: err.message, duplicates: err.duplicates });
    }
    if (err instanceof AddressValidationError) {
      return res.status(422).json({ error: err.message });
    }
    req.log.error({ err }, "Create address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/addresses", async (req, res) => {
  try {
    const customerId = parseCustomerId(req.query.customerId);
    if (!customerId) return res.status(400).json({ error: "customerId is required" });
    if (!assertCustomerAccess(req, customerId)) return res.status(403).json({ error: "Forbidden" });

    const data = await addressCapability.listAddresses(customerId, {
      ...capabilityOpts(req),
      includeDeleted: req.query.includeDeleted === "true",
      includeArchived: req.query.includeArchived === "true",
    });
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List addresses error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/addresses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await addressCapability.getAddress(id, capabilityOpts(req));
    if (!result) return res.status(404).json({ error: "Not found" });
    if (!assertCustomerAccess(req, result.customerId)) return res.status(403).json({ error: "Forbidden" });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Get address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/addresses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await addressCapability.getAddress(id, capabilityOpts(req));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!assertCustomerAccess(req, existing.customerId)) return res.status(403).json({ error: "Forbidden" });

    const body = req.body as Record<string, unknown>;
    const result = await addressCapability.updateAddress(id, {
      ...bodyToCreateInput(body, existing.customerId),
      changeReason: body.changeReason as string | undefined,
    }, capabilityOpts(req));
    return res.json(result);
  } catch (err) {
    if (err instanceof AddressValidationError) {
      return res.status(422).json({ error: err.message });
    }
    req.log.error({ err }, "Update address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/addresses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await addressCapability.getAddress(id, capabilityOpts(req));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!assertCustomerAccess(req, existing.customerId)) return res.status(403).json({ error: "Forbidden" });
    await addressCapability.deleteAddress(id, capabilityOpts(req));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/:id/restore", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await addressCapability.getAddress(id, capabilityOpts(req));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!assertCustomerAccess(req, existing.customerId)) return res.status(403).json({ error: "Forbidden" });
    const address = await addressCapability.restoreAddress(id, capabilityOpts(req));
    return res.json(address);
  } catch (err) {
    req.log.error({ err }, "Restore address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/:id/default", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await addressCapability.getAddress(id, capabilityOpts(req));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!assertCustomerAccess(req, existing.customerId)) return res.status(403).json({ error: "Forbidden" });
    const result = await addressCapability.setDefaultAddress(id, capabilityOpts(req));
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Set default address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/validate", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const customerId = parseCustomerId(body.customerId) ?? 0;
    const result = await addressCapability.validateAddress(bodyToCreateInput(body, customerId), capabilityOpts(req));
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Validate address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/normalize", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const customerId = parseCustomerId(body.customerId) ?? 0;
    const preview = addressCapability.normalizeAddress(bodyToCreateInput(body, customerId), capabilityOpts(req));
    return res.json(preview);
  } catch (err) {
    req.log.error({ err }, "Normalize address error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/preview-parse", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const customerId = parseCustomerId(body.customerId) ?? 0;
    const preview = addressCapability.previewParsedAddress(bodyToCreateInput(body, customerId));
    return res.json(preview);
  } catch (err) {
    req.log.error({ err }, "Preview parse error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/check-duplicates", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const customerId = parseCustomerId(body.customerId);
    if (!customerId) return res.status(400).json({ error: "customerId is required" });
    const result = await addressCapability.checkDuplicates(bodyToCreateInput(body, customerId), capabilityOpts(req));
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Check duplicates error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/merge-duplicates", async (req, res) => {
  try {
    const { customerId, keepIdentityId, mergeIdentityIds } = req.body as {
      customerId: number;
      keepIdentityId: number;
      mergeIdentityIds: number[];
    };
    if (!customerId || !keepIdentityId || !mergeIdentityIds?.length) {
      return res.status(400).json({ error: "customerId, keepIdentityId, mergeIdentityIds required" });
    }
    if (!assertCustomerAccess(req, customerId)) return res.status(403).json({ error: "Forbidden" });
    const result = await addressCapability.mergeAddresses({ customerId, keepIdentityId, mergeIdentityIds }, capabilityOpts(req));
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Merge duplicates error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/addresses/:id/history", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await addressCapability.getAddress(id, capabilityOpts(req));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!assertCustomerAccess(req, existing.customerId)) return res.status(403).json({ error: "Forbidden" });
    const history = await addressCapability.getAddressHistory(id);
    return res.json(history);
  } catch (err) {
    req.log.error({ err }, "Address history error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/:id/snapshot", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await addressCapability.getAddress(id, capabilityOpts(req));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!assertCustomerAccess(req, existing.customerId)) return res.status(403).json({ error: "Forbidden" });
    const snapshot = await addressSnapshotService.createFromAddressId(id, "MANUAL", req.log);
    return res.status(201).json(snapshot.snapshot);
  } catch (err) {
    req.log.error({ err }, "Create snapshot error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addresses/migrate-legacy", async (req, res) => {
  try {
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const report = await legacyAddressMigrator.migrateAll();
    return res.json({ success: true, report, requestId: resolveAddressTraceId(req.headers["x-request-id"]) });
  } catch (err) {
    req.log.error({ err }, "Legacy migration error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
