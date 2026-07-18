# Phase 2.4 — Job Orchestration → Operations Decision Center

UX-only rewrite of `/admin/jobs`. No backend, database, route, permission, or
business-logic changes. Reference frozen modules: Bookings, Staff Assignment
(Assign Services), Operations Control Center.

Files touched:

- `artifacts/cwp-platform/src/pages/admin/JobOrchestrationPage.tsx` — full rewrite
- `artifacts/cwp-platform/src/features/job-orchestration/api.ts` — additive only (`opsStatusTone` helper)

---

## 1. Existing Screen Audit

| Area | Before | Verdict |
|---|---|---|
| Layout | `AdminLayout` + `PageActionHeader` + ad-hoc `Card` grid + `Tabs` queues + `Dialog` manage panel | **Remove** — bespoke, not aligned with Page Contract |
| KPIs | 3 client-computed `Card`s (total/review/escalated), scoped to current tab only | **Replace** — inaccurate (only reflects current queue, not the whole system); needed decision-oriented KPIs |
| Queue switch | 7-tab `Tabs` (active/quality_review/reopened/escalated/completed/ready_for_billing/all) | **Merge** into FilterBar status + quick filters — tabs duplicate what filters already do and hide jobs that match a queue but aren't in the active tab |
| List | Card grid (`JobCard`), 1 job per card, no sorting/column control/bulk select | **Replace** with `DataTable` — needed sorting, bulk actions, column visibility, pagination for scale |
| Detail/manage | Single `Dialog` mixing priority change + reason textarea + all actions + plain `<ul>` timeline | **Replace** with `EntityDrawer` (tabs) — mixes too many concerns into an undifferentiated modal; timeline wasn't using the shared `Timeline` component |
| Priority badge | Local `PriorityBadge`/`OpsBadge` components with hand-rolled `Badge` variants | **Remove** — violates "StatusBadge only, no local status maps"; replaced with `StatusBadge` + explicit tone |
| Escalate/Cancel reason | Single shared `Textarea` field reused across reopen/approve/escalate/cancel with placeholder text explaining which action needs what | **Replace** — confusing and error-prone (e.g. blank reason silently accepted for escalate until button-disable kicks in); now a dedicated `ConfirmDialog` per action, exact copy per action |
| Timeline | Plain `<ul>` mixing field + ops events with no visual distinction | **Split** into Business Timeline (`Timeline`) vs Activity (`ActivityFeed`), matching the Bookings/Ops Center pattern |
| Dependencies | Shown as one line of plain text ("Depends on job #X") in the card only | **Keep the signal, redesign the visual** — build a real progress pipeline + dependency resolution status using existing fields (no backend change) |
| Approvals | Not surfaced at all (approve action existed, but no history/notes view) | **Add** — Approvals tab derived from ops timeline (`JOB_APPROVED` entries) |
| Bulk actions | None | **Add** — Approve / Reopen / Ready for Billing / Export, gated by the same eligibility rules as the row/drawer actions |
| Ownership / dependency mutation endpoints | Not wired into UI at all | **Left unwired** — see Remaining Technical Debt; avoids inventing a reviewer-assignment UX without a reviewer directory |

---

## 2. UX Improvements

- **Page Contract compliance**: `PageTemplate → Breadcrumbs → Header (+Refresh/Export) → Needs Attention → KPI Row → FilterBar → DataTable → BulkActionBar → EntityDrawer → Timeline`. No bespoke layout containers remain.
- **One universe query** (`fetchJobs({ queue: "all", limit: 500 })`) replaces per-tab refetching; all filtering/sorting/pagination happens client-side against this set — this is what makes cross-referencing dependencies possible (see below) without any new backend endpoint.
- **StatusBadge everywhere** for opsStatus, priority, approval state, and health chips — zero local color maps in feature code.
- **One-click quick actions in the row** ("Approve" / "Ready" buttons appear inline only when eligible) — cuts the most common action from 2 clicks (open drawer → click action) to 1.
- **Reason dialogs are action-specific** (`ConfirmDialog` + inline `Textarea` in the description slot) instead of one shared ambiguous textarea for 4 different actions.

## 3. Intelligent UX Recommendations (implemented)

| Recommendation | Principle | Operational benefit |
|---|---|---|
| Inline row "Approve"/"Ready" quick actions | Fewer clicks / recognition over recall | Supervisors clear the two highest-volume actions without opening the drawer |
| "Blocked" derived from cross-referencing `dependsOnExecutionId` against the same job universe | Error prevention / system status | Surfaces silent dependency risk that was previously only a one-line text hint, with zero backend change |
| "Overdue Review" KPI (`qualityReviewStartedAt` > 48h) | Speed / SLA visibility | Turns a buried timestamp into an actionable queue instead of requiring a supervisor to eyeball dates |
| Approval history reconstructed from ops timeline (no raw audit dump) | Progressive disclosure | Gives context (previous approvals across reopen cycles) without exposing the raw timeline table |
| Dependency pipeline visualization (Field Execution → Quality Review → Approval → Ready for Billing) | Recognition over recall | Replaces "Depends on job #12" plain text with a scannable, honest 4-step progress ladder built only from fields that exist on `Job` |
| Bulk actions pre-validate eligibility and report skipped count | Error prevention | Prevents "nothing happened" confusion when a bulk action partially applies |
| CSV Export (page-level and selection-level) | Operational reporting | Lets a supervisor hand billing/finance a filtered list without a new export endpoint |

## 4. Enterprise UX Opportunities

**High priority**
- Reviewer/ops-owner directory + "Assign Reviewer" bulk action (backend `POST /jobs/:id/ownership` already exists — blocked only by lack of an admin-user picker component in this page's data scope).
- Saved filter presets (FilterBar already supports `savedFilters` — wire to a per-admin preference once a preferences store exists).

**Medium priority**
- Complaint/quality-issue chip — Ops Control Center already fetches complaints separately; joining that into Job Orchestration rows would need a shared query, not a Job Orchestration API change.
- SLA countdown badge (time remaining before a job crosses the 48h overdue threshold) rather than a binary Overdue flag.

**Low priority**
- Sticky/pinned "My jobs" quick filter for ops-owner-assigned jobs once ownership is exposed in the UI.
- Per-column density/compact toggle for high-volume franchise queues.

## 5. Future UX Opportunities (tracked, not implemented)

- Approval automation (auto-approve on quality score threshold)
- AI quality review of photo/notes evidence
- Predictive escalation (flag jobs likely to be escalated before they are)
- Auto-ready-for-billing when approval + no open dependency
- Smart dependency warnings (proactively block/notify before a supervisor tries to approve a blocked job)
- Risk prediction (churn/complaint risk scoring per job)
- Notification center integration for Needs Attention items

## 6. Components Reused

`PageTemplate`, `FilterBar`, `DataTable`, `KpiRow`/`StatCard`, `BulkActionBar`, `EntityDrawer`, `Timeline`, `ActivityFeed`, `StatusBadge`, `ConfirmDialog`, `ActionBar`, `OfflineState`, `Can`. No new shared component was created.

## 7. Shared Components Extended

None modified. `ActionBar` (previously built but unused by any page) is now consumed for the drawer's Actions tab — its own doc comment already anticipated this ("Job Orchestration manage actions").

## 8. Files Modified

- `artifacts/cwp-platform/src/pages/admin/JobOrchestrationPage.tsx` (full rewrite, ~780 lines)
- `artifacts/cwp-platform/src/features/job-orchestration/api.ts` (additive: `opsStatusTone()` helper only)

No route, nav, permission, or backend file was touched.

## 9. Breaking Changes

None. Same route (`/admin/jobs`), same permission gate (`bookings`/`edit`), same API surface consumed (`fetchJobs`, `fetchJobTimeline`, `reopenJob`, `escalateJob`, `changeJobPriority`, `approveJob`, `markJobReadyForBilling`, `cancelJob`).

## 10. Before vs After Summary

| | Before | After |
|---|---|---|
| Layout | Card grid + Dialog | PageTemplate list pattern |
| KPIs | 3, current-tab-only | 6 Needs Attention + 4 pipeline overview, all clickable filters |
| Table | None (cards) | Sortable/paginated/column-toggle `DataTable` |
| Bulk actions | None | Approve / Reopen / Ready for Billing / Export |
| Detail view | Single mixed Dialog | 6-tab `EntityDrawer` (Overview, Progress & Dependencies, Approvals, Timeline, Activity, Actions) |
| Status/priority display | Local `Badge` variants | `StatusBadge` everywhere |
| Dependency visibility | 1 line of text | 4-step visual pipeline + resolution status |
| Escalate/Cancel reason UX | 1 shared ambiguous textarea | Per-action `ConfirmDialog` with dedicated copy |

## 11. Build Status

- `pnpm --filter @workspace/cwp-platform run typecheck` — same pre-existing failures as documented in `AGENTS.md` (unbuilt `@workspace/api-client-react` dist + unrelated legacy `any` errors across other pages). **No new errors introduced by this change** (confirmed via `Select-String "JobOrchestrationPage|job-orchestration"` against the full typecheck output — zero matches).
- `pnpm --filter @workspace/cwp-platform exec vite build` — **succeeds cleanly**, 4547 modules transformed, no errors or warnings referencing this page. This matches the app's actual runtime build path (`pnpm dev` uses esbuild, not `tsc`).

## 12. Remaining Technical Debt

- **"Blocked" and dependency resolution are derived only from the currently-fetched 500-job universe.** If a dependency job falls outside that window (edge case on very large datasets), it's conservatively treated as still-blocking. A dedicated `GET /jobs/:id` lookup could resolve this exactly, at the cost of N extra calls — deferred since current data volumes don't need it.
- **No frontend wrapper for `POST /jobs/:id/ownership` or `POST /jobs/:id/dependency`** — both exist on the backend but were intentionally not exposed in this pass (no reviewer directory / no "invent actions" per the brief). Tracked under Enterprise UX Opportunities.
- **Client-side pagination/sorting over a capped 500-row fetch** rather than server-side — acceptable at current scale but should move server-side if job volume grows well past that.
- **`opsStatusTone` is a small UX-only helper duplicating the intent of `StatusBadge`'s internal map** — flagged here since `docs/UI_CONSTITUTION.md` prefers extending the shared map; not done in this pass to honor "no backend/shared-component changes without approval" scope, since `StatusBadge`'s map is shared infrastructure across every module.
