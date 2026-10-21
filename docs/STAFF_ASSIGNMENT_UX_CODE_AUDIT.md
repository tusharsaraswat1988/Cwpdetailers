# CWP Detailers — Staff Assignment UX + Functional Audit

## Executive recommendation

Redesign the dispatch workflow around one primary question: **which customer job needs a staff assignment, and what needs to happen next?** Keep backend task identities and role validation intact. Reduce competing controls and duplicate information, improve the responsive drawer, and make execution completion visible to admins through automatic refresh plus a reliable in-app notification path.

## Evidence reviewed (actual source files)

- [page drawer](https://github.com/tusharsaraswat1988/Cwpdetailers/blob/main/artifacts/cwp-platform/src/features/assign-services/pages/AssignServicesPage.tsx) — blob at audit time: `eb5fa904930d25f0631d549ca8c9fc92c7e20d30`
- [drawer shared](https://github.com/tusharsaraswat1988/Cwpdetailers/blob/main/artifacts/cwp-platform/src/components/shared/EntityDrawer.tsx) — blob at audit time: `9f4d3255696d2dd14f30aac0c9e4cc9148af019e`
- [kpi shared](https://github.com/tusharsaraswat1988/Cwpdetailers/blob/main/artifacts/cwp-platform/src/components/shared/KpiRow.tsx) — blob at audit time: `3c5fd35d9979d205b1b4b83c4abc8966c3e364a`
- [assignment service](https://github.com/tusharsaraswat1988/Cwpdetailers/blob/main/artifacts/api-server/src/lib/assignments/assignmentService.ts) — blob at audit time: `563f6520f8d3b6370abf38fd400a199e6b3b6c85`
- [execution service](https://github.com/tusharsaraswat1988/Cwpdetailers/blob/main/artifacts/api-server/src/lib/executions/executionService.ts) — blob at audit time: `112fabfc2cb1eb17c266bf83cb289010edf576b4`
- [event bootstrap](https://github.com/tusharsaraswat1988/Cwpdetailers/blob/main/artifacts/api-server/src/lib/job-orchestration/bootstrap.ts) — blob at audit time: `a30f153cded16640bf27f0432d97266ff35235fc`
- `artifacts/api-server/src/lib/assignments/assignmentTaskTypes.ts` — required task type rules.
- `artifacts/api-server/src/routes/assignments.ts` — assignment endpoints.
- `artifacts/api-server/src/lib/job-orchestration/jobOrchestrationService.ts` — completion-to-quality-review event handling.
- `artifacts/api-server/src/routes/notifications.ts` — user notification APIs.
- `artifacts/cwp-platform/src/features/operations-console/pages/OperationsControlCenter.tsx` —  refresh pattern used in the operational monitor.

## Findings and priorities

### P0 — Drawer tab overflow / clipping
**Evidence:** shared `EntityDrawer` uses `w-full sm:max-w-lg`; assignment detail passes six tabs (Overview, Assignment, Customer, Timeline, Activity, Notes). Screenshots show the end of the tab row clipped and a horizontal scrollbar.
**Change:** provide a wider responsive drawer for dispatch. Use a scrollable/scroll-snap tab strip or collapse secondary sections behind a "More" menu at narrow widths. Avoid horizontal scrolling for the drawer's main content. Use a sticky footer so the primary action remains reachable.
**Acceptance:** at 1366×768, 1280×720, and mobile widths, no essential label or action is clipped; drawer body and tab panel scroll independently; focus and keyboard navigation remain usable.

### P0 — The combined plan's two task selectors appear like duplicate work
**Evidence:** `getRequiredTaskTypes()` deliberately returns both `daily_cleaning` and `car_wash` for Daily Clean products with allocated/remaining washes. API task assignment validates each required task type separately and creates task-specific assignment + execution records.
**Change:** preserve separate task records but group them under one service-plan summary:
- Daily Clean — required role: Daily Car Cleaner
- Full Wash — required role: Car Washer
For every task, visibly show assigned/unassigned and staff member. Explain briefly: "This plan contains two kinds of work; assign a role-qualified person to each." If one worker can cover both roles, permit the same person in both selectors only if backend role checks allow it.
**Acceptance:** no duplicate generic "Select staff" fields without a task name/context; already-covered task is not re-assigned; CTA says "Assign both tasks" or "Assign 1 remaining task."

### P0 — No reliable admin completion update visible in this flow
**Evidence:** `completeExecution()` persists status=completed, completedAt and timeline, then publishes `ExecutionCompleted`. Job Orchestration subscribes and moves the job into quality review. The domain event publishers are explicitly publish-only. The Staff Assignment page's pending/assigned queries have no `refetchInterval`; Operations Control Center does configure refresh.
**Change:** add query refresh (e.g., 20–30 seconds while the page is visible) for assignment/execution summaries. Add an idempotent admin notification consumer for execution completion, linking to the job. Keep "Field work completed" separate from "Quality approved" and "Ready for billing." Include customer, vehicle, task, staff, and completion time.
**Acceptance:** a completed task appears without manual reload; an authorised admin receives one in-app completion alert, not duplicate alerts after refetch/reconnect; quality review is not mislabeled as final approval.
**Caveat:** this audit confirms no admin notification creation/delivery in the inspected completion-event path. A broader repo-wide consumer or runtime configuration may exist elsewhere and should be checked before adding a duplicate notification mechanism.

### P1 — Too many equal-weight controls above the queue
**Evidence:** six KPI cards, search, status, technician, date, city, priority, service type, quick filters, table column selector, row selection and bulk actions compete for attention.
**Change:** default view: three actionable metrics at most (Needs assignment, In progress, Delayed); search + status + priority; "More filters" for technician, date, city and service type. Show bulk actions only when relevant rows are selected. Keep column-visibility control secondary.
**Acceptance:** first viewport clearly exposes waiting jobs and one primary action without needing to scan every filter.

### P1 — Drawer repeats data and asks admins to navigate tabs
**Evidence:** Overview already shows service, schedule, technician, task, address, booking and location ID. Customer tab repeats customer, vehicle and address. Assignment tab contains the core assignment interaction.
**Change:** Overview becomes a compact summary. Put the task assignments directly below the plan summary. Keep Timeline and Activity in a secondary tab/accordion. Remove repeated customer/address content unless the other view adds actionable detail.
**Acceptance:** assignment action can be completed without visiting another tab; context such as vehicle/address remains visible.

### P1 — "Assign next waiting" is not intelligent dispatch
**Evidence:** selection chooses the first high-priority pending item, otherwise the first returned record. No workload, skill availability, travel time or geographic optimization is visible in this selection function.
**Change:** keep the shortcut but describe it as "Open next waiting job" unless true dispatch ranking is implemented. Sort by priority, overdue age and scheduled time; show the reason for recommended ordering. Do not claim staff auto-balancing.
**Acceptance:** next-job selection is deterministic, explainable, and tested for empty queues/filters.

### P1 — Missing location error lacks recovery action
**Evidence:** staff pickers are disabled if serviceLocationId is missing; overview shows "Missing — cannot assign."
**Change:** show a blocking alert with a direct "Fix service address" action and explain that assignment is blocked until the job has a valid address.
**Acceptance:** the user never mistakes a disabled selector for loading or a staff-availability problem.

### P1 — Statuses need operationally clear language
**Evidence:** page has Waiting assignment, Pending acceptance, Ready for execution; actual execution is managed elsewhere.
**Change:** consistently distinguish "Awaiting staff", "Assigned / awaiting acceptance" (only if acceptance exists as a real state), "Ready to start", "In progress", "Field work completed", and "Quality review". Do not call assignment "in progress."
**Acceptance:** each displayed label maps unambiguously to a backend state and a user action.

### P1 — Stale counts and status inconsistencies
**Evidence:** KPI counts are derived from currently fetched pending and assigned records. Some values are local derived counts, and assigned rows are converted with `scheduledDate: null`, `scheduledTime: null`, and `priority: null`. This can make common date/priority views inconsistent across waiting vs assigned rows. The current priority sort also puts normal before high in ascending order.
**Change:** confirm endpoint scope/pagination semantics, and preserve scheduling/priority fields in assigned records where available. Use server aggregates for truly global KPI totals or label counts as current-view totals. Fix sort order to place high priority first when intended.
**Acceptance:** KPI totals and filters have documented scope and match the backend query result; priority ordering is verified with fixtures.

### P2 — Date can be wrong near IST midnight
**Evidence:** `TODAY()` uses `new Date().toISOString().slice(0, 10)`, which is UTC-based, while CWP's operational day is India-local in other backend code.
**Change:** use the app's established IST date helper or a single shared local-business-date utility for date filtering, overdue detection and "Scheduled today".
**Acceptance:** test at e.g. 00:15 IST and 23:50 IST; "today" agrees with backend scheduling.

### P2 — Visual system lacks an action hierarchy on this page
**Change:** use one primary solid button; secondary actions outlined or text-only; reserve amber/red for genuine warnings/high priority; use neutral surface cards and subtle dividers instead of stacking outlines and shadows; maintain consistent control height, radius, typography and focus ring. Remove redundant badges when title or metric already communicates the same status.
**Acceptance:** one obvious primary action per context; all interactive controls have visible focus, readable labels and sufficient contrast.

## Proposed page architecture

1. **Header:** Staff Assignment, concise helper text, one CTA "Open next waiting job".
2. **Compact summary:** Needs assignment · In progress · Delayed. Make the first and last actionable.
3. **Queue toolbar:** search, status, priority, "More filters".
4. **Queue table:** Customer/vehicle, service plan, scheduled date/time, priority, assignment progress, action. Keep row click for quick view.
5. **Assignment drawer:** service plan + vehicle/address; grouped task assignment rows; optional notes; sticky CTA. Secondary details grouped under Timeline / Activity.
6. **Completion feedback:** in-app alert + auto-refreshed operational state. Completion and quality approval are distinct states.

## Design principles to use

- Hick's Law: reduce equally prominent choices.
- Progressive disclosure: expose uncommon filters and audit detail only when needed.
- Recognition over recall: label each role/task explicitly; don't make admin infer why two selectors appear.
- Visibility of system status: show assigned, in progress, completed and quality-review states live.
- Error prevention: block only when necessary and pair every blocker with a recovery action.
- Consistency: reuse shared admin components and semantic color tokens, but fix their responsive behavior when shared defaults do not fit dispatch.
- Fitts's Law: keep the primary assignment CTA in the drawer's reachable sticky footer.

## Implementation guardrails

- Do not change the backend's required task types or merge task identities merely to reduce form fields.
- Do not rewrite booking, billing or execution ownership as part of the UX pass.
- Audit access control and role validation for any new notification consumer.
- Add/adjust tests for task coverage, already-assigned task behavior, location blocker, queue sort, timezone, notification idempotency and refresh.
- Test the actual running UI, not only successful TypeScript compilation.
- Verify repository HEAD/branch and current working-tree changes before any code push; this is an audit, not authorization to deploy.

## Acceptance checklist

- [ ] No clipping or horizontal drawer scrollbar at supported viewport sizes.
- [ ] Assignment for Daily Clean + Wash clearly shows two named tasks under one plan.
- [ ] Role-mismatched or inactive staff cannot be assigned.
- [ ] Same qualified worker across both task selectors behaves correctly if permitted by current rules.
- [ ] Missing address has clear recovery path.
- [ ] Assignment status refreshes without reloading.
- [ ] Completion event creates at most one admin alert and changes the visible state.
- [ ] "Completed" is distinct from "Quality approved" and "Ready for billing."
- [ ] KPI scope, date filters and priority sorting are tested and truthful.
- [ ] Primary action remains visible and keyboard-accessible.
- [ ] Mobile/tablet layouts and empty/loading/error states are checked.

## Decision

**Proceed with a scoped UX redesign plus completion visibility fix.** Treat clipping and live completion awareness as P0. Treat filter reduction, task grouping, drawer simplification and status clarity as P1. Implement against the current code and shared design system—not the reports alone.
