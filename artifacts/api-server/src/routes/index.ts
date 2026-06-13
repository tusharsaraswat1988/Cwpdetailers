import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import customersRouter from "./customers";
import vehiclesRouter from "./vehicles";
import solarSitesRouter from "./solar-sites";
import servicesRouter from "./services";
import subscriptionsRouter from "./subscriptions";
import bookingsRouter from "./bookings";
import staffRouter from "./staff";
import complaintsRouter from "./complaints";
import paymentsRouter from "./payments";
import branchesRouter from "./branches";
import analyticsRouter from "./analytics";
import notificationsRouter from "./notifications";
import franchiseesRouter from "./franchisees";
import churnedRouter from "./churned";
import leadsRouter from "./leads";
import storageRouter from "./storage";
import quotationsRouter from "./quotations";
import expensesRouter from "./expenses";
import billingRouter from "./billing";
import walletRouter from "./wallet";
import { guardResource } from "../middlewares/permissions";

const router: IRouter = Router();

// Public / always-on
router.use(healthRouter);
router.use(authRouter);

// Resource-guarded routers. Each guard maps HTTP method → permission action
// (GET=view, POST=create, PUT/PATCH=edit, DELETE=delete) for that resource.
// Overrides handle non-CRUD POST endpoints inside each router.
router.use(guardResource("customers"), customersRouter);
router.use(
  guardResource("customers", [
    { match: /\/wallet\/credit$/, method: "POST", action: "edit" },
  ]),
  walletRouter,
);
router.use(guardResource("customers"), vehiclesRouter);
router.use(guardResource("customers"), solarSitesRouter);
router.use(guardResource("services"), servicesRouter);
router.use(
  guardResource("subscriptions", [
    { match: /\/cancel$/, method: "POST", action: "edit" },
    { match: /\/renew$/, method: "POST", action: "edit" },
    { match: /\/pause$/, method: "POST", action: "edit" },
    { match: /\/resume$/, method: "POST", action: "edit" },
    { match: /\/daily-tick$/, method: "POST", action: "edit" },
    { match: /\/daily-schedule$/, method: "POST", action: "edit" },
  ]),
  subscriptionsRouter,
);
router.use(
  guardResource("bookings", [
    { match: /\/start$/, method: "POST", action: "edit" },
    { match: /\/complete$/, method: "POST", action: "edit" },
    { match: /\/assign$/, method: "POST", action: "edit" },
    { match: /\/transition$/, method: "POST", action: "edit" },
    { match: /\/proof$/, method: "POST", action: "edit" },
    { match: /\/reschedule$/, method: "POST", action: "edit" },
    { match: /\/regenerate-occurrences$/, method: "POST", action: "edit" },
  ]),
  bookingsRouter,
);
router.use(
  guardResource("staff", [
    { match: /\/verify$/, method: "POST", action: "approve" },
    { match: /\/reject$/, method: "POST", action: "approve" },
    { match: /\/create-account$/, method: "POST", action: "approve" },
    { match: /\/attendance$/, method: "POST", action: "edit" },
  ]),
  staffRouter,
);
router.use(guardResource("complaints"), complaintsRouter);
router.use(guardResource("invoices"), paymentsRouter);
router.use(guardResource("branches"), branchesRouter);
router.use(guardResource("analytics"), analyticsRouter);
router.use(
  guardResource("notifications", [
    { match: /\/broadcast$/, method: "POST", action: "create" },
    { match: /\/test-sms$/, method: "POST", action: "create" },
  ]),
  notificationsRouter,
);
router.use(guardResource("invoices"), quotationsRouter);
router.use(guardResource("invoices"), expensesRouter);
router.use(guardResource("invoices"), billingRouter);
router.use(
  guardResource("franchisees", [
    { match: /\/create-account$/, method: "POST", action: "approve" },
  ]),
  franchiseesRouter,
);
router.use(
  guardResource("churned", [
    { match: /\/bulk-message$/, method: "POST", action: "edit" },
  ]),
  churnedRouter,
);
router.use(
  guardResource("leads", [
    { match: /\/convert$/, method: "POST", action: "edit" },
    { match: /\/activities$/, method: "POST", action: "edit" },
    { match: /\/ingest$/, method: "POST", action: "create" },
  ]),
  leadsRouter,
);

router.use(storageRouter);

export default router;
