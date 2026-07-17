# UI Constitution — CWP Detailers Admin

Governs every admin page going forward. Stack: React 19, Tailwind CSS v4, shadcn/ui (New York), Radix, `wouter`. No MUI/Ant Design/Bootstrap. This document is the single source of truth referenced by `docs/PHASE_6_ADMIN_UX_CONSOLIDATION.md`; when in doubt, extend a component listed here rather than writing new markup.

## 1. Design tokens

All tokens live in `artifacts/cwp-platform/src/index.css`. Never hardcode a hex/HSL color, shadow, or duration in a component — reference the token.

- **Color**: shadcn semantic tokens (`--background`, `--card`, `--primary`, `--muted`, `--destructive`, …) plus brand tokens (`--brand-*`, runtime-overridden by `BrandingProvider`).
- **Status color**: `--status-*` (open, pending, resolved, closed, active, blocked, overdue, escalated, draft, plus the original scheduling set). `StatusBadge` is the only consumer — see §8.
- **Radius**: `--radius` + derived `--radius-sm/md/lg/xl`.
- **Elevation/shadow**: `--shadow-xs/sm/md/lg/xl`. Use Tailwind's `shadow-*` utilities which read these, or apply directly for custom elevation needs (e.g. `BulkActionBar`, drawers).
- **Animation**: `--duration-fast/base/slow` (120/200/320ms) and `--ease-standard`/`--ease-emphasized`. Prefer Tailwind's built-in `duration-*`/`ease-*` utilities, which already align with these values; only reach for the CSS variables directly in non-Tailwind contexts.
- **Typography/spacing**: Tailwind v4's default scale (`text-xs`…`text-3xl`, spacing 0–96) plus `--font-sans` (Plus Jakarta Sans, body) / `--font-display` (Outfit, headings). No custom scale — the audit found the *scale* sufficient; violations were inconsistent *usage*, which Sprint 2+ fixes module by module.

## 2. Page shell — `PageTemplate`

Every module list/index page renders through `components/shared/PageTemplate.tsx`:

```
Breadcrumbs → Title + description + primary/secondary actions → Stats slot → Filters slot → Content
```

Do not hand-roll `<AdminLayout><div className="p-6">…` — use `PageTemplate`'s props (`title`, `breadcrumbs`, `primaryAction`, `secondaryActions`, `stats`, `filters`, `children`).

## 3. Detail pages — `EntityDetailTemplate`

Every record detail page (booking, customer, job, invoice, staff, asset) renders through `components/shared/EntityDetailTemplate.tsx`: header (title, status badge, actions) → tabbed body (`sections: {id, label, content}[]`, conventionally Overview / Timeline / Notes / Attachments / History / Related Records). Pure layout — no business logic lives in this component.

## 4. Quick-view — `EntityDrawer`

For "peek without navigating" (row click → side panel), use `components/shared/EntityDrawer.tsx` — a themed `Sheet` with an optional tabbed body (`tabs: {id, label, content}[]`) and an actions footer. Works for Bookings, Customers, Jobs, Invoices, Staff, Assets alike.

## 5. Lists — `DataTable`

`components/shared/DataTable.tsx` is the **only** table implementation. It supports:

- Loading (`isLoading`) / empty (`emptyTitle`/`emptyDescription`/`emptyAction`) / error (`error` + `onRetry`) states — always wire all three from your query.
- Pagination (`pagination: {page, pageSize, total, onPageChange}`) — reuses the same footer pager pattern everywhere; do not build a page-specific pager.
- Sorting (`sort: {key, direction, onSortChange}` + per-column `sortable: true`).
- Bulk selection (`selection: {selectedKeys, onSelectionChange}`) — pair with `BulkActionBar`.
- Column visibility (`enableColumnVisibility`) via a dropdown checklist.
- A `toolbar` slot (render your `FilterBar` here) and a sticky header (`stickyHeader`, default on).
- A `sticky: "right"` column flag for a pinned actions column on wide tables.

Never introduce a second `<table>` in feature code. If `DataTable` is missing a capability, extend it — do not fork it.

## 6. Filters — `FilterBar`

`components/shared/FilterBar.tsx` standardizes search, a single status/category `Select`, a date-range picker (Popover + Calendar, range mode), quick-filter toggle chips, a future-ready "saved filters" dropdown, and a `children` slot for anything module-specific. Pass it as `DataTable`'s `toolbar` or `PageTemplate`'s `filters`.

## 7. Actions & confirmation

- `ActionBar` — grouped row/page actions.
- `BulkActionBar` — sticky "N selected" bar with bulk actions, pairs with `DataTable`'s `selection`.
- `ConfirmDialog` / `DeleteDialog` (`components/shared/ConfirmDialog.tsx`) — themed `AlertDialog` wrapper. **Replace every `window.confirm()`/`window.alert()` with one of these** as modules migrate in Sprint 2+.

## 8. Status system — `StatusBadge`

`components/shared/StatusBadge.tsx` is the single source of truth for status → color, keyed by a `StatusTone` (`info`/`warning`/`success`/`destructive`/`neutral`/`progress`). It ships a status→tone map covering the universal vocabulary (open, pending, assigned, ready, started, paused, completed, cancelled, approved, rejected, paid, draft, outstanding, overdue, blocked, warning, success, error) plus every domain synonym already in use (scheduled, en_route, waiting_assignment, ready_for_execution, unpaid, refunded, …). Unmapped statuses fall back to `neutral`; pass an explicit `tone` prop rather than adding a parallel local color map. **Local status color maps (`statusColors`, `STATUS_VARIANT`, `founderStatusBadgeClass`, etc.) are deprecated** and should be removed as their module migrates.

## 9. KPIs — `StatCard` / `KpiRow`

`StatCard` is a single KPI tile (label, value, delta, trend, icon, loading state). `KpiRow` lays out a responsive grid of them. Use for Dashboard, Analytics, and any queue-count strip instead of a page-specific stat grid.

## 10. Timeline — `Timeline`

`components/shared/Timeline.tsx` renders a connector-dot vertical timeline from `TimelineEvent[]` (`title`, `description`, `timestamp`, `actor`, `icon`, `tone`). Replaces bespoke feed markup in booking/job/assignment/commercial history views as those modules migrate.

## 11. Empty / loading / error / permission / offline states

Every data-driven view must be able to render all five states from `components/shared/`: `EmptyState`, `SkeletonRow` (loading), `ErrorState` (with `onRetry`), `PermissionDeniedState`, `OfflineState`. `DataTable` wires the first three internally; use the other two directly around page content when relevant (e.g. a 403 from the API, or `navigator.onLine === false`).

## 12. Navigation

- **Sidebar** (`components/layout/adminNavConfig.ts`): six functional groups — Operations, Commercial, Customers, People, Reports, Configuration — plus a standalone Dashboard entry and a collapsed "Customer Tools" group for one-time migration utilities. Every route must have a sidebar entry (the Assets orphan from the audit is fixed).
- **Breadcrumbs**: `PageBreadcrumbs` (thin wrapper over `ui/breadcrumb.tsx`), consumed automatically by `PageTemplate`/`EntityDetailTemplate` when `breadcrumbs` has more than one entry.
- **Command palette**: `CommandPalette`, mounted once in `AdminLayout`, opened with `Ctrl+K`/`Cmd+K`. Today it searches navigable admin destinations (nav search); record-level search (customers, bookings, invoices…) can be layered into the same shell later without a redesign.

## 13. Dialogs / drawers / overlays

Only use the shadcn/Radix primitives already in `components/ui/` (`dialog`, `alert-dialog`, `sheet`, `popover`, `dropdown-menu`, `command`, `tabs`, `select`, `checkbox`, `calendar`). Do not add a new overlay library. Destructive or "are you sure?" actions always go through `ConfirmDialog`/`DeleteDialog`, never `window.confirm()`.

## 14. Responsiveness

Every shared component in this document must degrade gracefully from desktop → laptop → tablet → large mobile using Tailwind's `sm:`/`md:`/`lg:` breakpoints (already the app's convention). `DataTable` scrolls horizontally on narrow viewports rather than breaking layout; `PageTemplate`/`EntityDetailTemplate` stack header actions below the title on `sm:` and below.

## 15. Accessibility

- Every interactive row/card/button gets a keyboard path (`tabIndex`, `onKeyDown` for Enter/Space) and an `aria-label` where the visible text isn't sufficient.
- Modals/drawers/dialogs rely on Radix's built-in focus trapping — never build a custom overlay that skips it.
- Status is never color-only: `StatusBadge` always renders a text label alongside its color.
- Touch targets follow the existing `Button` size scale (`sm`/default/`lg`) — avoid sub-32px custom tap targets.

## 16. Naming & file conventions

- Shared, cross-module components live in `src/components/shared/` and are re-exported from `src/components/shared/index.ts`. Import via `@/components/shared`, not deep paths.
- shadcn primitives stay in `src/components/ui/` untouched in spirit — extend via composition, not by editing generated primitives beyond what shadcn itself would regenerate.
- One component = one file, PascalCase filename matching the exported component name.
- Props for "extend the map, don't fork the component" components (`StatusBadge`, `DataTable`, `FilterBar`) should be additive — new capabilities are optional props with safe defaults so existing call sites keep compiling.

## Change control

Any new page-level UI need should be checked against this list first. If nothing here covers it, add the capability to the relevant shared component (or, rarely, add a new shared component and document it here) — never introduce a one-off pattern in feature code. Sprint 2+ module migrations should shrink local/bespoke UI code, not grow it.
