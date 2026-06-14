import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import contactRouter from "./contact";
import customersRouter from "./customers";
import vehiclesRouter from "./vehicles";
import solarSitesRouter from "./solar-sites";
import servicesRouter from "./services";
import subscriptionsRouter from "./subscriptions";
import bookingsRouter from "./bookings";
import staffRouter from "./staff";
import staffEcosystemRouter from "./staff-ecosystem";
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
import communicationsRouter from "./communications";
import communicationsPhase2Router from "./communications-phase2";
import communicationsPhase3Router from "./communications-phase3";
import communicationsWebhooksRouter from "./communications-webhooks";
import brandingRouter from "./branding";
import legalRouter from "./legal";
import masterDataRouter from "./master-data";
import serviceCatalogRouter from "./service-catalog";
import dcmsRouter from "./dcms";
import pushRouter from "./push";
import operationsRouter from "./operations";
import migrationRouter from "./migration";
import serviceLocationsRouter from "./service-locations";
import assetsRouter from "./assets";
import serviceContractsRouter from "./service-contracts";
import assignmentsRouter from "./assignments";
import serviceExecutionsRouter from "./service-executions";
import { guardResource, guardMasterDataRoutes, guardCatalogRoutes } from "../middlewares/permissions";

const router: IRouter = Router();

// Public / always-on
router.use(healthRouter);
router.use(communicationsWebhooksRouter);
router.use(authRouter);
router.use(contactRouter);

// Resource-guarded routers. Each guard maps HTTP method → permission action
// (GET=view, POST=create, PUT/PATCH=edit, DELETE=delete) for that resource.
// Overrides handle non-CRUD POST endpoints inside each router.
router.use(
  guardResource("customers", [
    { match: /\/customers\/\d+\/reactivate$/, method: "POST", action: "edit" },
  ]),
  customersRouter,
);
router.use(guardResource("customers"), assetsRouter);
router.use(guardResource("customers"), serviceLocationsRouter);
router.use(
  guardResource("customers", [
    { match: /\/wallet\/credit$/, method: "POST", action: "edit" },
    { match: /\/migration\/customers\/preview$/, method: "POST", action: "create" },
    { match: /\/migration\/customers\/import$/, method: "POST", action: "create" },
  ]),
  walletRouter,
);
router.use(
  guardResource("customers", [
    { match: /\/migration\/customers\/preview$/, method: "POST", action: "create" },
    { match: /\/migration\/customers\/import$/, method: "POST", action: "create" },
  ]),
  migrationRouter,
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
  ]),
  subscriptionsRouter,
);
router.use(
  guardResource("bookings", [
    { match: /\/service-contracts$/, method: "POST", action: "create" },
    { match: /\/service-contracts\/\d+\/status$/, method: "PATCH", action: "edit" },
  ]),
  serviceContractsRouter,
);
router.use(
  guardResource("bookings", [
    { match: /\/assignments\/\d+\/assign$/, method: "POST", action: "edit" },
  ]),
  assignmentsRouter,
);
router.use(
  guardResource("bookings", [
    { match: /\/service-executions\/\d+\/start$/, method: "POST", action: "edit" },
    { match: /\/service-executions\/\d+\/complete$/, method: "POST", action: "edit" },
    { match: /\/service-executions\/\d+\/miss$/, method: "POST", action: "edit" },
    { match: /\/service-executions\/\d+\/cancel$/, method: "POST", action: "edit" },
    { match: /\/service-executions\/\d+\/reschedule$/, method: "POST", action: "edit" },
  ]),
  serviceExecutionsRouter,
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
    { match: /\/verification-status$/, method: "POST", action: "approve" },
    { match: /\/ecosystem$/, method: "PATCH", action: "edit" },
    { match: /\/roles$/, method: "PUT", action: "edit" },
    { match: /\/documents$/, method: "POST", action: "edit" },
    { match: /\/documents\/\d+\/replace$/, method: "POST", action: "edit" },
    { match: /\/notes$/, method: "POST", action: "edit" },
  ]),
  staffRouter,
);
router.use(
  guardResource("staff", [
    { match: /\/verification-status$/, method: "POST", action: "approve" },
    { match: /\/ecosystem$/, method: "PATCH", action: "edit" },
    { match: /\/roles$/, method: "PUT", action: "edit" },
    { match: /\/documents$/, method: "POST", action: "edit" },
    { match: /\/documents\/\d+\/replace$/, method: "POST", action: "edit" },
    { match: /\/notes$/, method: "POST", action: "edit" },
  ]),
  staffEcosystemRouter,
);
router.use(guardResource("complaints"), complaintsRouter);
router.use(
  guardResource("invoices", [
    { match: /\/invoices\/billing-settings$/, method: "PUT", action: "edit" },
    { match: /\/invoices\/\d+\/credit-note$/, method: "POST", action: "create" },
  ]),
  paymentsRouter,
);
router.use(guardResource("branches"), branchesRouter);
router.use(guardResource("analytics"), analyticsRouter);
router.use(guardResource("bookings"), operationsRouter);
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

router.use(
  guardResource("communications", [
    { match: /\/campaigns\/\d+\/send$/, method: "POST", action: "edit" },
    { match: /\/campaigns\/\d+\/schedule$/, method: "POST", action: "edit" },
    { match: /\/campaigns\/preview$/, method: "POST", action: "view" },
    { match: /\/audiences\/preview$/, method: "POST", action: "view" },
    { match: /\/jobs\/process$/, method: "POST", action: "edit" },
    { match: /\/whatsapp\/test-send$/, method: "POST", action: "create" },
    { match: /\/consents\/\d+$/, method: "PUT", action: "edit" },
    { match: /\/smart-segments\/preview$/, method: "POST", action: "view" },
    { match: /\/conversations\/\d+\/reply$/, method: "POST", action: "edit" },
    { match: /\/conversations\/\d+\/assign$/, method: "POST", action: "edit" },
    { match: /\/conversations\/\d+\/close$/, method: "POST", action: "edit" },
    { match: /\/conversations\/\d+\/notes$/, method: "POST", action: "edit" },
    { match: /\/inbox/, method: "GET", action: "view" },
    { match: /\/journey/, method: "GET", action: "view" },
    { match: /\/crm\/analytics/, method: "GET", action: "view" },
  ]),
  communicationsRouter,
  communicationsPhase2Router,
  communicationsPhase3Router,
);

router.use(storageRouter);
router.use(brandingRouter);
router.use(legalRouter);
router.use(pushRouter);
router.use(dcmsRouter);
router.use(guardMasterDataRoutes(), masterDataRouter);
router.use(guardCatalogRoutes(), serviceCatalogRouter);

export default router;
