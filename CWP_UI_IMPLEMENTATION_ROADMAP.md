# CWP UI Implementation Roadmap

**Ref:** CWP_UI_GAP_ANALYSIS.md  
**Rule:** Application stays fully functional at the end of every sprint. No broken screens. No blocked workflows.  
**Approach:** Incremental. Each sprint is independently deployable. Later sprints build on earlier ones but never depend on unfinished work.

---

## Guiding Constraints

1. **Zero business logic changes** — only UI files (`src/pages/`, `src/components/`, `src/index.css`)
2. **Zero schema changes** — use data already returned by existing API calls
3. **Zero broken screens** — old routes/components stay alive until replacement is verified
4. **One portal at a time** — complete Customer, then Staff, then Daily Ops, then Admin
5. **Ship quick wins first** — high visibility, low risk, build momentum

---

## Sprint Map

```
Sprint 1  (2–3 days)  Quick Wins — All Portals
Sprint 2  (3–4 days)  Customer: New Pages (Wallet, Services, Timeline History)
Sprint 3  (4–5 days)  Staff: App Shell + Job Focus Mode
Sprint 4  (3–4 days)  Daily Ops: Monitoring Dashboard Upgrade
Sprint 5  (4–5 days)  Customer: Booking Step Wizard
Sprint 6  (4–5 days)  Admin: Dashboard Alerts + Finance Hub
Sprint 7  (5–6 days)  Admin: Side Panel + Bookings Board
Sprint 8  (5–6 days)  Admin: Command Palette + Domain Tabs
Sprint 9  (4–5 days)  Customer: Account Hub + IA Restructure
Sprint 10 (3–4 days)  PWA Polish + Motion + Before/After Slider
```

Total estimated duration: **~38–46 working days** (solo developer)  
Parallelizable by 2 developers: **~22–26 days**

---

## Sprint 1 — Quick Wins Across All Portals

**Duration:** 2–3 days  
**Risk:** Very low — isolated changes  
**Benefit:** Immediate visible quality uplift. User adoption improves instantly.

### Deliverables

#### 1.1 Staff Action Buttons (QW-01, QW-02)
**File:** `src/pages/staff/Dashboard.tsx`

- Change all action `Button` elements from `size="sm"` / `className="text-xs h-7"` to full-width `h-12` on mobile
- Add contact action row below job header: phone icon (tel: link), map pin icon (google maps link)
- Keep existing mutation logic — only visual change

```
Before: <Button size="sm" className="text-xs h-7">En Route</Button>
After:  <Button className="w-full h-12 text-sm">En Route</Button>
```

#### 1.2 Replace Badge + statusColors with StatusBadge (QW-03)
**Files:** `staff/Dashboard.tsx`, `staff/Schedule.tsx`, `customer/History.tsx`, `customer/Complaints.tsx`

- Delete `const statusColors` object from each file
- Replace `<Badge variant="outline" className={statusColors[...]}>{status}</Badge>` with `<StatusBadge status={status} />`
- `StatusBadge` already covers all statuses in `src/components/shared/StatusBadge.tsx`

#### 1.3 Replace Plain Empty Text with EmptyState (QW-04)
**Files:** `customer/History.tsx` (line 105), `staff/Schedule.tsx` (line 76), `customer/Complaints.tsx`

```tsx
// Before
<div className="text-center py-12 text-muted-foreground">No service history yet</div>

// After
<EmptyState
  title="No services yet"
  description="Your completed services will appear here"
  action={<Link href="/customer/bookings"><Button size="sm">Book a Service</Button></Link>}
/>
```

#### 1.4 History Photo Thumbnails: 40px → 80px (QW-05)
**File:** `customer/History.tsx`

- Change `w-10 h-10` → `w-20 h-20` on before/after photo thumbnails
- Add `cursor-pointer` + `onClick` to open full image in a `Dialog`

#### 1.5 Booking Confirmation: Add "View History" link (QW-06)
**File:** `customer/BookService.tsx` (lines 118–133)

- Below "Book Another Service" button, add `<Link href="/customer/history">View my bookings</Link>`

#### 1.6 Staff Dashboard Stats → Horizontal Chips (QW-14)
**File:** `staff/Dashboard.tsx` (lines 135–149)

- Replace 3-card grid with compact horizontal chip row
- Frees viewport real estate for job cards

```tsx
// Before: 3 wide cards in a grid
// After: compact row
<div className="flex gap-2">
  <div className="flex-1 bg-card border rounded-xl p-2 text-center">
    <p className="font-bold text-lg text-primary">{today.length}</p>
    <p className="text-[10px] text-muted-foreground">Today</p>
  </div>
  ...
</div>
```

#### 1.7 Staff Schedule — Date Grouping (QW-15)
**File:** `staff/Schedule.tsx`

- Group `data.data` by `scheduledDate` using `reduce`
- Render date header before each group
- No API change — pure frontend grouping

#### 1.8 DailyOps: Completion Ring + Button Demotion (QW-07, QW-08, QW-09)
**File:** `admin/DailyOps.tsx`

- Add `CompletionRing` at top showing `completed / todayDailyBookings.length`
- Move "Run today's schedule" from primary button → `variant="outline"` secondary button
- Move to a "Actions" dropdown/popover (keep functionality identical)
- Stat cards: standardize — green for active, amber for paused, blue for today's count, teal for eligible

#### 1.9 Fix Broken Franchisee Notifications Route (QW-11)
**File:** `src/App.tsx` or `FranchiseeLayout.tsx`

- Add route: `/franchisee/notifications` → stub `<NotificationsComingSoon />` page
- Or remove the nav link from `FranchiseeLayout.tsx`

#### 1.10 Admin Sidebar Visual Hierarchy (QW-10)
**File:** `src/components/layout/AdminSidebar.tsx`

- Add `border-l-2 border-primary/30 pl-3` to group labels
- Increase group label font size from inferred tiny to `text-xs font-semibold uppercase tracking-wider`

#### 1.11 Customer Invoices: Card Style + StatusBadge (QW-12)
**File:** `customer/Invoices.tsx`

- Wrap each invoice row in a `Card`
- Add `StatusBadge` for payment status

#### 1.12 ErrorState on All Query Screens
**Files:** All portal screens

- For every `useQuery` result, handle `isError` state
- Show `<ErrorState onRetry={() => refetch()} />`

---

**Sprint 1 Definition of Done:**
- [ ] Staff action buttons ≥ 48px height
- [ ] `StatusBadge` replaces `Badge + statusColors` in 4 files
- [ ] `EmptyState` replaces raw text in 3+ files
- [ ] History photos ≥ 80px
- [ ] DailyOps has completion ring
- [ ] DailyOps primary action button demoted
- [ ] Broken franchisee route fixed
- [ ] No TypeScript errors
- [ ] All existing tests pass

---

## Sprint 2 — Customer: New Screens (Wallet + Services + Timeline)

**Duration:** 3–4 days  
**Risk:** Low — new files, no changes to existing screens  
**Benefit:** Customer gets two major missing screens. Bottom nav gains Wallet tab.

### Deliverables

#### 2.1 Create `/customer/wallet` Page (M-01)
**File:** New `src/pages/customer/Wallet.tsx`

**Content:**
- Large balance display with `IndianRupee` icon (from existing `walletSummary` API)
- Low balance warning banner (reuse existing logic from Dashboard)
- Full transaction list (all transactions, paginated if needed — uses existing `/api/customers/:id/wallet/transactions` endpoint)
- Dues section showing `summary.pendingDues` with link to Invoices
- Styled info card: "To recharge your wallet, contact CWP via WhatsApp / Call"
- Data source: existing `fetchWalletTransactions` + `fetchWalletSummary` functions (copy from Dashboard, or extract to a shared hook)

**Route:** Add to `App.tsx`: `/customer/wallet`

#### 2.2 Create `/customer/services` Page (M-02)
**File:** New `src/pages/customer/Services.tsx`

**Content:**
- Active subscriptions with `CompletionRing` (reuse subscription list from Dashboard)
- Paused subscriptions in amber-accented section
- Solar AMC card if solar sub present: "Next visit · X visits done · Y remaining"
- Link to book next service
- Data source: existing `useListSubscriptions` — no new API calls

**Route:** Add to `App.tsx`: `/customer/services`

#### 2.3 Update `CustomerLayout` Bottom Nav (QW-switch)
**File:** `src/components/layout/CustomerLayout.tsx`

Change nav items:
```tsx
// Before
{ href: "/customer/assets", label: "Services", icon: Car },
{ href: "/customer/history", label: "History", icon: History },
{ href: "/customer/complaints", label: "Support", icon: AlertCircle },

// After
{ href: "/customer/services", label: "Services", icon: CreditCard },
{ href: "/customer/wallet", label: "Wallet", icon: IndianRupee },
{ href: "/customer/account", label: "Account", icon: User }, // stub, Sprint 9
```

> Keep `/customer/history`, `/customer/invoices`, `/customer/assets`, `/customer/complaints` routes alive — just not in primary nav.

#### 2.4 Improve History: Month Timeline + Larger Photos (M-16, QW-05 complete)
**File:** `src/pages/customer/History.tsx`

- Group bookings by month: `Jan 2026`, `Dec 2025`, etc.
- Month header: bold separator
- Enlarge before/after photos to `w-20 h-20`
- Add `Dialog` with full-size image on photo tap
- Add `EmptyState` with Book CTA

---

**Sprint 2 Definition of Done:**
- [ ] `/customer/wallet` accessible and shows balance + transactions
- [ ] `/customer/services` accessible and shows active plans with completion rings
- [ ] Bottom nav has Wallet tab (pointing to `/customer/wallet`)
- [ ] History has month grouping
- [ ] History photos are 80px min + tap-to-expand
- [ ] Old routes still work (`/customer/assets`, `/customer/history`, etc.)

---

## Sprint 3 — Staff: App Shell + Job Focus Mode

**Duration:** 4–5 days  
**Risk:** Medium — replacing layout file affects all 4 staff pages  
**Benefit:** Staff portal feels like a real mobile app — biggest UX leap after Customer portal

### Deliverables

#### 3.1 Replace StaffLayout with AppShell + Bottom Nav (M-04)
**File:** `src/components/layout/StaffLayout.tsx`

- Remove `PanelShell` dependency
- Use `AppShell` with `maxWidth="md"` (640px, centered on desktop)
- 4-tab bottom nav:
  ```tsx
  const staffNavItems = [
    { href: "/staff/dashboard", label: "Today", icon: Zap },
    { href: "/staff/jobs",      label: "Jobs",  icon: Calendar },
    { href: "/staff/earnings",  label: "Earnings", icon: IndianRupee },
    { href: "/staff/profile",   label: "Profile",  icon: User },
  ];
  ```
- AppBar: CWP Staff branding, no hamburger, greeting on Today screen

> **Safe migration strategy:** Create `StaffAppShell.tsx` as a new component. Swap `StaffLayout` import to `StaffAppShell` in `StaffDashboard.tsx` first. Verify. Then update remaining staff pages.

#### 3.2 Staff Dashboard: Active Job Focus Mode (M-03)
**File:** `src/pages/staff/Dashboard.tsx`

**Logic:**
- `activeJob` = first job with status `en_route` or `in_progress`
- If `activeJob` exists: render as hero card (full-width, 200px+), remaining today's jobs below as compact list
- If no `activeJob`: first `scheduled` job of the day becomes hero (ready to start)
- Hero card contains:
  - Customer name (bold, 20px)
  - Service type + vehicle info
  - Address with map icon (tel: + maps link)
  - Status badge with pulse if en_route/in_progress
  - Primary action button: full-width, `h-14`
  - Photo upload area (camera icon if photo needed)

**Action button state machine:**
```
scheduled  → [▶ Start Route]     → transitions to en_route
en_route   → [📷 Upload Before]  → enables Start Job
en_route + beforePhoto → [▶ Start Job] → in_progress
in_progress → [📷 Upload After]  → enables Complete
in_progress + afterPhoto → [✓ Complete Job] → completed
completed  → [✓ Done]            (disabled, green)
```

All buttons: `className="w-full h-14 text-base font-semibold"`

#### 3.3 Create `/staff/jobs` Page (M-18)
**File:** New `src/pages/staff/Jobs.tsx`

- Unified view: 3-tab segmented control (Today / Upcoming / Done)
- Reuse job list rendering from existing Dashboard
- Date headers on Upcoming/Done sections
- `StatusBadge` on each job
- Today tab shows compact job list (hero card is on Dashboard)

> This replaces `/staff/schedule`. Keep old route redirecting to `/staff/jobs`.

#### 3.4 Create `/staff/earnings` Page (M-06)
**File:** New `src/pages/staff/Earnings.tsx`

**Content (UI only, from existing booking data):**
- Today's earnings: sum of `amount` on completed bookings today
- Weekly / Monthly toggle: 3-segment control
- Jobs list grouped by date with per-job amount
- "Your rank this week" if `performance.leaderboard` data available
- Data source: `useListBookings({ staffId })` — aggregate frontend, no new API

#### 3.5 Create `/staff/profile` Page (M-05)
**File:** New `src/pages/staff/Profile.tsx`

**Content:**
- Staff avatar (initials) + name + role
- "Mark Attendance" — one-tap button (reuse attendance API from existing `Attendance.tsx`)
- Attendance status for today (present/absent/not yet)
- Performance stats section (compact: jobs this month, rating, rank)
- Monthly attendance calendar (collapse by default, expand on tap)
- Sign out button

---

**Sprint 3 Definition of Done:**
- [ ] Staff portal uses bottom nav, no sidebar on any breakpoint
- [ ] Staff dashboard shows active job as hero card with `h-14` buttons
- [ ] Photo upload still works (no logic change)
- [ ] `/staff/jobs` exists and shows Today/Upcoming/Done tabs
- [ ] `/staff/earnings` exists and shows today's amount
- [ ] `/staff/profile` exists with one-tap attendance mark
- [ ] Old `/staff/schedule` and `/staff/attendance` routes redirect (not 404)

---

## Sprint 4 — Daily Ops: Monitoring Dashboard Upgrade

**Duration:** 3–4 days  
**Risk:** Low — DailyOps is admin-only, no customer/staff impact  
**Benefit:** Ops manager gets a command-center feel. Fewer manual interventions per day.

### Deliverables

#### 4.1 DailyOps Top Section Redesign
**File:** `src/pages/admin/DailyOps.tsx`

**New layout (above the fold):**
```
┌─────────────────────────────────────────────────────────┐
│  Daily Cleaning · Monday 13 Jun                         │
│  Auto-refresh in 60s                    [⋮ Actions ▾]  │
├──────────┬──────────┬──────────┬────────────────────────┤
│          │  Active  │  Paused  │  Blocked    Eligible   │
│ [Ring]   │  ██ 47   │  ⚠ 3    │  ⚠ 2        ✓ 45       │
│ 18/24    │ contracts│          │                         │
│ complete │                                               │
└─────────────────────────────────────────────────────────┘
```

- Left: `CompletionRing` (completed today / total today bookings)
- Right: 4 compact stat chips in a row
- Header: title + date + "Actions" overflow menu
- Actions menu contains: "Run today's schedule", "Full daily tick", "Refresh"

#### 4.2 Inline Staff Assignment for Unassigned Vehicles (M-13)
**File:** `src/pages/admin/DailyOps.tsx`

- Replace "Assign staff" link-to-customer-detail with a popover `Select` for staff
- Use existing `useListStaff` query + `useUpdateBooking` or equivalent assignment mutation
- Staff selector popover opens inline on the unassigned vehicle row

#### 4.3 Add "Today's Cleaning" Mini-Widget to Admin Dashboard (M-10)
**File:** `src/pages/admin/Dashboard.tsx`

- Below KPI grid, add a small "Today's Daily Cleaning" strip
- Show: total daily bookings today, completion count, blocked count
- Link to `/admin/daily-ops`
- Data source: add `useQuery(["daily-ops-summary"])` calling existing `/api/subscriptions/daily-ops` endpoint

#### 4.4 Admin Dashboard — Alert Banner (M-09)
**File:** `src/pages/admin/Dashboard.tsx`  
**New component:** `src/components/shared/AlertBanner.tsx`

`AlertBanner` accepts `items: { label: string; href: string; severity: "warn" | "error" }[]`

Populate from existing data:
```tsx
const alerts = [
  health?.missedThisWeek > 0 && { label: `${health.missedThisWeek} subscriptions missed this week`, href: "/admin/subscriptions", severity: "warn" },
  stats?.openComplaints > 0 && { label: `${stats.openComplaints} open complaints`, href: "/admin/complaints", severity: "warn" },
  stats?.pendingDuesTotal > 50000 && { label: `₹${fmt(stats.pendingDuesTotal)} pending dues`, href: "/admin/dues", severity: "error" },
].filter(Boolean);
```

Show only if `alerts.length > 0`. Dismissible per session (`sessionStorage`).

---

**Sprint 4 Definition of Done:**
- [ ] DailyOps has `CompletionRing` hero stat
- [ ] "Run schedule" is in overflow menu, not primary button
- [ ] Unassigned vehicles have inline staff assignment (no page nav)
- [ ] Admin dashboard has alert banner
- [ ] Admin dashboard has today's cleaning strip

---

## Sprint 5 — Customer: Booking Step Wizard

**Duration:** 4–5 days  
**Risk:** Medium — replacing primary customer flow. Old route must remain as fallback.  
**Benefit:** Biggest customer experience improvement. Reduces booking errors.

### Deliverables

#### 5.1 Build BookingWizard Component
**New file:** `src/components/shared/BookingWizard.tsx`

4-step component. State lives in parent (`BookService.tsx`). Wizard is purely presentational.

**Step 1 — Choose Service Type:**
- 4 large visual cards (2×2 on mobile): Car Wash, Detailing, Solar Cleaning, Pickup & Drop
- Each card: icon (60px), title, 1-line description
- Active card: `border-primary`, `bg-primary/5`, checkmark overlay
- "Next →" CTA

**Step 2 — Select Asset:**
- If car service: vehicle cards (list)
- If solar: solar site cards
- "Add vehicle" / "Add solar site" link if none registered
- "Next →" CTA disabled until asset selected

**Step 3 — Pick Date & Time:**
- Visual date selector: 7-day horizontal scroll (today + next 6 days)
- Each day: `Tue 15` format, tap to select, active = filled
- Time slots as chips: 07:00, 08:00, 09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00
- "Next →" CTA

**Step 4 — Review & Confirm:**
- Summary card: service, asset, date, time, price
- "Edit" link per section going back to correct step
- Wallet balance display (will this be deducted from wallet?)
- "Confirm Booking" primary CTA

**Step progress ring:** `StepRing` component (4 nodes, current step filled)

#### 5.2 Wire BookingWizard into BookService.tsx
**File:** `src/pages/customer/BookService.tsx`

- Add `?wizard=true` query param to enable wizard mode
- Default behavior unchanged (old form still works at `/customer/bookings`)
- Wizard replaces the scrolling form when `wizard=true` or when localStorage flag `bookingWizardEnabled` is set
- All existing mutation code stays in `BookService.tsx` — wizard just handles UI state

> **Gradual rollout:** Start with wizard as opt-in, then flip default.

---

**Sprint 5 Definition of Done:**
- [ ] 4-step wizard accessible via `/customer/bookings?wizard=true`
- [ ] All 4 service types work through wizard
- [ ] Existing `/customer/bookings` (old form) still works
- [ ] Confirmation screen includes "View History" link
- [ ] Wizard on mobile is fully one-handed usable (bottom CTAs)
- [ ] TypeScript clean

---

## Sprint 6 — Admin: Finance Hub + Dashboard Alerts

**Duration:** 4–5 days  
**Risk:** Low for Finance hub (new page). Medium for dashboard restructure.  
**Benefit:** Finance team gets a single overview. Admin sidebar gets cleaner.

### Deliverables

#### 6.1 Create `/admin/finance` Hub Page (M-11)
**New file:** `src/pages/admin/Finance.tsx`

**Content:**
- This month's collection stats (from dashboard stats API)
- Outstanding dues total (from stats API)
- 3 quick-link cards: Invoices | Dues | Expenses
- Recent payments list (from existing invoices query)
- Month trend chart (from `stats.revenueByCategory` data)

**Sidebar change:**  
Add "Finance" group to `AdminSidebar.tsx`. Move Invoices, Dues, Expenses, Quotations under Finance. Remove them from Operations.

#### 6.2 Admin Sidebar Restructure (M-12)
**File:** `src/components/layout/AdminSidebar.tsx`

New group order:
```
OPERATIONS (5 items)
  Dashboard | Bookings | Daily Cleaning | Subscriptions | Complaints

CUSTOMERS & GROWTH (3 items)
  Leads & CRM | Customers | Churned

FINANCE (4 items)
  Finance Hub | Invoices | Dues | Expenses

WORKFORCE (3 items)
  Staff | Verification | Credentials

NETWORK & CONFIG (4 items)
  Franchisees | Branches | Services | Notifications

ANALYTICS
  Analytics | Quotations
```

---

**Sprint 6 Definition of Done:**
- [ ] `/admin/finance` page exists and shows overview
- [ ] Finance sidebar group exists with 4 items
- [ ] Operations sidebar group has ≤ 5 items
- [ ] All existing admin routes still work

---

## Sprint 7 — Admin: Side Panel + Bookings Board

**Duration:** 5–6 days  
**Risk:** Medium-High — touches core admin booking workflow  
**Benefit:** Ops team no longer loses context navigating to booking detail

### Deliverables

#### 7.1 Build SidePanel Component
**New file:** `src/components/shared/SidePanel.tsx`

- Slide-in from right (480px on desktop, full-width sheet on mobile)
- Header with close button + title
- Scrollable body
- Uses `Sheet` (shadcn) as implementation on mobile, CSS-animated `div` on desktop
- Props: `open`, `onClose`, `title`, `children`

#### 7.2 Wire SidePanel to Bookings List
**File:** `src/features/bookings/pages/Bookings.tsx`

- Row click → open `SidePanel` with booking detail content
- Side panel shows: customer, asset, status timeline, photos, staff, actions
- Admin can transition status, reassign staff — all from side panel
- Existing "open booking" navigation still works as fallback

#### 7.3 Kanban Status Lane Toggle for Bookings (R-06)
**File:** `src/features/bookings/pages/Bookings.tsx`

- Add toggle: `[≡ Table]` `[⊞ Board]`
- Board view: 5 columns (Scheduled, En Route, In Progress, Completed, Cancelled)
- Drag between columns updates booking status (via existing transition mutation)
- Uses `@dnd-kit` (already installed)
- Table view: unchanged

---

**Sprint 7 Definition of Done:**
- [ ] SidePanel opens on booking row click (desktop)
- [ ] Booking detail + status + photos visible in panel
- [ ] Kanban board toggle works
- [ ] Drag-to-change-status calls existing transition mutation
- [ ] All existing table filters still work

---

## Sprint 8 — Admin: Command Palette + Domain Tab Dashboard

**Duration:** 5–6 days  
**Risk:** Medium — command palette requires search endpoint integration  
**Benefit:** Power-user feature that makes admin 10× faster for experienced ops staff

### Deliverables

#### 8.1 Command Palette (R-05)
**New file:** `src/components/shared/CommandPalette.tsx`

- `⌘K` / `Ctrl+K` keyboard shortcut
- Search input overlay
- Categories: Customers, Bookings, Staff, Pages
- Uses existing API endpoints: `/api/customers?search=`, `/api/bookings?search=`, `/api/staff?search=`
- Recent searches stored in `localStorage`
- Accessible: focus trap, ESC to close, arrow key navigation

#### 8.2 Domain Tab Dashboard (R-03)
**File:** `src/pages/admin/Dashboard.tsx` refactor

- Add `<Tabs>` at top: Operations | Finance | Daily Ops | Customers | Support
- **Operations tab:** existing KPI grid (current content)
- **Finance tab:** revenue, dues, collection rate charts
- **Daily Ops tab:** cleaning completion ring + today's schedule + blocked contracts
- **Customers tab:** total, active, churned, lead pipeline mini-view
- **Support tab:** open complaints, avg resolution time (if available)
- Each tab pulls from already-loaded data — no new API calls for first 3 tabs

---

**Sprint 8 Definition of Done:**
- [ ] `⌘K` opens command palette
- [ ] Customer/booking search works in palette
- [ ] Dashboard has domain tabs
- [ ] All 5 tabs show relevant data
- [ ] Domain tabs are keyboard navigable

---

## Sprint 9 — Customer: Account Hub + IA Restructure

**Duration:** 4–5 days  
**Risk:** Medium — IA change affects all customer nav. Old routes must redirect.  
**Benefit:** Customer nav is clean (5 tabs only). Account hub gives users a self-serve center.

### Deliverables

#### 9.1 Create Account Hub Page (R-02)
**New file:** `src/pages/customer/Account.tsx`

- Profile header: initials avatar, name, email
- Menu list with `ChevronRight`:
  - My Assets → `/customer/assets`
  - Service History → `/customer/history`
  - Invoices → `/customer/invoices`
  - Support → `/customer/complaints`
  - Settings (stub)
  - Sign Out

#### 9.2 Update CustomerLayout Bottom Nav
**File:** `src/components/layout/CustomerLayout.tsx`

Final 5-tab nav:
```tsx
[Home] [Services] [Book⊕] [Wallet] [Account]
```

Remove History and Support from nav. Both accessible from Account hub.

> Old routes `/customer/history`, `/customer/invoices`, `/customer/assets`, `/customer/complaints` remain live — they just don't appear in the bottom nav.

#### 9.3 Complaints Screen: Bottom Sheet (M-07)
**File:** `src/pages/customer/Complaints.tsx`

- Replace `Dialog` for new complaint with `Sheet` (slide from bottom)
- Service type selection as large tap-target chips, not a `<Select>`
- Title + description inputs remain
- On mobile: bottom sheet with `safe-area-bottom` padding

---

**Sprint 9 Definition of Done:**
- [ ] `/customer/account` accessible from bottom nav
- [ ] Account hub links to all sub-screens
- [ ] Bottom nav is `Home | Services | Book | Wallet | Account`
- [ ] Old routes still work when accessed directly
- [ ] Complaint new form uses bottom sheet on mobile

---

## Sprint 10 — PWA Polish + Visual Finishing

**Duration:** 3–4 days  
**Risk:** Low — additive features only  
**Benefit:** App feels premium. Install prompt drives adoption.

### Deliverables

#### 10.1 PWA Install Prompt Banner (M-15)
**New file:** `src/components/shared/InstallBanner.tsx`

- Listen for `beforeinstallprompt` event
- Show banner after user's 2nd visit (check `localStorage`)
- Banner: "Add CWP to your home screen for the best experience" + [Install] + [×]
- Show on Customer portal pages only (not admin)

#### 10.2 Before/After Comparison Slider (R-08)
**New file:** `src/components/shared/BeforeAfterSlider.tsx`

- Two images side by side with draggable center divider
- Touch-draggable on mobile
- Show in Customer History (expanded view) + Staff completed jobs
- Admin booking detail panel

#### 10.3 Motion Design System
**File:** `src/index.css` + component updates

Global framer-motion variants:
```tsx
// Reusable in any component
export const fadeInUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } };
export const scaleIn = { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.15 } };
```

Apply to:
- Card lists (stagger children, 50ms delay)
- Bottom sheet open/close (slide)
- Tab content switch (crossfade 150ms)
- Booking confirmation (spring scale + checkmark)

#### 10.4 Dark Mode Toggle (M-14)
**File:** `src/components/layout/AdminLayout.tsx`

- Add `ThemeProvider` wrapper in `App.tsx`
- Toggle button in admin top bar
- Customer/Staff: follow system preference automatically

---

**Sprint 10 Definition of Done:**
- [ ] Install prompt appears on Customer portal after 2nd visit
- [ ] Before/After slider works on touch + mouse
- [ ] Page transitions have consistent motion (not jarring)
- [ ] Dark mode toggle works in admin
- [ ] Customer/Staff follow system dark mode

---

---

## Sprint 11 — Operations Wall

**Route:** `/admin/operations-wall`  
**Duration:** 2–3 days  
**Risk:** Low — read-only screen, no mutations  
**Purpose:** Large-screen real-time operational monitoring. Designed for a TV or wall-mounted display in the operations office.

### Layout

TV-friendly: high-contrast, large text, minimal chrome. No sidebar (full-screen). Auto-refresh every 30 seconds.

```
┌──────────────────────────────────────────────────────────────┐
│  CWP OPERATIONS WALL          Mon 13 Jun  · Auto-refresh 30s │
├─────────┬──────────┬───────────┬──────────┬──────────────────┤
│ TODAY   │ SCHED.   │IN PROGRESS│COMPLETED │   DELAYED        │
│  24     │  12      │  7        │  5       │   ⚠ 3            │
├─────────┴──────────┴───────────┴──────────┴──────────────────┤
│  LIVE JOB BOARD                                              │
│  [Job Card] [Job Card] [Job Card] [Job Card] ...             │
├──────────────────────────────┬───────────────────────────────┤
│  LOW BALANCE CONTRACTS       │  OPEN COMPLAINTS              │
│  [Contract row] × N          │  [Complaint row] × N         │
├──────────────────────────────┴───────────────────────────────┤
│  ACTIVE STAFF                                                │
│  [Staff chip] [Staff chip] ...                               │
└──────────────────────────────────────────────────────────────┘
```

### Data Sources (all existing endpoints)
- Today's jobs, status counts: `/api/bookings?date=today`
- Delayed: completed bookings past scheduled time, or bookings still `scheduled` after scheduled time
- Low balance contracts: from `/api/subscriptions/daily-ops` (`schedulerPreview.blocked`)
- Open complaints: from `/api/complaints?status=open`
- Active staff: from `/api/staff?isActive=true`

### Special UX Rules
- No sidebar. `AdminLayout` not used. Custom full-screen layout.
- Font sizes: stats = 64px display, labels = 14px
- Status lane colors: sky (scheduled), orange (en_route), teal (in_progress), green (completed), red (delayed)
- Auto-refresh: `refetchInterval: 30000` on all queries
- "Delayed" = bookings with `status !== 'completed'` and `scheduledDate < today` OR jobs past `scheduledTime + 2h` still not completed
- Entry point: link from admin sidebar under Operations, or direct URL

---

## Sprint 12 — Founder Dashboard

**Route:** `/admin/founder`  
**Duration:** 2–3 days  
**Risk:** Low — read-only aggregation from existing data  
**Purpose:** Business owner overview. One glance = full business health.

### Layout

Single scrolling page. Desktop-first but fully responsive. No sidebar needed (link from admin sidebar).

```
┌───────────────────────────────────────────────────────────┐
│  Good morning. Here's your business.    Mon 13 Jun 2026   │
├──────────┬──────────┬──────────┬────────────────────────  │
│ Revenue  │ Revenue  │Collec-   │ Active    Active         │
│ Today    │ Month    │tions Due │ Customers Contracts      │
│ ₹24,000  │ ₹3.2L    │ ₹45,000  │ 847       312           │
├──────────┴──────────┴──────────┴─────────────────────     │
│ Leads    │ Complaints│Staff     │ Churn Rate              │
│ 38 total │ 3 open   │ 22 active│ 2.1%                    │
├────────────────────────────────────────────────────────── │
│  CITY-WISE PERFORMANCE                                    │
│  [City] [Revenue bar] [Customers] [Contracts]            │
│  ...                                                      │
├────────────────────────────────────────────────────────── │
│  REVENUE TREND (30 days)         SUBSCRIPTION MIX        │
│  [Bar chart]                     [Pie chart]             │
└────────────────────────────────────────────────────────── │
```

### Data Sources (all existing endpoints)
- Revenue today / month: `useGetDashboardStats({ period: "month" })`
- Collections due: `stats.pendingDuesTotal`
- Active customers: `stats.totalCustomers`
- Active contracts: `stats.activeSubscriptions`
- Leads total: `/api/leads/stats`
- Open complaints: `stats.openComplaints`
- Active staff: `/api/staff?isActive=true` count
- Churn rate: `useGetSubscriptionHealth()`
- City-wise: `stats.cityWiseStats`
- Revenue trend / subscription mix: `stats.revenueByCategory`, `stats.subscriptionBreakdown`

### Special UX Rules
- Printable layout (no fixed chrome, `@media print` clean)
- KPI cards have trend arrows (↑↓) compared to last period where available
- City performance table shows rank, revenue bar, customer count, contract count
- "No alerts" state shows green banner: "All systems healthy"
- Permission: visible to `superadmin` role only

---

## Backlog (Post-Roadmap, Future Sprints)

These items are identified in the plan but excluded from the current roadmap due to scope or dependencies:

| Item | Reason Deferred |
|------|----------------|
| Customer 360 timeline (R-07) | Needs side panel first (Sprint 7 prerequisite) |
| Post-registration onboarding wizard (R-09) | Needs Account hub (Sprint 9 prerequisite) |
| Solar AMC dedicated card in Services screen | Basic Services screen built in Sprint 2; enhance after |
| Customer live booking tracking (map, ETA) | Requires backend geolocation API — out of scope |
| Push notification integration | Backend notifications exist; PWA push setup needed |
| Staff offline queue with background sync | UI layer in Sprint 3; service worker queue in backlog |
| Franchisee portal parity | Low urgency; follow customer portal pattern after Sprint 9 |

---

## Risk Management

| Sprint | Risk | Mitigation |
|--------|------|-----------|
| Sprint 3 (Staff Shell) | StaffLayout change breaks 4 pages | Create `StaffAppShell` separately, swap one page at a time |
| Sprint 5 (Booking Wizard) | Breaks primary booking flow | Keep old route `/customer/bookings` alive; wizard at `?wizard=true` |
| Sprint 7 (Bookings Board) | DnD breaks table | Toggle switch; table is default, board is opt-in |
| Sprint 8 (Command Palette) | Search endpoint too slow | Add debounce (300ms) + loading state; show cached results first |
| Sprint 9 (Account Hub IA) | Old nav shortcuts break | All `/customer/*` routes stay live; Account hub is an additive layer |

---

## Tracking Template

Copy this block into your task tracker after each sprint:

```
Sprint N — [Title]
Status: [ ] Not Started  [ ] In Progress  [ ] Done

Files changed:
- src/pages/...
- src/components/...

QA checks:
- [ ] Customer portal loads
- [ ] Staff portal loads
- [ ] Admin portal loads
- [ ] TypeScript: no errors
- [ ] No broken routes
```

---

*This roadmap is the execution layer for CWP_WORLD_CLASS_PRODUCT_EXPERIENCE_PLAN.md and CWP_UI_GAP_ANALYSIS.md. All three documents should be read together.*
