# Phase 6 — Admin UX Consolidation

Audit, universal design system specification, and sprint roadmap for turning the CWP Detailers admin panel into a single, cohesive enterprise SaaS experience (UrbanClap-Pro/Ops-console grade). Backend architecture is complete and out of scope — this phase only touches presentation.

## 1. Current state summary

Stack: React 19 + Vite, **shadcn/ui (New York) + Radix + Tailwind CSS v4**, `wouter` routing. Admin shell: `AdminLayout` → `PanelShell` → `AdminSidebar` (nav from `adminNavConfig.ts`). No Ant Design/MUI — the "Ant Design" heuristic below is applied as a pattern reference, not a literal library swap.

Existing reusable pieces already in `artifacts/cwp-platform/src/components/shared/`: `PageHeader`, `FilterBar`, `DataTable`, `EmptyState`, `ErrorState`, `SkeletonRow`, `StatusBadge`, `ActivityFeed`, `ResourceForm`. Plus `components/layout/PageActionHeader.tsx`. These are good primitives but are **inconsistently adopted** — several ops-critical modules (Assign Services, Job Orchestration, Billing/Invoices) bypass them with bespoke markup.

## 2. Audit by module

Legend: 🔴 Critical 🟠 Medium 🟡 Minor

| Module | Page(s) | List pattern | Header | Findings |
|---|---|---|---|---|
| Dashboard | `pages/admin/Dashboard.tsx` | KPI cards + charts | `PageActionHeader` | 🟠 No error state on stat fetch failure. 🟡 Not a single "mission control" — doesn't surface cross-module alerts (overdue jobs, unassigned bookings) prominently. |
| Customers | `features/customers/pages/Customers.tsx` + `CustomerDetail.tsx` | Shared `DataTable` | `PageActionHeader` | 🟠 No pagination (Hick's Law risk at scale). 🟠 No error state. 🟡 "View" is a text link, inconsistent with Bookings' row-click. |
| Service Requests | `pages/admin/BookServicesPage.tsx` | Wizard | — | 🟡 Wizard is fine (progressive disclosure) but styling of steps not shared with other multi-step flows. |
| Bookings | `features/bookings/pages/Bookings.tsx` | Shared `DataTable` + custom pager | `PageHeader` (no CTA) | 🟠 No text search, only status filter. 🟠 No error state. 🟡 Uses `PageHeader` instead of `PageActionHeader` — inconsistent with sibling ops pages. |
| Assignments | `pages/admin/AssignServicesPage.tsx` | **Bespoke `<table>` ×2** | `PageActionHeader` | 🔴 Does not reuse `DataTable`/`FilterBar` at all — a second table implementation with its own skeleton/empty/hover logic. 🔴 No pagination/search on a queue that grows daily. 🟠 Destructive "remove" uses native `confirm()` (breaks visual consistency, not theme-able, fails WCAG dialog focus patterns). 🟠 High action density per row (Fitts's Law: small targets crammed together). |
| Execution | *(no admin page)* | — | — | 🔴 **Missing module.** Field execution is only visible in the staff portal; admins can't browse/audit executions, forcing them through Assign Services or the Operations Wall as a workaround. |
| Jobs | `pages/admin/JobOrchestrationPage.tsx` | Card grid (`JobCard`) | `PageActionHeader` | 🟠 Card grid instead of table — breaks "recognition over recall" consistency with Customers/Bookings. 🟠 Hard cap of 200 records, no pagination. 🟡 Outer wrapper missing page padding (`space-y-6` without `p-6`) — visibly misaligned vs other pages. |
| Billing | `pages/admin/BillingFinancePage.tsx` | **3 different list styles** (commercial cards, invoice bespoke table, dues chips) | `PageActionHeader` | 🔴 Component duplication: cards for Commercial Closure, a third bespoke `<table>` style for Invoices, chip buttons for filters — three visual languages on one page. 🟠 Invoices capped at 50, no pager. 🟡 Refund note rendered as raw `<button>` text link. |
| Staff | `features/staff/pages/Staff.tsx` + `StaffDetail.tsx` | Card grid | — | 🟠 No search on staff directory. 🟡 Card grid again diverges from table-based Customers/Bookings. |
| Assets | `pages/admin/AssetsPage.tsx` / `AssetDetail.tsx` | Card grid | — | 🔴 **Navigation problem**: routed (`/admin/assets`) but **absent from the sidebar** — orphaned page, undiscoverable (violates Jakob's Law: users expect every feature to be reachable from nav). |
| Services | `pages/admin/ProductsAndPlans.tsx` | Tabs + cards | — | 🟡 Legacy `Services.tsx` file still exists unused — dead code / confusion risk for future maintainers. |
| Reports | `pages/admin/Analytics.tsx` | KPI + charts | — | 🟠 No date-range picker (period hardcoded to "month") — a data-heavy SaaS page should let users pivot the window. 🟡 Top KPI row uses `grid-cols-3` with no responsive breakpoint — cramped on tablet/mobile. |
| Settings | 7 separate pages (`BrandIdentity`, `SystemStatus`, `BusinessInfo`, `SeoSettings`, `InvoiceBillingSettings`, `LegalCMS`, `ComplianceSettings`) | Forms | — | 🟠 No single Settings hub/landing page — user must know which sidebar item to click (violates Recognition over Recall). 🟡 No RBAC/permissions matrix editor exists as a page. |

### Cross-cutting issues (affect every module)

1. 🔴 **No shared page shell contract.** Padding (`p-6` vs `p-4 md:p-6` vs none), header component (`PageHeader` vs `PageActionHeader` vs raw `<h1>`), and content wrapper vary page to page — pure inconsistency, no functional reason.
2. 🔴 **Three competing table implementations** (`DataTable`, ad-hoc `<table>` in Assign Services, ad-hoc `<table>` in Invoices) plus two card-grid list patterns (Jobs, Staff, Assets). Same data shape (rows of records with actions), rendered three different ways.
3. 🟠 **No universal Timeline component** despite five backend timeline services (booking, assignment, execution, job, commercial). Each surface (Bookings modal, Job dialog, Operations Wall, Communications) reinvents its own feed markup.
4. 🟠 **No pagination anywhere that matters.** `ui/pagination.tsx` exists and is unused; every list either hard-caps (200/50/15) or loads everything.
5. 🟠 **Error states are absent almost everywhere** — a shared `ErrorState` component exists but only a couple of pages wire it to query errors. On failure, most pages silently show an empty table (users can't tell "no data" from "failed to load" — a Nielsen visibility-of-system-status violation).
6. 🟠 **Status vocabularies are fragmented.** `StatusBadge` covers booking-ish statuses only; invoices, jobs, assignments, attendance each keep their own local color maps (`statusColors`, `founderStatusBadgeClass`, `STATUS_VARIANT`, ad-hoc booleans). Same word ("completed", "cancelled") can render in different colors on different pages.
7. 🟡 **No breadcrumbs, global search, or notification bell** in the admin chrome, despite `breadcrumb.tsx` primitive already existing unused. For a 40+ route admin, breadcrumbs materially reduce navigation confusion (Nielsen: visibility, user control).
8. 🟡 Native `confirm()`/`alert()` used for a couple of destructive actions instead of themed `AlertDialog` — accessibility and consistency gap.
9. 🟡 Mobile: table-heavy pages (Bookings, Customers) rely on horizontal scroll on small screens with no card-view fallback; several KPI grids don't declare a `sm:`/`md:` step.

## 3. Universal design system specification

All items below **reuse existing shadcn primitives and Tailwind v4 tokens** already in `src/index.css` / `src/components/ui/`. No new dependency, no new color language — we are *consolidating*, not reskinning.

1. **Design tokens** — `src/index.css`: keep existing HSL tokens (`--primary`, `--card`, `--border`, radii scale); *add* a small shadow/elevation scale and promote the ad-hoc status colors (`--status-scheduled`…) to cover the full status vocabulary (add `--status-open`, `--status-resolved`, `--status-closed`, `--status-blocked`, `--status-overdue`).
2. **Universal Components** (`components/shared/`, `components/ui/` — extend, don't fork):
   - `DataTable` — add optional pagination (`page`, `pageSize`, `total`, `onPageChange` using existing `ui/pagination.tsx`) and an `error` prop that renders `ErrorState` inline. This becomes the *only* table implementation admin-wide.
   - `StatusBadge` — expand status→color map to a single source of truth for booking/job/invoice/assignment/attendance statuses; deprecate local `statusColors`/`STATUS_VARIANT` maps as modules migrate.
   - `Timeline` (new) — vertical connector-dot timeline consuming `{title, description, timestamp, status, actor}[]`; replaces bespoke feeds in Bookings modal, Job dialog, Operations Wall, Communications.
   - `StatCard` (new) — KPI tile (label, value, delta, icon, trend) standardizing Dashboard/Analytics/Jobs stat rows.
   - `ActionBar` (new) — sticky/inline toolbar for bulk + row actions, replacing raw `confirm()` and ad-hoc button clusters.
3. **Universal Page Layout** — `PageTemplate` (new, wraps `AdminLayout`): breadcrumbs slot → `PageHeader`/primary CTA → optional `FilterBar` slot → content slot, with one canonical padding rule (`p-4 sm:p-6`). Every module page adopts this instead of hand-rolling its wrapper.
4. **Universal Navigation** — add the missing Assets sidebar entry; wire `PageBreadcrumbs` (new, thin wrapper over existing `ui/breadcrumb.tsx`) into `PageTemplate` so every page gets breadcrumbs for free without per-page work.
5. **Universal Filters** — standardize on `FilterBar` (search + slot for `Select`/date-range children) for every list page; retire the Assign Services "Filters card" and Billing's chip-button filters into `FilterBar` children in their sprint.
6. **Universal Forms** — `ResourceForm` already exists and is under-used; no new component needed, just wider adoption in later sprints.
7. **Universal Empty/Loading/Error States** — `EmptyState`/`SkeletonRow`/`ErrorState` already exist; the fix is wiring, not new components — every query-driven page must render all three states.
8. **Toast/Notifications** — `sonner` already installed and used; no change, just consistent usage (stop silent failures).

## 4. Implementation roadmap

**Foundation-first**, one module migrated at a time after the shared kit lands. No backend or workflow changes in any sprint.

### Sprint 1 — Foundation (this session)
- Design tokens: shadow/elevation scale + full status color set in `index.css`.
- `StatusBadge`: unify status vocabulary (booking/job/invoice/assignment).
- `DataTable`: pagination + error-state support.
- New: `Timeline`, `StatCard`, `PageTemplate`, `PageBreadcrumbs`, `ActionBar`.
- Navigation: add missing Assets entry to `adminNavConfig.ts`.
- Barrel export updates so all of the above are importable from `@/components/shared`.

### Sprint 2 — Highest business impact (daily-use ops flow)
Dashboard → Service Requests → Bookings → Staff Assignment → Field Execution → Job Orchestration → Billing & Finance. Each migration: adopt `PageTemplate`, swap bespoke tables/cards for `DataTable` + pagination, wire `ErrorState`, unify statuses via `StatusBadge`, replace ad-hoc feeds with `Timeline`. Field Execution gets its first dedicated admin list page (read-only view over existing `service-executions` API — no backend change).

### Sprint 3
Customers → Staff → Services → Assets. Add pagination/search where missing, migrate card grids to `DataTable` (or a `DataTable` card-view mode for touch-heavy contexts), fix Assets nav orphan (done in Sprint 1), remove dead `Services.tsx`.

### Sprint 4
Reports/Analytics (add date-range control, responsive KPI grid) → Settings (introduce a Settings landing hub linking the 7 existing pages) → final consistency pass (breadcrumbs everywhere, remaining `confirm()`/`alert()` replaced with `AlertDialog`, mobile audit).

Each sprint after Sprint 1 is executed module-by-module, verifying build/typecheck before moving to the next, per the "no duplicate components, everything consumes the shared kit" rule.
