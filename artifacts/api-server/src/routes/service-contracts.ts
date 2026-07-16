import { Router } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { tenantStamp } from "../middlewares/tenantScope";
import { isBookServicesContractsEnabled } from "../lib/contracts/featureFlag";
import { isBookServicesBillingEnabled } from "../lib/billing/featureFlag";
import {
  createServiceContract,
  getServiceContract,
  updateContractStatus,
  listCustomerContracts,
  type CreateServiceContractBody,
} from "../lib/contracts/serviceContractService";
import {
  createQuotationForContract,
  createInvoiceForContract,
  previewContractBilling,
} from "../lib/billing/contractBillingService";
import { mapBillingError } from "../lib/billing/billingErrors";
import {
  ServiceabilityValidationError,
  serviceabilityHttpBody,
  SERVICEABILITY_HTTP_STATUS,
  serviceabilityBlockedLogPayload,
} from "../lib/serviceability";

const router = Router();

router.post("/service-contracts", requireAuth, async (req, res) => {
  try {
    if (!isBookServicesContractsEnabled()) {
      return res.status(503).json({ error: "Book Services contracts are disabled" });
    }
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body as CreateServiceContractBody;
    const result = await createServiceContract(req, body, userId);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof ServiceabilityValidationError) {
      req.log.warn(
        serviceabilityBlockedLogPayload(err.result, {
          customerId: (req.body as CreateServiceContractBody)?.customerId,
          serviceId: (req.body as CreateServiceContractBody)?.catalogServiceId
            ?? (req.body as CreateServiceContractBody)?.selectionId,
        }),
        "Booking blocked by serviceability validation",
      );
      return res.status(SERVICEABILITY_HTTP_STATUS).json(serviceabilityHttpBody(err.result));
    }
    const message = err instanceof Error ? err.message : "Contract creation failed";
    req.log.error({ err }, "Create service contract error");
    return res.status(400).json({ error: message });
  }
});

router.get("/service-contracts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid contract id" });
    const row = await getServiceContract(id, req);
    if (!row) return res.status(404).json({ error: "Contract not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Get service contract error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/service-contracts/:id/billing-preview", requireAuth, async (req, res) => {
  try {
    if (!isBookServicesBillingEnabled()) {
      return res.status(503).json({ error: "Book Services billing is disabled" });
    }
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid contract id" });
    const row = await getServiceContract(id, req);
    if (!row) return res.status(404).json({ error: "Contract not found" });
    const preview = await previewContractBilling(id);
    return res.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Billing preview failed";
    req.log.error({ err }, "Contract billing preview error");
    return res.status(400).json({ error: message });
  }
});

router.post("/service-contracts/:id/quotation", requireAuth, async (req, res) => {
  try {
    if (!isBookServicesBillingEnabled()) {
      return res.status(503).json({ error: "Book Services billing is disabled" });
    }
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid contract id" });
    const row = await getServiceContract(id, req);
    if (!row) return res.status(404).json({ error: "Contract not found" });
    const stamped = tenantStamp(req, {});
    const result = await createQuotationForContract(id, stamped);
    return res.status(201).json(result);
  } catch (err) {
    const { status, message } = mapBillingError(err);
    req.log.error({ err }, "Create contract quotation error");
    return res.status(status).json({ error: message });
  }
});

router.post("/service-contracts/:id/invoice", requireAuth, async (req, res) => {
  try {
    if (!isBookServicesBillingEnabled()) {
      return res.status(503).json({ error: "Book Services billing is disabled" });
    }
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid contract id" });
    const row = await getServiceContract(id, req);
    if (!row) return res.status(404).json({ error: "Contract not found" });
    const stamped = tenantStamp(req, {});
    const result = await createInvoiceForContract(id, stamped);
    return res.status(201).json(result);
  } catch (err) {
    const { status, message } = mapBillingError(err);
    req.log.error({ err }, "Create contract invoice error");
    return res.status(status).json({ error: message });
  }
});

router.patch("/service-contracts/:id/status", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };
    const allowed = ["active", "paused", "completed", "expired", "cancelled", "expiring"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    }
    const updated = await updateContractStatus(id, status as "active", req);
    return res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status update failed";
    req.log.error({ err }, "Update contract status error");
    return res.status(400).json({ error: message });
  }
});

/** Explicit permission — this path is outside the /service-contracts guard prefix. */
router.get(
  "/customers/:customerId/service-contracts",
  requireAuth,
  requirePermission("bookings", "view"),
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId, 10);
      if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid customer id" });
      const rows = await listCustomerContracts(customerId, req);
      return res.json({ data: rows });
    } catch (err) {
      req.log.error({ err }, "List customer service contracts error");
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
