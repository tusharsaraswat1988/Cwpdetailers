# CWP UI Gap Analysis

**Baseline:** Current implementation as of June 2026  
**Target:** CWP_WORLD_CLASS_PRODUCT_EXPERIENCE_PLAN.md  
**Scope:** UI/UX only — no business logic, no schema changes  

---

## How to Read This Document

Every gap is tagged:

- **🟢 Quick Win** — < 1 day. Isolated change, no new architecture.
- **🟡 Medium** — 1–3 days. Self-contained component or screen rewrite.
- **🔴 Major** — > 3 days. New screen, new navigation pattern, or affects multiple files.
- **✅ Already Done** — Completed in Phase 0.

Priority order: **Customer Mobile → Staff Mobile → Daily Ops → Admin**

---

## Priority 1: Customer Mobile Experience

### What Phase 0 Already Delivered
- ✅ `AppShell`, `AppBar`, `BottomNav` components created
- ✅ `CustomerLayout` migrated to `AppShell` with 5-tab bottom nav
- ✅ `CompletionRing`, `ActivityFeed`, `StatusBadge`, `ErrorState`, `WalletChip` components
- ✅ Customer Dashboard redesigned with hero "Next Service" card, stat chips, completion rings in subscription cards, activity feed
- ✅ PWA manifests (`manifest-customer.json`, `manifest-staff.json`) created
- ✅ CSS tokens for app shell dimensions (`--app-bar-height`, `--bottom-nav-height`, safe-area utilities)

---

### C-01: Bottom Nav — Current vs Target

**Current (`CustomerLayout.tsx`):**
```
Home | Services(Assets) | Book(FAB) | History | Support
```
**Target (Plan §4.1):**
```
Home | Services | Book(FAB) | Wallet | Account
```

| Gap | Effort |
|-----|--------|
| "Services" tab still points to `/customer/assets` (vehicles/solar list), not the new Services screen | 🟡 Medium — need new `/customer/services` page |
| No "Wallet" tab — wallet info buried in Home dashboard | 🟡 Medium — need new `/customer/wallet` page |
| No "Account" hub — History, Invoices, Assets, Support are separate tabs | 🔴 Major — full IA restructure |
| "Support" tab on bottom nav consumes space that could be "Wallet" | 🟢 Quick Win — swap nav items when Wallet page exists |

---

### C-02: Book Service Flow

**Current (`BookService.tsx`):**
- Single-page scrolling form
- 2×2 service type grid (buttons), then dropdowns stacked vertically
- Date/time as `<input type="date/time">` side by side
- Confirm button at bottom
- Confirmation screen: animated check ✅ (already good)
- All on one page — no step progress

**Target (Plan §2.1 C-03):**
- Step-by-step wizard (4 steps: Type → Asset → Date/Time → Review)
- Step progress ring at top
- One decision per screen
- Back navigation per step
- Price visible from step 1

| Gap | Effort |
|-----|--------|
| No step flow — all fields on one page | 🔴 Major — rewrite BookService as step wizard |
| Date picker is `<input type="date">` (tiny, non-visual) | 🟡 Medium — replace with visual date grid + time slot chips |
| No step progress ring indicator | 🟢 Quick Win — add StepProgress component (once step flow built) |
| Confirmation screen exists but no back-to-dashboard link | 🟢 Quick Win — add "View booking" link on success screen |

---

### C-03: Service History

**Current (`History.tsx`):**
- Flat card list (no grouping)
- Before/after photos as 40×40px thumbnails — very small
- No timeline structure
- Missing `EmptyState` component (plain text "No service history yet")
- `Badge` used directly instead of `StatusBadge`
- Photo pair is horizontal but not a comparison slider

**Target (Plan §2.1 C-06):**
- Timeline grouped by month
- Before/after side-by-side larger, with comparison slider
- EmptyState with illustration + Book CTA
- StatusBadge for status

| Gap | Effort |
|-----|--------|
| No timeline grouping by month | 🟡 Medium — group `data.data` by month, add month headers |
| Photos are 40×40px thumbnails | 🟢 Quick Win — increase to 80×80px minimum, tap-to-expand |
| Missing EmptyState component (using plain text) | 🟢 Quick Win — swap with `EmptyState` component |
| `Badge` not using `StatusBadge` | 🟢 Quick Win — 5-minute swap |
| No before/after comparison slider | 🔴 Major — new BeforeAfterSlider component |

---

### C-04: Wallet Screen

**Current:** No dedicated wallet screen. Wallet info in Dashboard as a Card section (balance + last 5 transactions). "Contact CWP to recharge" message.

**Target (Plan §2.1 C-04):**
- Dedicated `/customer/wallet` route in bottom nav
- Large balance display with trend
- Full transaction list
- Dues section with invoice links
- Styled info card for recharge info

| Gap | Effort |
|-----|--------|
| No `/customer/wallet` page exists | 🟡 Medium — create new page, move wallet card content, add full tx list |
| Nav item missing | 🟢 Quick Win — once page exists, update `CustomerLayout` nav |
| "Contact CWP" is a plain `<p>` | 🟢 Quick Win — wrap in styled `InfoCard` component |

---

### C-05: Account Hub

**Current:** No account hub. Assets, History, Invoices, Complaints are all separate bottom-nav destinations.

**Target (Plan §2.1 C-05):**
- `/customer/account` hub screen with menu list
- Profile header with avatar initials
- Sub-screens stack behind Account tab

| Gap | Effort |
|-----|--------|
| No Account hub page | 🔴 Major — new page + sub-screen stack navigation |
| History, Invoices, Assets, Support remain top-level nav | 🔴 Major — IA restructure (move routes under /account) |
| No user avatar / profile display anywhere | 🟢 Quick Win — initials avatar in AppBar trailing |

---

### C-06: Invoices Screen

**Current (`Invoices.tsx`):** Basic list + PDF download link. Due amount banner.  
**Target:** Invoice cards with status badge + styled PDF button. No major structural change needed.

| Gap | Effort |
|-----|--------|
| Plain list items — no card style | 🟢 Quick Win — wrap in Card, add StatusBadge |
| Missing EmptyState | 🟢 Quick Win |

---

### C-07: Complaints / Support Screen

**Current (`Complaints.tsx`):** List + Dialog form for new complaint.  
**Target (Plan §2.1 C-07):** Bottom sheet (not dialog) + thread-style detail.

| Gap | Effort |
|-----|--------|
| Dialog → Bottom sheet on mobile | 🟡 Medium — swap `Dialog` for `Sheet` on mobile |
| Status not using `StatusBadge` | 🟢 Quick Win |
| No thread-style detail view per complaint | 🔴 Major — new complaint detail screen |

---

### C-08: Assets Screen

**Current (`MyAssets.tsx`):** Tab split (vehicles / solar sites). Form dialogs to add. Basic card list.  
**Target:** Visual cards with photo placeholder, service history link per asset.

| Gap | Effort |
|-----|--------|
| Cards have no visual style differentiation | 🟡 Medium — redesign asset cards with icon, color band |
| No photo on vehicle/solar cards | 🟢 Quick Win — placeholder icon-based visual |
| No per-asset service history link | 🟡 Medium — add link filtered to that asset |

---

### C-09: Registration / Onboarding

**Current (`Register.tsx`):** Single form → auto-login → dashboard. No wizard.

**Target:** 3-step post-registration onboarding (Add asset → Explore services → Wallet info).

| Gap | Effort |
|-----|--------|
| No onboarding wizard after registration | 🔴 Major — new OnboardingWizard component + `onboardingComplete` flag |
| No `localStorage` flag to skip wizard on subsequent visits | included in above |

---

### C-10: Missing Customer-Scoped Screens

| Missing Screen | Plan Reference | Effort |
|----------------|---------------|--------|
| `/customer/services` — Active plans + completion rings | Plan §2.1 C-02 | 🟡 Medium |
| `/customer/wallet` | Plan §2.1 C-04 | 🟡 Medium |
| `/customer/account` hub | Plan §2.1 C-05 | 🔴 Major |

---

## Priority 2: Staff Mobile Experience

### S-01: Staff Navigation — Wrong Paradigm

**Current (`StaffLayout.tsx`):**  
Uses `PanelShell` → dark sidebar (desktop) + hamburger Sheet (mobile). **This is the admin navigation pattern** applied to a field-worker interface.

**Target (Plan §2.2):**  
4-tab bottom nav: Today | Jobs | Earnings | Profile

| Gap | Effort |
|-----|--------|
| `StaffLayout` uses sidebar, not bottom nav | 🔴 Major — replace PanelShell with AppShell + BottomNav |
| Hamburger menu on mobile requires 2 taps to navigate | 🔴 included above |
| No dedicated Earnings or Profile screen | 🔴 Major — 2 new screens |
| Attendance + Performance are separate pages (admin-style) | 🟡 Medium — merge into Profile screen |

---

### S-02: Staff Dashboard — Action Button Sizes

**Current (`StaffDashboard.tsx`, lines 200–229):**
```tsx
<Button size="sm" variant="outline" className="text-xs h-7">
```
Button height: **`h-7` = 28px**. Plan requires **minimum 48–52px** on mobile.

| Gap | Effort |
|-----|--------|
| All action buttons are `h-7` (28px) — far below touch target minimum | 🟢 Quick Win — change to `h-12` or `h-14`, full-width on mobile |
| Buttons are small secondary inline buttons, not primary CTA | 🟢 Quick Win — elevate "Start Job" / "Complete" to full-width primary |
| Photo upload uses invisible `<input>` overlay — works but no visual feedback | 🟡 Medium — add upload progress visual + preview |

---

### S-03: Staff Dashboard — Job Focus Mode

**Current:** All jobs shown as equal-weight list. 3 stat cards at top. Tabs: Today / Upcoming / Done.

**Target (Plan §2.2 S-01):** First job in "Today" fills 80% of screen. Remaining jobs collapsed. Current job is hero card.

| Gap | Effort |
|-----|--------|
| No job focus mode — first job same visual weight as others | 🟡 Medium — detect `activeJob` (in_progress/en_route), render as hero card |
| Stats grid (3 cards) takes space that should show active job | 🟢 Quick Win — shrink stats to horizontal row of chips |
| Tabs at top require extra tap to switch — should be secondary | 🟡 Medium — move tab switch below active job hero |
| Contact icons (call, navigate) missing from job cards | 🟢 Quick Win — add phone/map icon buttons if `customerPhone` + `address` present |

---

### S-04: Staff Dashboard — Duplicate statusColors

**Current:**  
`statusColors` is defined separately in `StaffDashboard.tsx` (line 20) and `StaffSchedule.tsx` (line 17), and again implicitly in `CustomerHistory.tsx`.  
`StatusBadge` component exists in `src/components/shared/StatusBadge.tsx`.

| Gap | Effort |
|-----|--------|
| 3 separate `statusColors` objects + `Badge` usage — should use `StatusBadge` | 🟢 Quick Win — replace `Badge` + `statusColors` with `<StatusBadge status={...} />` across all 3 files |

---

### S-05: Staff Schedule Screen

**Current (`Schedule.tsx`):** Flat list of assignments. No visual differentiation. Separate page.

**Target:** Merged into "Jobs" tab with Today/Upcoming/Completed segments.

| Gap | Effort |
|-----|--------|
| Schedule is a duplicate of Dashboard's "upcoming" tab | 🟡 Medium — deduplicate; `Schedule` becomes `/staff/jobs` unified view |
| No date grouping on the schedule | 🟢 Quick Win — group by date with date headers |

---

### S-06: Staff Performance + Attendance Pages

**Current:**  
- `Attendance.tsx` — monthly grid, mark attendance. Separate nav item.  
- `Performance.tsx` — KPIs + leaderboard. Separate nav item.

**Target:** Both merged into "Profile" screen. Attendance mark = one tap.

| Gap | Effort |
|-----|--------|
| Two admin-style separate pages instead of one Profile hub | 🟡 Medium — merge into Profile component with accordion sections |
| Attendance mark is a dedicated page navigation — too heavy for a daily tap | 🟡 Medium — surface "Mark Attendance" as one-tap button at top of Profile |

---

### S-07: Missing Staff Screens

| Missing Screen | Plan Reference | Effort |
|----------------|---------------|--------|
| Earnings screen (`/staff/earnings`) | Plan §2.2 S-03 | 🟡 Medium |
| Profile hub (`/staff/profile`) combining attendance + performance | Plan §2.2 S-04 | 🟡 Medium |
| Offline sync indicator banner | Plan §2.2 S-05 | 🟢 Quick Win (UI only) |

---

## Priority 3: Daily Operations Experience

### D-01: DailyOps — Manual Trigger Buttons are Too Prominent

**Current (`DailyOps.tsx`, lines 148–179):**  
3 prominent action buttons ("Refresh", "Run today's schedule", "Full daily tick") are visually dominant at the top. This makes the page feel like a control panel that needs operator intervention, not an autonomous monitoring dashboard.

**Target (Plan §2.3 A-03):** Monitoring-first. Stats and status are the hero. Triggers are secondary/destructive-zone actions.

| Gap | Effort |
|-----|--------|
| "Run today's schedule" is a primary CTA button at the top | 🟢 Quick Win — demote to secondary button, move to overflow/actions menu |
| No completion ring showing today's progress (e.g. 18/24 completed) | 🟢 Quick Win — add `CompletionRing` using `todayDailyBookings` completed/total |
| 4 stat cards have inconsistent icon sizing and no trend/context | 🟢 Quick Win — add progress text beneath each card |
| Scheduler blockers list shows `Sub #123` instead of customer name | 🟡 Medium — enrich blocker data (needs API enhancement, skip for now) |
| Off-day banner + "Run schedule" disabled is good — but unclear why | 🟢 Quick Win — add tooltip/description on disabled button |

---

### D-02: DailyOps — Unassigned Vehicles Action

**Current:** Each unassigned vehicle has a "Assign staff" button linking to `/admin/customers/:id`. User must navigate to customer detail, find subscription, assign staff. Multi-step.

**Target:** Direct staff assignment inline or quick-assign dialog.

| Gap | Effort |
|-----|--------|
| "Assign staff" navigates away from DailyOps to a different page | 🟡 Medium — inline assignment (sheet/popover with staff selector) |

---

### D-03: DailyOps — Visual Completion Progress

**Current:** Stats are 4 static count cards. No visual completion status.

| Gap | Effort |
|-----|--------|
| No ring/progress showing today's completion rate | 🟢 Quick Win — `CompletionRing(completed, total)` as hero stat |
| Stat cards use different icon colors (green, amber, primary, blue) with no consistent logic | 🟢 Quick Win — standardize: green=good, amber=warning, red=action needed |

---

### D-04: Admin Dashboard — No Daily Ops Summary Block

**Current (`admin/Dashboard.tsx`):**  
KPI grid has "Active Jobs" count. Daily cleaning ops are separate page entirely.

**Target (Plan §9.1):** Command Center's "Today's Operations" section shows daily cleaning progress inline.

| Gap | Effort |
|-----|--------|
| No daily cleaning completion widget on main dashboard | 🟡 Medium — add "Today's Cleaning" mini-card linking to DailyOps |
| No blocked subscription count with direct action link on dashboard | 🟡 Medium — pull from health data, surface in alert strip |

---

## Priority 4: Admin Experience

### A-01: Admin Dashboard — Missing Alert Banner

**Current:** Open complaints, pending dues, expiring subs are all scattered in different KPI cards. No consolidated "Action Required" panel.

**Target (Plan §2.3 A-01):** Top alert banner with actionable items (unassigned bookings, blocked subs, old complaints).

| Gap | Effort |
|-----|--------|
| No "Alerts" consolidated banner at top of dashboard | 🟡 Medium — add `AlertBanner` component pulling from existing data |
| Blocked subscriptions not surfaced on dashboard at all | 🟢 Quick Win — add paused sub count to subscription health strip |

---

### A-02: Admin Dashboard — Domain Tabs

**Current:** Single monolithic dashboard page covering everything.

**Target:** Domain tabs within Command Center (Operations / Finance / Daily Cleaning / Solar / Support / Staff / Growth).

| Gap | Effort |
|-----|--------|
| No domain-scoped views — all metrics on one page | 🔴 Major — tab-based dashboard with domain filter |

---

### A-03: Admin — No Side Panel Pattern

**Current:** Booking detail, customer detail — all navigate to new full pages.

**Target (Plan §2.3):** Record detail opens in 480px right side panel. No full page navigation for records.

| Gap | Effort |
|-----|--------|
| No side panel component exists | 🔴 Major — build `SidePanel` component + wire to bookings + customers |

---

### A-04: Admin — No Command Palette

**Current:** No global search. Users must navigate to specific section to find a booking, customer, or staff record.

**Target (Plan §2.3 A-07):** ⌘K command palette overlay.

| Gap | Effort |
|-----|--------|
| No command palette / global search | 🔴 Major — build `CommandPalette` + search endpoints |

---

### A-05: Admin — Sidebar Has 22 Items Flat

**Current (`AdminSidebar.tsx`):**  
22 nav items across 3 groups (Operations, Network, Config). Groups have labels but no visual hierarchy difference. Finance items (Invoices, Dues, Expenses, Quotations) are 4 separate sidebar entries.

**Target:** Finance grouped under a Finance hub. Sidebar groups visually distinct.

| Gap | Effort |
|-----|--------|
| Invoices, Dues, Expenses, Quotations are 4 separate sidebar entries | 🟡 Medium — create Finance hub page that links to all 4, replace with 1 sidebar entry |
| Sidebar group labels are small uppercase text — low visual hierarchy | 🟢 Quick Win — add left border accent, increase contrast |
| Operations section has 11 items — too long | 🟡 Medium — split after Daily Cleaning; Finance becomes its own group |

---

### A-06: Admin — Inconsistent Page Headers

**Current:** Some pages use `PageHeader` component. Many use raw `<h1>` + `<p>` inline. No consistent CTA placement.

**Target (Plan §2.3 A-07):** Every admin page has `PageHeader` with title + description + primary action button.

| Gap | Effort |
|-----|--------|
| Inconsistent page header across admin pages | 🟢 Quick Win — audit + apply `PageHeader` to pages missing it |

---

### A-07: Admin — Bookings Board lacks Kanban View

**Current (`features/bookings/pages/Bookings.tsx`):** DataTable with filters. No lane/Kanban view.

**Target (Plan §2.3 A-02):** Toggle: Table view ↔ Status lane view.

| Gap | Effort |
|-----|--------|
| No Kanban status lanes | 🔴 Major — new KanbanBoard component for bookings |

---

### A-08: Admin — Customer Detail lacks 360 Timeline

**Current (`admin/CustomerDetail.tsx`):** Form-heavy layout. Wallet credit panel. Subscription list. No unified timeline.

**Target (Plan §2.3 A-04):** Activity timeline as center column (bookings, payments, complaints, wallet events).

| Gap | Effort |
|-----|--------|
| No activity timeline on customer detail | 🔴 Major — restyle customer detail around timeline |

---

### A-09: Admin — Missing Finance Hub

**Current:** Invoices, Dues, Expenses are 3 separate pages with no summary view.

**Target (Plan §2.3 A-06):** Finance hub with collection rate, outstanding dues, monthly trend.

| Gap | Effort |
|-----|--------|
| No finance overview dashboard | 🔴 Major — new `/admin/finance` page aggregating existing data |

---

### A-10: Broken Route

**Current:** `AdminSidebar.tsx` for Franchisee links to `/franchisee/notifications`, which has no route in `App.tsx`.

| Gap | Effort |
|-----|--------|
| `/franchisee/notifications` has no page — broken nav link | 🟢 Quick Win — add stub page or remove nav link |

---

## Design System Gaps

| Gap | Effort |
|-----|--------|
| `StatusBadge` exists but not used anywhere except Dashboard (Phase 0) | 🟢 Quick Win — replace `Badge + statusColors` in Staff Dashboard, Schedule, Customer History |
| `CompletionRing` exists but only used in Customer Dashboard | 🟢 Quick Win — use in DailyOps, Staff Dashboard |
| `EmptyState` component exists but many screens use plain text | 🟢 Quick Win — audit + replace in History, Schedule, Complaints, Bookings |
| `ErrorState` component created but no screen uses it yet | 🟢 Quick Win — add to all screens with `isError` state |
| Dark mode tokens exist but no `ThemeProvider` or toggle wired | 🟡 Medium — add ThemeProvider + toggle in admin header |
| No PWA install prompt UI (manifests exist but no prompt) | 🟡 Medium — add `useInstallPrompt` hook + install banner |
| `AppShell` built for Customer/Staff but desktop still shows app shell for all widths | ✅ By design — centered max-width on desktop |

---

## Consolidated Gap Summary

### Quick Wins — Under 1 Day Each

| # | Gap | File(s) |
|---|-----|---------|
| QW-01 | Increase staff action button height from `h-7` (28px) to `h-12` (48px), full-width | `staff/Dashboard.tsx` |
| QW-02 | Add contact icons (call, navigate) to job cards | `staff/Dashboard.tsx` |
| QW-03 | Replace `Badge + statusColors` with `<StatusBadge>` | `staff/Dashboard.tsx`, `staff/Schedule.tsx`, `customer/History.tsx` |
| QW-04 | Replace plain empty text with `<EmptyState>` component | `History.tsx`, `Schedule.tsx`, `Complaints.tsx` |
| QW-05 | History photo thumbnails: 40px → 80px + tap to expand | `customer/History.tsx` |
| QW-06 | Booking confirmation — add "View History" link | `customer/BookService.tsx` |
| QW-07 | DailyOps: add `CompletionRing` for today's cleaning progress | `admin/DailyOps.tsx` |
| QW-08 | DailyOps: demote "Run today's schedule" to secondary button | `admin/DailyOps.tsx` |
| QW-09 | DailyOps: stat cards — standardize icon colors (green/amber/red logic) | `admin/DailyOps.tsx` |
| QW-10 | Admin sidebar group labels — add visual separator, left accent line | `AdminSidebar.tsx` |
| QW-11 | Fix broken franchisee notifications route | `App.tsx` or `FranchiseeLayout.tsx` |
| QW-12 | Customer Invoices — add StatusBadge, Card styling | `customer/Invoices.tsx` |
| QW-13 | Admin Dashboard — add paused/blocked count to subscription health strip | `admin/Dashboard.tsx` |
| QW-14 | Staff Dashboard — shrink stats to horizontal chip row, free space for jobs | `staff/Dashboard.tsx` |
| QW-15 | Staff Schedule — group by date with headers | `staff/Schedule.tsx` |
| QW-16 | `ErrorState` component — wire to screens with `isError` query states | All portal screens |
| QW-17 | Customer complaints — swap `Badge` for `StatusBadge` | `customer/Complaints.tsx` |
| QW-18 | History — grouped by month (frontend sort/group, no API change) | `customer/History.tsx` |

---

### Medium Improvements — 1–3 Days Each

| # | Gap | File(s) | Est. |
|---|-----|---------|------|
| M-01 | Create `/customer/wallet` page (balance + full tx list + dues) | New `customer/Wallet.tsx` | 1d |
| M-02 | Create `/customer/services` page (active subscriptions + completion rings) | New `customer/Services.tsx` | 1d |
| M-03 | Staff Dashboard: active job hero card (focus mode for current job) | `staff/Dashboard.tsx` | 2d |
| M-04 | Replace `StaffLayout` (sidebar) with `AppShell` + bottom nav | `StaffLayout.tsx`, `staff/*.tsx` | 1.5d |
| M-05 | Staff: merge Attendance + Performance into `/staff/profile` | New `staff/Profile.tsx`, route change | 1d |
| M-06 | Staff: create Earnings screen (`/staff/earnings`) | New `staff/Earnings.tsx` | 1d |
| M-07 | Customer Complaints: bottom sheet (mobile) instead of Dialog | `customer/Complaints.tsx` | 1d |
| M-08 | Customer Assets: visual card redesign with service type icon | `customer/MyAssets.tsx` | 1d |
| M-09 | Admin: Alert Banner component on dashboard top | New `AlertBanner.tsx`, `admin/Dashboard.tsx` | 1.5d |
| M-10 | Admin: "Today's Cleaning" mini-widget on dashboard | `admin/Dashboard.tsx` | 1d |
| M-11 | Admin: Finance hub page merging Invoices/Dues/Expenses overview | New `admin/Finance.tsx` | 2d |
| M-12 | Admin: sidebar restructure — Finance group, reduce Operations items | `AdminSidebar.tsx` | 1d |
| M-13 | DailyOps: inline staff assignment for unassigned vehicles | `admin/DailyOps.tsx` | 2d |
| M-14 | Dark mode toggle in admin header | `AdminLayout.tsx` | 1d |
| M-15 | PWA install prompt banner (uses beforeinstallprompt) | New `InstallBanner.tsx` | 1d |
| M-16 | Customer History: timeline month grouping + larger photos | `customer/History.tsx` | 1d |
| M-17 | Book Service: service type cards with icons (existing grid, better visual) | `customer/BookService.tsx` | 0.5d |
| M-18 | Staff Schedule → `/staff/jobs` unified view (today/upcoming/done tabs) | `staff/Schedule.tsx` refactor | 1d |

---

### Major Redesigns — Over 3 Days Each

| # | Gap | File(s) | Est. |
|---|-----|---------|------|
| R-01 | Book Service: single-page → 4-step wizard with progress ring | `customer/BookService.tsx` rewrite | 4d |
| R-02 | Account Hub + sub-screen navigation (IA restructure) | New `customer/Account.tsx` + route updates | 5d |
| R-03 | Admin: domain tab dashboard (Operations/Finance/Daily Cleaning/Solar/Support/Staff/Growth) | `admin/Dashboard.tsx` rewrite | 5d |
| R-04 | Admin: Side panel component + wire to bookings + customer detail | New `SidePanel.tsx` + `Bookings.tsx`, `CustomerDetail.tsx` | 5d |
| R-05 | Admin: Command palette (⌘K) | New `CommandPalette.tsx` + search API | 5d |
| R-06 | Admin: Bookings kanban board view | New `KanbanBoard.tsx` | 4d |
| R-07 | Admin: Customer Detail 360 timeline view | `admin/CustomerDetail.tsx` rewrite | 4d |
| R-08 | Before/After comparison slider | New `BeforeAfterSlider.tsx` | 3d |
| R-09 | Post-registration onboarding wizard | New `OnboardingWizard.tsx` | 4d |

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Account hub IA change (R-02) may break existing deep-links to `/customer/history`, `/customer/invoices` | Add redirect shims; don't remove old routes until transition confirmed |
| Staff layout change (M-04) touches 4 pages and layout file | Feature-flag: render AppShell or PanelShell based on `useFeatureFlag("staff-app-shell")` |
| Domain tab dashboard (R-03) is a complete Dashboard.tsx rewrite | Build on separate route `/admin/command-center`, keep existing `/admin/dashboard` until ready |
| Booking wizard rewrite (R-01) changes primary customer flow | Keep old BookService behind `/customer/book-legacy` as fallback |

---

*This document is a living reference. Mark items complete as implementation progresses.*
