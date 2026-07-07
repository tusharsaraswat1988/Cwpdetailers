# AGENTS.md

## Cursor Cloud specific instructions

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
