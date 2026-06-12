# CWP Detailers + Kleansolar Platform

Full-stack SaaS business operating platform for CWP Detailers (car detailing, Varanasi) and Kleansolar (solar panel cleaning) — with public website, customer portal, staff portal, franchisee portal, and admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/cwp-platform run dev` — React frontend (port auto, proxied at `/`)
- `pnpm --filter @workspace/scripts run seed` — seed DB with demo data (run once)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Postgres), `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Wouter (routing), TanStack Query, Shadcn/UI, Framer Motion, Recharts
- API: Express 5, pino logging
- DB: PostgreSQL + Drizzle ORM, `drizzle-zod`
- Validation: Zod v4
- API codegen: Orval (OpenAPI → React Query hooks)
- Build: esbuild (CJS bundle for server)
- Fonts: Outfit (display), Plus Jakarta Sans (body)
- Theme: primary `hsl(180,100%,40%)` cyan/teal, secondary dark navy `hsl(220,40%,6%)`

## Where things live

- `lib/db/src/schema/` — all 14 DB schema files (source of truth)
- `lib/api-spec/` — OpenAPI spec + Orval config
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `artifacts/api-server/src/routes/` — 15 route files (auth, customers, vehicles, solar-sites, services, subscriptions, bookings, staff, complaints, payments, branches, analytics, notifications, franchisees, churned)
- `artifacts/cwp-platform/src/pages/` — admin/, customer/, staff/, franchisee/ + Landing, Login, Register
- `artifacts/cwp-platform/src/components/layout/` — AdminLayout, CustomerLayout, StaffLayout, FranchiseeLayout, AdminSidebar
- `artifacts/cwp-platform/src/lib/auth.tsx` — AuthContext + useAuth hook
- `scripts/src/seed.ts` — DB seed script

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks used everywhere
- Auth is token-based (SHA-256 hash stored in DB), token stored in localStorage; role-based redirect on login
- `db.execute(sql`...`)` returns a Drizzle QueryResult — always wrap with `toRows()` helper in analytics routes
- All `@import url(...)` must be the very first line in `index.css` (before `@import "tailwindcss"`)
- Wouter `<Router base={...}>` uses `import.meta.env.BASE_URL` for correct sub-path routing through Replit proxy

## Product

- **Public landing page**: hero, services catalog (live from DB), subscription plans (real rate cards), solar pricing table, GST notice, testimonials, city coverage
- **Customer portal**: dashboard with active plans/wallet/dues, book services, service history, invoices, complaints
- **Staff portal**: today's jobs with start/complete actions, full schedule, attendance marking, performance & leaderboard
- **Admin dashboard**: KPI tiles, charts, 15 management pages (Customers, Staff, Bookings, Subscriptions, Invoices, Complaints, Branches, Services, Analytics, Notifications, **Franchisees**, **Staff Verification**, **Credentials**, **Churned Customers**)
- **Franchisee portal**: city-level dashboard, booking requests, staff management, churned customer re-engagement

## Franchisee & Staff Flows

- Franchisee added by admin → admin creates franchisee login account (`/api/franchisees/:id/create-account`)
- Franchisee logs in → can view city bookings, see their staff, reach churned customers
- Staff added (by admin or franchisee) → verificationStatus = "pending"
- Admin reviews staff documents at `/admin/staff-approval` → Verify or Reject
- Once verified, admin creates login at `/admin/credentials` (`/api/staff/:id/create-account`)
- Only verified staff can be assigned bookings
- All payments collected & settled by admin → franchisee receives their share

## Churned Customers

- Cancelled subscriptions tracked with `cancelledAt`, `cancellationRemark`, `messageSentAt`
- `/api/churned` — list by branchId (city filter for franchisees)
- `/api/churned/bulk-message` — send re-engagement message to selected customer IDs
- Both admin and franchisee portals can select multiple customers and send personalized bulk messages

## GST

- All displayed prices are base prices; GST 18% is additional
- Note shown on landing page pricing and solar table
- Customers with GSTIN can request input tax credit bill

## User preferences

- Demo admin: phone `9999999999`, password `admin123`
- Premium dark-mode design with cyan/teal primary and navy dark secondary
- INR currency formatting throughout (₹ with `toLocaleString("en-IN")`)

## Gotchas

- Do NOT re-run the seed script — data already seeded
- `lib/api-zod/src/index.ts` must only contain `export * from "./generated/api";` — Orval overwrites it
- `db.execute()` returns QueryResult, not plain array — use `toRows()` helper in analytics.ts
- Google Fonts `@import url(...)` must be first line of index.css
- Staff/customer IDs are currently hardcoded to `1` in portal pages (demo mode) — wire from `useAuth().user` in production
- Staff must be `verificationStatus = "verified"` before they can get a login account (enforced at API level)

## DB Schema (14 tables)

users, branches, customers, vehicles, solar-sites, services, subscriptions (+ cancelledAt/remark/messageSentAt), staff (+ aadhaar/pan/bank/addresses/guardian/verificationStatus), bookings, attendance, complaints, invoices, notifications, **franchisees**

## Pointers

- See `pnpm-workspace` skill for workspace structure and TypeScript setup
- See `lib/db/src/schema/` for full DB schema reference
- Orval config: `lib/api-spec/orval.config.ts`
