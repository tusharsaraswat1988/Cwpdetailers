# AGENTS.md --- CWP Detailers Project Rules

## Living PRD --- Mandatory

Canonical PRD: `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md`

For every task under this project:

1.  Read the canonical PRD before planning, modifying code, creating UI,
    changing schemas, fixing bugs or proposing scope.
2.  Identify and reuse relevant requirement IDs. If the work introduces
    a new requirement, assign a stable ID and add it to the PRD.
3.  Check the PRD's status, architecture notes, dependencies, open
    decisions, risks and acceptance criteria.
4.  Update the PRD in the same work cycle as the code/product work. PRD
    synchronization is a required deliverable, not optional.
5.  Before implementation, add/update the backlog item and mark it
    `In Progress` when work begins.
6.  After implementation, record the actual change, affected modules,
    migration/deployment notes, security/privacy impact, tests run and
    test results, known limitations, and remaining work.
7.  Mark an item `Done` only after its acceptance criteria have been
    verified with appropriate evidence. If evidence is absent, use
    `Unverified`, `Needs Audit`, `Blocked` or `In Progress`.
8.  Update the PRD change log and affected requirement/backlog statuses.
    Preserve stable IDs and prior history.
9.  Do not infer completion from a plan, code-generation output, or a
    prior chat message. Inspect repository/test evidence.
10. If the canonical PRD file is unavailable, state that explicitly and
    create a proposed Markdown update; do not claim the repository PRD
    was synchronized.
11. Keep the PRD consistent with the implementation. If scope or design
    changes, update requirements and acceptance criteria before treating
    the work as complete.
12. Do not perform destructive production changes or migrations without
    explicit authorization and the required backup/review process.

## Project Integrity

-   Preserve existing working Varanasi flows while implementing Noida
    and multi-city behavior.
-   Enforce city, branch, customer and staff authorization on the
    backend; frontend hiding is not access control.
-   Prefer configuration-driven behavior over city-specific hardcoding.
-   Treat customer, vehicle, residential society, parking, location and
    media data as sensitive.
-   Use incremental, reviewable and tested migrations.
-   Report honestly what was implemented, tested, left unverified and
    still planned.

## Monorepo & Environment Instructions (Preserved)

This is a **pnpm monorepo** (`artifacts/*` apps, `lib/*` shared libs, `scripts`) for the **CWP Detailers / Kleansolar** platform: a React 19 + Vite frontend (`@workspace/cwp-platform`) and an Express API (`@workspace/api-server`) backed by **PostgreSQL** (Drizzle ORM). Node/pnpm are enforced (`scripts/preinstall.mjs` rejects npm/yarn). Standard commands live in root `package.json`, `lib/db/package.json`, and `scripts/package.json` — prefer those over duplicating here.

### Environment / services
- **PostgreSQL is required.** The dev VM has Postgres 16 (cluster `16/main`). Start it if not running: `sudo pg_ctlcluster 16 main start`. The `postgres` role password is `postgres` and the app DB is `cwp`.
- A repo-root `.env` (gitignored) provides config. It must define `DATABASE_URL`, `PORT=8080`, and `BASE_PATH=/` plus the `ADMIN_*` bootstrap vars. Local value: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cwp`. Copy from `.env.example` if missing.
- Redis and Cloudinary are **optional**: the comms queue falls back to a Postgres table when `REDIS_URL` is unset, and Cloudinary only fails when an image-upload endpoint is actually hit. Core flows work without them.

### Running
- `pnpm dev` (runs `scripts/dev.mjs`) starts **both** services: API on **http://127.0.0.1:8080** and the Vite frontend on **http://127.0.0.1:21456** (frontend proxies `/api` → 8080). Use this for development. It builds the API with esbuild first, then runs it.
- The **super admin is created on every API startup** from the `ADMIN_*` env vars (no seed needed for admin). Log in at `/admin/login`.
- Login requires a `portal` field: `POST /api/auth/login {phone, password, portal}` where portal is `admin` / `customer` / `staff`. Admin: `9999999999` / `admin123`.

### Database setup (only needed on a fresh DB, not every startup)
- `pnpm --filter @workspace/db run push` applies the Drizzle schema. **Note:** `drizzle.config.ts` does NOT load `.env` — export `DATABASE_URL` into the shell first (e.g. `export DATABASE_URL=...`) before running push. The `tsx` seed/migration scripts DO self-load `.env`.
- `pnpm --filter @workspace/scripts run migrate:pending` applies the SQL migrations (idempotent).
- `pnpm --filter @workspace/scripts run seed:master-data` and `seed:catalog` populate reference/catalog data.

### Known gotcha — `pnpm --filter @workspace/scripts run seed` is broken
`scripts/src/seed-permissions.ts` has a self-executing `main().then(() => process.exit(0))` at the bottom. `seed.ts` imports `seedPermissions` from it, so that runner fires on import and races the main seed, calling `process.exit(0)` when permissions finish — killing the process before the demo customer/staff **login users** (in the `users` table) are created. As a result the documented demo customer/staff logins (9001…/9011…) do NOT get created by `seed`. Admin login still works. To create customer/staff accounts, use the **admin portal UI** ("New Customer" with "Create app login" checked) or the admin API, which works reliably.

### Typecheck / build caveat
`pnpm run typecheck` currently **fails with pre-existing errors** in `@workspace/api-server` (AuthUser `staffId` null vs undefined) and `@workspace/scripts` (one-off verify/test scripts). These are unrelated to environment setup. The app still **runs**, because `pnpm dev` builds the API via **esbuild** (`build.mjs`), which does not run `tsc`.
