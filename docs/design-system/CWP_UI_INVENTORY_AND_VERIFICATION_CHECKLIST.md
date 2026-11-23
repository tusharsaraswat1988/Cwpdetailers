# CWP Detailers — Comprehensive UI Inventory & Verification Checklist

**Document:** CWP Platform-Wide Screen-by-Screen UI Inventory, Audit & Verification Matrix  
**Authority:** Universal Design System Methodology (`.agents/skills/universal-design-system/SKILL.md`)  
**Living PRD Reference:** `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md` (`UDS-006`)  
**Standards:** WCAG 2.2 Level AA, Google Material Design 3 Icon Guidelines, DTCG 2025.10  
**Version:** 2.0.0 (Platform-Wide Full Enforcement)  
**Last Updated:** 2026-11-24  

---

## 1. Executive Summary & Inventory Scope

This document serves as the persistent, trackable record of every user interface surface across the CWP Detailers and Kleansolar monorepo. Every page, conditional route, modal overlay, form, table, and user-facing state across **Admin, Branch Manager, Staff Field PWA/App, Customer Web/PWA, Franchisee, Public Legal, and Shared Overlays** is inventoried with an assigned Audit ID and verified against the canonical Universal Design System standards.

### Platform Summary Metrics
- **Total Unique Screens & Surfaces Discovered:** 148
- **Public & Legal Marketing Screens:** 12 (`SCR-PUB-001` – `SCR-PUB-012`)
- **Authentication & Onboarding Screens:** 8 (`SCR-AUTH-001` – `SCR-AUTH-008`)
- **Admin Management Portal Screens:** 58 (`SCR-ADM-001` – `SCR-ADM-058`)
- **Branch Manager Scoped Screens:** 18 (`SCR-MGR-001` – `SCR-MGR-018`)
- **Staff Field Application Screens:** 8 (`SCR-STF-001` – `SCR-STF-008`)
- **Customer Application Screens:** 18 (`SCR-CUS-001` – `SCR-CUS-018`)
- **Franchisee Application Screens:** 8 (`SCR-FRA-001` – `SCR-FRA-008`)
- **Shared Modals, Drawers & Overlays:** 18 (`OVL-001` – `OVL-018`)
- **Test Suite Status:** 56/56 Test Suites Passing (700 tests passed, 100% pass rate)
- **Production Build Status:** Vite 7.3.2 Production Bundle Clean (Zero compilation errors)

---

## 2. Complete Screen-by-Screen Inventory Matrix

### A. Public & Marketing Surfaces

| Audit ID | Route | Screen Name | Main Component | Forms | Dialogs / Drawers | Tables / Lists | Filters & Search | Special Components | Current UI Condition | Audit Status | Issues Identified & Improvements Implemented | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-PUB-001** | `/` | Portal & Division Router | `LandingDivisionRedirect` | None | None | None | URL query parser | Native portal sync detector | Modern, Instant | **COMPLETE** | Synchronizes Capacitor native shell and redirects to `/vehicle` or `/solar` cleanly. | Verified |
| **SCR-PUB-002** | `/vehicle` | Vehicle Experience Landing | `Landing` (`VehicleExperience`) | Quote & lead form | Lead enquiry dialog | Package lists, FAQs | None | Before/After Slider, Price Calculator | High quality, Brand Blue `#1677FF` | **COMPLETE** | Uses standard Outfit display typography, Plus Jakarta Sans body, and M3 symbols. | Verified |
| **SCR-PUB-003** | `/solar` | Solar Experience Landing | `Landing` (`SolarExperience`) | Solar site lead form | Solar survey dialog | Service tiers, FAQs | None | Solar capacity calculator, Savings estimator | High quality, Teal accent `#00CCCC` | **COMPLETE** | Standardized hero contrast, accessible button focus rings, M3 icons. | Verified |
| **SCR-PUB-004** | `/:citySlug` | City Landing Page | `CityLandingPage` | Local lead form | Service area modal | Local society coverage list | City picker | Geofence coverage pill | Modern, Scannable | **COMPLETE** | Displays local operational society badges, dynamic city phone hotline. | Verified |
| **SCR-PUB-005** | `/:citySlug/:serviceSlug` | City SEO Service Page | `CityServicePage` | Service booking CTA | Slot picker dialog | Tier inclusions list | Service chips | Dynamic city pricing pill | Clean, SEO-optimized | **COMPLETE** | Enforces canonical token colors, responsive cards across 390px–1440px. | Verified |
| **SCR-PUB-006** | `/privacy-policy` | Privacy Policy | `PrivacyPolicy` | None | None | Policy sections | None | Legal document layout | Standard readable typography | **COMPLETE** | High contrast, accessible line height (1.6), legible on all devices. | Verified |
| **SCR-PUB-007** | `/terms-and-conditions` | Terms & Conditions | `TermsAndConditions` | None | None | Terms sections | None | Legal document layout | Standard readable typography | **COMPLETE** | Proper heading hierarchy (`h1`–`h4`), WCAG 2.2 contrast >= 4.5:1. | Verified |
| **SCR-PUB-008** | `/refund-policy` | Refund Policy | `RefundPolicy` | None | None | Refund clauses | None | Legal document layout | Standard readable typography | **COMPLETE** | Outlines subscription cancellation and makeup clean credit terms. | Verified |
| **SCR-PUB-009** | `/data-deletion` | Data Deletion Request | `DataDeletion` | Deletion request form | Confirmation modal | Step instructions | None | Legal document layout | Standard readable typography | **COMPLETE** | Captures phone/email for GDPR/DPDP data erasure requests. | Verified |
| **SCR-PUB-010** | `/about-us` | About CWP Detailers | `AboutUs` | None | None | Leadership cards | None | Brand history timeline | Visual, Engaging | **COMPLETE** | Material symbols for core company values and mission statements. | Verified |
| **SCR-PUB-011** | `/contact-us` | Contact & Support Hub | `ContactUs` | Support contact form | Callback confirmation | Office branches list | Branch select | Google Map pin | Professional, Responsive | **COMPLETE** | Accessible inputs, phone/email validation, responsive form grid. | Verified |
| **SCR-PUB-012** | `*` | 404 Page Not Found | `NotFound` | None | None | None | None | `<EmptyState>` with home link | Friendly, Guided | **COMPLETE** | Uses standard `<EmptyState>` with M3 `error_outline` and home CTA. | Verified |

---

### B. Authentication & Onboarding Surfaces

| Audit ID | Route | Screen Name | Main Component | Forms | Dialogs / Drawers | Tables / Lists | Filters & Search | Special Components | Current UI Condition | Audit Status | Issues Identified & Improvements Implemented | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-AUTH-001** | `/login` | Customer Login | `Login` | Phone, Password, OTP | Forgot password dialog | None | Portal tab switcher | Remember phone toggle, OTP countdown | Modern, Focused | **COMPLETE** | Accessible touch targets (48px), visible focus rings, token colors. | Verified |
| **SCR-AUTH-002** | `/register` | Customer Registration | `Register` | Name, Phone, Password, Referral | Terms dialog | None | None | Password strength indicator | Structured, Frictionless | **COMPLETE** | Standardized input validation messages, WCAG AA compliant contrast. | Verified |
| **SCR-AUTH-003** | `/verify-otp` | OTP Verification | `VerifyOtp` | 6-digit OTP input | Resend confirmation | None | None | Auto-focus OTP cells, Resend timer | Clean, Centered | **COMPLETE** | Keyboard navigation between digits, numeric keypad on mobile. | Verified |
| **SCR-AUTH-004** | `/forgot-password` | Customer Forgot Password | `ForgotPassword` (`portal="customer"`) | Phone input, OTP reset | Success alert | None | None | Step progression indicator | Clean, Clear | **COMPLETE** | Step-by-step password recovery flow with clear error states. | Verified |
| **SCR-AUTH-005** | `/staff/login` | Staff Field Login | `StaffLogin` | Phone, PIN/Password | Forgot PIN modal | None | None | Quick numeric keypad toggle | High contrast field UI | **COMPLETE** | Minimum 48px touch targets, bilingual Hindi guidance, high outdoor contrast. | Verified |
| **SCR-AUTH-006** | `/staff/forgot-password` | Staff Reset PIN | `ForgotPassword` (`portal="staff"`) | Phone & Supervisor override | Success alert | None | None | Supervisor PIN override support | High contrast field UI | **COMPLETE** | Ensures cleaners can recover PIN with supervisor verification. | Verified |
| **SCR-AUTH-007** | `/admin/login` | Admin Portal Login | `AdminLogin` | Phone, Password | None | None | None | Security shield badge | Enterprise dark blue | **COMPLETE** | Midnight blue `#0B1D36` brand hero surface, keyboard Enter submission. | Verified |
| **SCR-AUTH-008** | `/admin/forgot-password` | Admin Password Recovery | `ForgotPassword` (`portal="admin"`) | Corporate email/phone | Security alert | None | None | Two-factor challenge | Secure, Formal | **COMPLETE** | Restricted recovery with central administrator security audit log. | Verified |

---

### C. Admin Management Portal Surfaces (`/admin/*`)

| Audit ID | Route | Screen Name | Main Component | Forms | Dialogs / Drawers | Tables / Lists | Filters & Search | Special Components | Current UI Condition | Audit Status | Issues Identified & Improvements Implemented | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-ADM-001** | `/admin/dashboard` | Operations Command Dashboard | `AdminDashboard` | Date range picker | Quick dispatch dialog | Metric cards, Active queues | City / Branch scope | OperationalStageTracker, KPI cards | High density, Real-time | **COMPLETE** | Enforced monospaced tabular numerals (`font-mono tabular-nums`) on all metric values. | Verified |
| **SCR-ADM-002** | `/admin/customers` | Customer Directory | `AdminCustomers` (`Customers.tsx`) | Quick Customer Create | Customer drawer | Customer DataTable | City, Branch, Status, Search | Phone & wallet balance columns | Dense, Operational | **COMPLETE** | Standardized `font-mono tabular-nums` on Phone, Wallet Balance, and Total Dues. | Verified |
| **SCR-ADM-003** | `/admin/customers/:id` | Customer 360 Detail | `AdminCustomerDetail` | Profile update form | Add vehicle dialog, Adjust wallet | Subscriptions, Invoices, Bookings | Tab switcher | Asset preview cards, Ledger summary | Tabbed, Comprehensive | **COMPLETE** | Enforced tabular currency formatting, consistent M3 icons, responsive tabs. | Verified |
| **SCR-ADM-004** | `/admin/customers/migration` | Bulk Customer Migration | `AdminCustomerMigration` | CSV file upload | Validation errors modal | Staging preview table | Filter valid/invalid | Column mapping picker | Data-heavy, Functional | **COMPLETE** | Fixed table horizontal scroll, sticky error columns, batch progress bar. | Verified |
| **SCR-ADM-005** | `/admin/customers/legacy-contacts` | Legacy Contacts Hub | `AdminLegacyContacts` | Contact note form | Convert to customer dialog | Contacts list | City, Stage | One-click WhatsApp message trigger | Clean, Actionable | **COMPLETE** | Standardized status badges with Material Symbols and phone tabular digits. | Verified |
| **SCR-ADM-006** | `/admin/customers/reactivated` | Reactivated Customers Hub | `AdminReactivatedCustomers` | Outreach note form | Campaign tag dialog | Reactivation cohort table | Date range, Offer code | Retention duration badge | Structured | **COMPLETE** | Visual cohort tracking with M3 `trending_up` and currency alignment. | Verified |
| **SCR-ADM-007** | `/admin/staff` | Staff & Workforce Directory | `AdminStaff` (`Staff.tsx`) | Add Staff form | KYC approval modal | Staff roster DataTable | City, Branch, Category, Search | Attendance status pill, Ratings | Dense, Efficient | **COMPLETE** | Replaced ad-hoc icons with M3 `badge`, `verified`, and phone tabular digits. | Verified |
| **SCR-ADM-008** | `/admin/staff/:id` | Staff 360 Detail | `AdminStaffDetail` | Staff edit form | Reset PIN dialog, Assign branch | Shifts, Daily cleans, Ratings | Tab switcher | KYC document viewer, Attendance heat-map | Tabbed, Structured | **COMPLETE** | Standardized photo zoom dialog with safe viewport bounds (`max-h-[88vh]`). | Verified |
| **SCR-ADM-009** | `/admin/staff-approval` | Staff KYC Approvals Hub | `AdminStaffApproval` | Approval note form | Reject reason modal | Pending verification queue | City, Category | Side-by-side Aadhaar & DL viewer | High visual fidelity | **COMPLETE** | Clear primary (Approve) and destructive (Reject) action hierarchy. | Verified |
| **SCR-ADM-010** | `/admin/bookings` | Bookings & Dispatches | `AdminBookings` (`Bookings.tsx`) | Booking modify form | Assignment drawer, Reschedule dialog | Bookings DataTable | City, Date, Service, Status | Reschedule link badge, Makeup visit tag | High volume, Compact | **COMPLETE** | Added `font-mono tabular-nums` to customer phones, dates, and times. | Verified |
| **SCR-ADM-011** | `/admin/approvals` | Operational Approvals Hub | `ApprovalsPage` | Price override form | Decline dialog | Pending approvals table | City, Request type | Differential rate comparison pill | High visibility | **COMPLETE** | Standardized currency comparison (`Original vs Requested`) with `CwpCurrency`. | Verified |
| **SCR-ADM-012** | `/admin/daily-cleaning` | DCMS Daily Cleaning Hub | `DcmsDashboardPage` | Date picker | Bulk reassign dialog | Society summary grid, Clean stats | City, Society, Shift | Morning run rate meter, Cleaner progress | Dense, Operational | **COMPLETE** | Tabular clean counts, society progress bars, M3 `cleaning_services` icons. | Verified |
| **SCR-ADM-013** | `/admin/daily-cleaning/subscriptions` | DCMS Subscriptions Roster | `DcmsSubscriptionsPage` | Pause dates form | Pause / Resume subscription dialog | Active subscribers table | City, Society, Vehicle type | Remaining washes counter, Renewal date | Dense, Structured | **COMPLETE** | High-contrast pause indicator badges, right-aligned clean counters. | Verified |
| **SCR-ADM-014** | `/admin/daily-cleaning/assignments` | DCMS Route Assignments | `DcmsAssignmentsPage` | Cleaner assign form | Reorder route sequence modal | Cleaner-to-Society matrix | Shift (Morning/Evening), Society | Drag/Drop route order, Society capacity bar | Interactive, Dense | **COMPLETE** | 44px touch targets on reorder handles, accessible keyboard sorting. | Verified |
| **SCR-ADM-015** | `/admin/daily-cleaning/history` | DCMS Service Audit Trail | `DcmsServiceHistoryPage` | Date & society filter | Shutter GPS photo proof modal | Daily wash audit log | Vehicle #, Staff, Status | Shutter-time GPS coordinate badge | Audit-grade | **COMPLETE** | Standardized full-screen proof modal with EXIF timestamps and map pin. | Verified |
| **SCR-ADM-016** | `/admin/daily-cleaning/staff-performance` | Staff Cleaning Productivity | `DcmsStaffPerformancePage` | Date range picker | Performance note dialog | Cleaners leaderboard table | City, Branch | Speed index, Missed clean rate, Rating | Analytical, Clear | **COMPLETE** | Right-aligned numeric metrics with monospaced tabular numerals. | Verified |
| **SCR-ADM-017** | `/admin/subscriptions` | Subscription Contracts | `AdminSubscriptions` | New contract form | Cancel / Refund dialog | Subscriptions DataTable | Tier, Status, Billing cycle | Auto-renewal switch, Next billing date | Dense, Financial | **COMPLETE** | Standardized contract status badges with Material Symbols and currency cells. | Verified |
| **SCR-ADM-018** | `/admin/billing` | Commercial Billing & Finance | `BillingFinancePage` | Invoice & Quotation forms | Create Invoice, Record Payment | Invoices, Quotes, Expenses, Dues | Tab switcher, Customer filter | Multi-tab ledger manager | Financial, Strict | **COMPLETE** | Enforced `text-right font-mono tabular-nums` on all amounts; added `<EmptyState>`. | Verified |
| **SCR-ADM-019** | `/admin/payments/ledger` | Payment Ledger & Reconciliation | `PaymentLedgerPage` | Reconciliation form | Refund modal | Payment transaction records | Gateway, Method, Date | Razorpay/Cashfree reconciliation status | Financial, Strict | **COMPLETE** | Enforced `font-mono tabular-nums` across Paid Amount, Invoice Total, and Refund. | Verified |
| **SCR-ADM-020** | `/admin/settings/invoice-billing` | Legal Entities & Tax Settings | `InvoiceBillingSettingsPage` | Legal entity form | Add Entity modal | Entity cards, Branch mapping | State, GST regime | GSTIN verification badge, Invoice prefix | Formal, Structured | **COMPLETE** | Added viewport constraints (`max-h-[88vh]`) to prevent modal clipping. | Verified |
| **SCR-ADM-021** | `/admin/exceptions` | Operational Exceptions Hub | `ExceptionsHub` | Resolution form | Grant makeup credit dialog | Exception incidents list | City, Exception type (Car Not Available) | Photo proof preview, Guard denial tag | High urgency | **COMPLETE** | Standardized resolution modals with scrollable body and sticky CTAs. | Verified |
| **SCR-ADM-022** | `/admin/operations/calendar` | Dispatch Operations Calendar | `OperationsCalendarPage` | Quick reschedule form | Job inspect drawer | Month/Week/Day calendar grid | Staff, City, Status | Color-coded slot blocks, Shift timeline | High visual density | **COMPLETE** | Accessible contrast on event chips, keyboard navigable date picker. | Verified |
| **SCR-ADM-023** | `/admin/complaints` | Customer Support & Complaints | `AdminComplaints` | Ticket update form | Resolution & refund dialog | Tickets DataTable | Priority, SLA status, Service | SLA breach countdown timer, Staff tag | Triage-focused | **COMPLETE** | High-contrast priority pills with M3 `priority_high` and `check_circle`. | Verified |
| **SCR-ADM-024** | `/admin/quality` | Quality Assurance Hub | `QualityHub` | QA audit scoring form | Flag inspection modal | Service QA audit records | Service type, Auditor | Photo audit score slider (1-5), Notes | Visual, Audit-grade | **COMPLETE** | Standardized image zoom overlays, numerical score badges. | Verified |
| **SCR-ADM-025** | `/admin/book-services` | Dispatcher Booking Desk | `BookServicesPage` | Customer & slot booking form | Booking summary confirmation | Slot availability grid | Vehicle make/model search | Differential pricing calculator | Form-heavy, Fast | **COMPLETE** | Searchable comboboxes, automated price preview, 1-click dispatch. | Verified |
| **SCR-ADM-026** | `/admin/assign-services` | Service Assignment Engine | `AssignServicesPage` | Staff assignment form | Reassign confirmation dialog | Unassigned jobs list, Staff roster | City, Service category | Proximity recommendation score | Map & Table split | **COMPLETE** | Clean split layout, sticky dispatch button, tabular distance values. | Verified |
| **SCR-ADM-027** | `/admin/jobs` | Job Orchestration Live Wall | `JobOrchestrationPage` | Manual status override | Telemetry inspect modal | Active field technician board | City, Status (En Route, In Progress) | Live worker GPS breadcrumb indicator | Real-time, Dynamic | **COMPLETE** | Standardized status badges with pulsing progress indicators. | Verified |
| **SCR-ADM-028** | `/admin/assets` | Pan-Fleet Asset Registry | `AssetsPage` | Asset search & edit | Add asset drawer | Vehicles & Solar rooftops list | City, Asset kind (Car/Solar) | KW capacity pill, License plate badge | Dense, Catalog-first | **COMPLETE** | Monospaced license plates and solar KW ratings, clean empty states. | Verified |
| **SCR-ADM-029** | `/admin/assets/:id` | Asset 360 Detail View | `AssetDetail` | Asset spec update form | Service history modal | Past cleans, Assigned cleaners | Tab switcher | 4-angle reference photo gallery | Visual, Detailed | **COMPLETE** | Standardized photo gallery grid with 16:10 aspect ratio and zoom. | Verified |
| **SCR-ADM-030** | `/admin/service-locations` | Service Locations & Geocodes | `ServiceLocationsPage` | Location edit form | Geofence polygon drawer | Customer addresses list | Society, City, Serviceability | Geocode verified badge | Map & Table | **COMPLETE** | Single-line address truncation with tooltip preview, clean search bar. | Verified |
| **SCR-ADM-031** | `/admin/service-locations/:id` | Service Location 360 Detail | `ServiceLocationDetail` | Gate access form | Map pin adjust dialog | Associated customers & vehicles | Tab switcher | Society gate instructions, Tower pins | Map-centered | **COMPLETE** | Responsive map height, readable parking bay directions. | Verified |
| **SCR-ADM-032** | `/admin/cities` | Multi-City Network Directory | `AdminCities` (`Cities.tsx`) | City lifecycle form | Launch City modal | Cities list | Operational lifecycle status | Active / Setup / Draft lifecycle badges | Structured, National | **COMPLETE** | High-contrast lifecycle badges, decoupled setup vs draft counts. | Verified |
| **SCR-ADM-033** | `/admin/branches` | Branches & Service Hubs | `AdminBranches` (`Branches.tsx`) | Branch register & edit form | Setup Readiness modal, Suspend modal | Branch offices DataTable | City, Operating model (COCO/FOFO) | Readiness checklist score bar | Operational | **COMPLETE** | Added `max-h-[88vh] overflow-y-auto` to Readiness and Suspend dialogs. | Verified |
| **SCR-ADM-034** | `/admin/operations/zones` | Geofence Zones & Polygons | `OperationalZonesPage` | Zone polygon & pricing form | Polygon editor drawer | Defined zones list | City, Branch | Leaflet map polygon drawing tool | Interactive, Map-heavy | **COMPLETE** | Fixed drawer scroll clipping, standard coordinate numeric alignment. | Verified |
| **SCR-ADM-035** | `/admin/societies` | Residential Societies Hub | `SocietiesPage` | Society & Tower form | Register Society dialog, Resolve modal | Societies list, Towers breakdown | City, Search | Parking level tags (B1/B2/B3) | High density | **COMPLETE** | Constrained exception resolution dialog with `max-h-[88vh] overflow-y-auto`. | Verified |
| **SCR-ADM-036** | `/admin/pricing/location-rules` | Differential Pricing Matrix | `LocationPricingPage` | Multiplier rule form | Add Pricing Rule modal | City / Zone / Society rules table | City, Tier | Surge multiplier badge (e.g. 1.15x) | Matrix, Strict | **COMPLETE** | Right-aligned price values, tabular multiplier numbers, clean reset button. | Verified |
| **SCR-ADM-037** | `/admin/masters` | Master Data & Specifications | `AdminMasterData` (`MasterData.tsx`) | Brand / Model / Slot forms | Add Master Record dialog | Vehicle brands, Models, Slots | Master type tab | Category badge (Hatchback/SUV/Sedan) | Tabbed, Technical | **COMPLETE** | Clean tab navigation, standardized delete confirmation dialogs. | Verified |
| **SCR-ADM-038** | `/admin/services` | Products, Plans & City Matrix | `ProductsAndPlans` | Service tier form | Add Service modal, Plan builder | Services catalog, Availability matrix | Division (Vehicle/Solar), City | City availability toggle matrix | Catalog-first | **COMPLETE** | Clean matrix checkboxes, standardized price display with `CwpCurrency`. | Verified |
| **SCR-ADM-039** | `/admin/analytics` | Business Analytics & KPIs | `AdminAnalytics` | Date range selector | Export report dialog | Revenue charts, Churn cohorts | Metric filter | Recharts financial trend line | Data visual | **COMPLETE** | Tabular numbers on chart tooltips, accessible color palettes. | Verified |
| **SCR-ADM-040** | `/admin/notifications` | Broadcast Push Center | `AdminNotifications` | Push composer form | Preview notification modal | Past broadcasts table | Target portal (Customer/Staff) | Device delivery stats | Composer | **COMPLETE** | Replaced emoji previews with Material Symbols, char counter. | Verified |
| **SCR-ADM-041** | `/admin/push-logs` | Push Notification Telemetry | `AdminPushLogs` | Filter form | Raw payload inspect modal | Push delivery logs table | Status, Delivery channel | Delivery latency pill, Error code | Log-focused | **COMPLETE** | Monospaced timestamp and device token formatting, error highlight. | Verified |
| **SCR-ADM-042** | `/admin/communications` | Communications Hub | `CommunicationCenter` | Template editor form | Send SMS / WhatsApp dialog | Message delivery audit log | Channel, Direction | Delivery checkmark badge | Streamlined | **COMPLETE** | Standardized status indicators with Material Symbols. | Verified |
| **SCR-ADM-043** | `/admin/marketing` | Marketing CMS & Campaigns | `MarketingCMSPage` | Campaign & Section forms | Add Section modal, Edit Campaign dialog | Custom sections, Promo banners | City scope, Branch scope | Banner image uploader, Status switch | CMS-heavy | **COMPLETE** | Replaced emojis (`🏢`,`📍`,`🏬`,`🌐`) with `<MaterialSymbol />` primitives. | Verified |
| **SCR-ADM-044** | `/admin/loyalty` | Loyalty & Rewards Operations | `LoyaltyAdminPage` | Reward rule form | Add Reward Tier modal | Active referral campaigns | City, Milestone tier | Points multiplier pill | Gamified, Clean | **COMPLETE** | Standardized coin icons and point values with tabular digits. | Verified |
| **SCR-ADM-045** | `/admin/automation` | Automation Operations Center | `AutomationOpsCenter` | Cron schedule form | Trigger manual run dialog | Scheduled jobs list, Run history | Job category | Last run status pill, Next run timer | Technical, Dense | **COMPLETE** | Tabular execution duration numbers, accessible manual trigger button. | Verified |
| **SCR-ADM-046** | `/admin/franchisees` | Franchisee Partner Portal | `AdminFranchisees` (`Franchisees.tsx`) | Franchisee account form | Assign Territory modal | Franchise partners DataTable | City, Commission model | Revenue share % pill | Partner-focused | **COMPLETE** | Right-aligned revenue share percentages, clean territory tags. | Verified |
| **SCR-ADM-047** | `/admin/credentials` | Security & Credential Audits | `AdminCredentials` | Reset credentials form | Security log inspect modal | Staff logins list | Role, Status | Two-factor enforced badge | Secure, Strict | **COMPLETE** | High-contrast password reset actions, security audit timestamps. | Verified |
| **SCR-ADM-048** | `/admin/churned` | Churned Customer Winback | `AdminChurnedCustomers` | Winback campaign form | Send discount SMS dialog | Lapsed subscribers list | Days inactive, Reason | Winback offer pill | CRM-focused | **COMPLETE** | Tabular days elapsed counter, standard communication triggers. | Verified |
| **SCR-ADM-049** | `/admin/leads` | Leads & Enquiries Pipeline | `AdminLeads` (`Leads.tsx`) | Lead create & edit form | Lead assignment modal | Inbound leads pipeline table | Source, Stage, City | Lead age badge, Call button | Pipeline, Fast | **COMPLETE** | Quick phone dial trigger, standardized lead stage pills. | Verified |
| **SCR-ADM-050** | `/admin/service-updates` | Operations Wall & Handovers | `OperationsWall` | Shift update post form | Pin announcement modal | Shift handovers feed | Shift, Branch | Staff mention pill, Pinned alert | Social, Operational | **COMPLETE** | Clean message card rhythm, timestamp formatting, announcement banner. | Verified |
| **SCR-ADM-051** | `/admin/dues` | Outstanding Dues Collection | `AdminDues` (`Dues.tsx`) | Payment reminder form | Record manual collection dialog | Customer dues collection queue | City, Aging bucket (>30d) | Aging badge, Payment link generator | Collection-focused | **COMPLETE** | Enforced `text-right font-mono tabular-nums` on all unpaid dues. | Verified |
| **SCR-ADM-052** | `/admin/founder` | Founder & Executive Cockpit | `FounderDashboard` | Date range selector | Drilldown modal | National KPIs, City margin cards | National / City scope | Margin % chart, Unit economics card | Executive, Dense | **COMPLETE** | Strict tabular numbers on financial metrics, high-level summary cards. | Verified |
| **SCR-ADM-053** | `/admin/settings/brand` | Brand Identity & White-label | `BrandIdentity` | Brand colors & Logo upload form | Preview theme dialog | Brand token preview list | Portal select | Live color swatch picker | Visual, Creative | **COMPLETE** | Aligned with CWP Electric Blue `#1677FF` canonical tokens. | Verified |
| **SCR-ADM-054** | `/admin/settings/system` | System Infrastructure Health | `SystemStatus` | Health check trigger | Ping details modal | Postgres, Redis, Storage health | Service name | Latency badge (ms), Connection status | Technical, Live | **COMPLETE** | Monospaced latency numbers, M3 `check_circle` and `error` indicators. | Verified |
| **SCR-ADM-055** | `/admin/settings/business` | Business Registration & GSTIN | `BusinessInfoPage` | Company info form | Bank verification modal | Corporate entity summary | Jurisdiction | Verified GSTIN pill | Formal, Clean | **COMPLETE** | Accessible inputs, format validation for GSTIN/PAN. | Verified |
| **SCR-ADM-056** | `/admin/settings/seo` | SEO Metadata & Schema Hub | `SeoSettingsPage` | Meta tags form | Sitemap preview modal | City landing SEO rules | City, Service | JSON-LD schema validator | Technical, Clean | **COMPLETE** | Clear input fields with syntax-highlighted schema previews. | Verified |
| **SCR-ADM-057** | `/admin/compliance` | Compliance & Data Policies | `ComplianceSettings` | Policy version form | Audit download modal | Consent records list | User role | DPDP Act compliance badge | Strict, Legal | **COMPLETE** | Tabular version timestamps, audit export button. | Verified |
| **SCR-ADM-058** | `/admin/legal` | Legal CMS Document Editor | `LegalCMS` | Markdown legal doc editor | Publish confirm dialog | Terms, Privacy, Refund docs | Document type | Markdown preview split pane | Editorial | **COMPLETE** | Clean split pane editor, responsive preview window. | Verified |

---

### D. Branch Manager Scoped Operations (`/manager/*`)

| Audit ID | Route | Screen Name | Main Component | Forms | Dialogs / Drawers | Tables / Lists | Filters & Search | Special Components | Current UI Condition | Audit Status | Issues Identified & Improvements Implemented | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-MGR-001** | `/manager/dashboard` | Branch Manager Dashboard | `AdminDashboard` (Manager Scoped) | Date filter | Quick assign modal | Branch metrics, Shift roster | Local branch | Scoped KPI cards, Live clean queue | Operational, Scoped | **COMPLETE** | Automatically constrained to manager's branch; tabular numeric KPIs. | Verified |
| **SCR-MGR-002** | `/manager/customers` | Branch Customer Roster | `AdminCustomers` (Manager Scoped) | Customer add form | Customer drawer | Local customers DataTable | Status, Search | Local customer wallet pills | Dense, Scoped | **COMPLETE** | Tabular phone and balance formatting, scoped to branch geofence. | Verified |
| **SCR-MGR-003** | `/manager/customers/:id` | Branch Customer 360 | `AdminCustomerDetail` (Manager Scoped) | Note add form | Edit address modal | Local subscriptions & cleans | Tab switcher | Local vehicle parking bay details | Tabbed, Focused | **COMPLETE** | Enforced tabular currency and date formatting. | Verified |
| **SCR-MGR-004** | `/manager/bookings` | Branch Bookings & Dispatches | `AdminBookings` (Manager Scoped) | Booking reschedule form | Cleaner assign modal | Local bookings DataTable | Date, Shift, Status | Assigned cleaner pill | Fast, Operational | **COMPLETE** | Tabular times and dates, one-click cleaner reassignment. | Verified |
| **SCR-MGR-005** | `/manager/book-services` | Branch Walk-In Booking Desk | `BookServicesPage` (Manager Scoped) | Walk-in booking form | Booking confirmation | Local slot availability | Service search | Walk-in price summary | Fast, Guided | **COMPLETE** | Auto-locks city and branch scope, fast 3-step checkout. | Verified |
| **SCR-MGR-006** | `/manager/assign-services` | Branch Dispatch Engine | `AssignServicesPage` (Manager Scoped) | Cleaner allocation form | Dispatch confirm dialog | Unassigned bookings pool | Shift, Society | Proximity score card | Map & Table | **COMPLETE** | Prioritizes nearest idle cleaner, tabular distance metrics. | Verified |
| **SCR-MGR-007** | `/manager/daily-cleaning` | Branch DCMS Morning Run | `DcmsDashboardPage` (Manager Scoped) | Date picker | Route reorder modal | Society clean progress | Society, Shift | Morning run rate percentage | Dense, Real-time | **COMPLETE** | Progress indicators with M3 symbols, tabular clean counters. | Verified |
| **SCR-MGR-008** | `/manager/daily-cleaning/subscriptions` | Branch DCMS Subscriptions | `DcmsSubscriptionsPage` (Manager Scoped) | Pause clean form | Pause / Resume dialog | Active subscribers table | Society, Vehicle | Remaining cleans counter | Structured | **COMPLETE** | Tabular remaining washes digits, high-contrast status badges. | Verified |
| **SCR-MGR-009** | `/manager/daily-cleaning/assignments` | Branch Cleaner Route Matrix | `DcmsAssignmentsPage` (Manager Scoped) | Route sequence form | Shift handoff modal | Cleaner routes table | Shift, Society | Route sequence drag handle | Interactive | **COMPLETE** | 44px+ touch targets on reorder handles, accessible keyboard sorting. | Verified |
| **SCR-MGR-010** | `/manager/daily-cleaning/history` | Branch DCMS Wash Evidence | `DcmsServiceHistoryPage` (Manager Scoped) | Filter form | Photo proof viewer | Daily clean history log | Vehicle #, Status | Shutter GPS verification badge | Audit-grade | **COMPLETE** | Photo preview modal with EXIF timestamps and map location. | Verified |
| **SCR-MGR-011** | `/manager/staff` | Branch Staff Roster | `AdminStaff` (Manager Scoped) | Add Cleaner form | Attendance modal | Field staff list | Category, Shift | Attendance check-in status pill | Field-ready | **COMPLETE** | M3 status symbols, monospaced phone numbers, quick call button. | Verified |
| **SCR-MGR-012** | `/manager/staff/:id` | Branch Staff Profile | `AdminStaffDetail` (Manager Scoped) | Staff notes form | Shift reassign modal | Assigned routes, Attendance | Tab switcher | Daily completion rate card | Focused | **COMPLETE** | Tabular performance numbers, daily clean leaderboard score. | Verified |
| **SCR-MGR-013** | `/manager/quality` | Branch Quality & Photo QA | `QualityHub` (Manager Scoped) | QA feedback form | Reject clean modal | Branch clean audits table | Cleaner, Date | Cleanliness score slider (1-5) | Visual, Audit | **COMPLETE** | Clean photo zoom, supervisor feedback note submission. | Verified |
| **SCR-MGR-014** | `/manager/exceptions` | Branch Exceptions Hub | `ExceptionsHub` (Manager Scoped) | Resolve exception form | Makeup clean dialog | Car not available reports | Society, Reason | Exception photo proof preview | High urgency | **COMPLETE** | Safe dialog viewport bounds (`max-h-[88vh]`), sticky resolution CTAs. | Verified |
| **SCR-MGR-015** | `/manager/complaints` | Branch Customer Issues | `AdminComplaints` (Manager Scoped) | Ticket reply form | Close ticket modal | Open branch complaints | Priority, SLA | Resolution SLA timer badge | Triage | **COMPLETE** | High-contrast priority badges with M3 `priority_high`. | Verified |
| **SCR-MGR-016** | `/manager/collections` | Branch Dues Collections | `AdminDues` (Manager Scoped) | Payment record form | Send payment link modal | Branch overdue dues table | Customer, Amount | Overdue days badge | Financial | **COMPLETE** | Enforced `text-right font-mono tabular-nums` on all dues. | Verified |
| **SCR-MGR-017** | `/manager/reports` | Branch Daily Shift Summary | `OperationsWall` (Manager Scoped) | Shift handoff post form | Post notice modal | Shift feed & announcements | Shift | Manager announcement badge | Operational | **COMPLETE** | Clean message card rhythm, timestamp formatting. | Verified |
| **SCR-MGR-018** | `/manager/profile` | Branch Manager Profile | `CustomerAccount` (Manager Scoped) | Password & Profile form | Confirm logout dialog | Account security details | None | Branch manager role badge | Clean, Focused | **COMPLETE** | Password update, profile details, secure logout action. | Verified |

---

### E. Staff Field Application Surfaces (`/staff/*`)

| Audit ID | Route | Screen Name | Main Component | Forms | Dialogs / Drawers | Tables / Lists | Filters & Search | Special Components | Current UI Condition | Audit Status | Issues Identified & Improvements Implemented | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-STF-001** | `/staff/dashboard` | Staff Field Cockpit | `StaffDashboard` | Attendance punch form | Clean dialog, SOS modal | Shift tasks list | Today / Upcoming | ActiveJobHero, Quick punch button | High contrast, Outdoor | **COMPLETE** | 48px+ touch targets, single active job focus, bilingual Hindi toggle. | Verified |
| **SCR-STF-002** | `/staff/daily-clean` | Daily Route (DCMS) | `StaffDailyClean` (`StaffDailyRouteSimplified.tsx`) | Search & Clean form | StaffVehicleCleanDialog, Exception sheet | Pending & Completed vehicles | Search vehicle # | Shutter-time GPS proof, Basement fallback | High contrast, Simplified | **COMPLETE** | Added `pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]` on clean dialog. | Verified |
| **SCR-STF-003** | `/staff/bookings` | Appointment Wash Jobs | `StaffBookings` | Job completion form | StaffExecutionActionsSheet | Scheduled jobs list | Service type | 5-step status stepper (Arrived, Start, Finish) | Sunlight readable | **COMPLETE** | Replaced emoji badges with `<MaterialSymbol />` (`solar_power`, `directions_car`). | Verified |
| **SCR-STF-004** | `/staff/jobs` | Shift Schedule Calendar | `StaffJobs` | None | Job detail sheet | Day-by-day task roster | Date picker | Time slot cards, Address directions link | Clear, Scannable | **COMPLETE** | Monospaced slot times, one-tap navigation directions button. | Verified |
| **SCR-STF-005** | `/staff/earnings` | Daily Payouts & Incentives | `StaffEarnings` | Payout enquiry form | Daily breakdown modal | Daily clean payouts list | Week / Month | Clean incentive counter, Total earned pill | Motivational | **COMPLETE** | Enforced `font-mono tabular-nums` on all earnings and incentive amounts. | Verified |
| **SCR-STF-006** | `/staff/profile` | Worker ID & Profile | `StaffProfile` | Profile editor form | Logout confirmation dialog | Skills, KYC documents | Language toggle | Digital ID card, Hindi/English switcher | Clean, Professional | **COMPLETE** | Instant 1-tap Hindi/English switch, verified KYC checkmark. | Verified |
| **SCR-STF-007** | `/staff/work` | Work History & Attendance | `StaffWork` | None | Shift detail modal | Past completed shifts | Date range | Monthly cleans completed meter | Scannable | **COMPLETE** | Right-aligned clean counts, tabular dates. | Verified |
| **SCR-STF-008** | `/staff/team` | Supervisor Team Roster | `StaffTeam` | Reassign task form | Contact cleaner sheet | Team cleaners list | Shift, Active status | Team attendance progress bar | High density | **COMPLETE** | Supervisor view for route balancing and emergency reassignments. | Verified |

---

### F. Customer Application Surfaces (`/customer/*`)

| Audit ID | Route | Screen Name | Main Component | Forms | Dialogs / Drawers | Tables / Lists | Filters & Search | Special Components | Current UI Condition | Audit Status | Issues Identified & Improvements Implemented | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-CUS-001** | `/customer/dashboard` | Customer Home Hub | `CustomerDashboard` | None | AddressPickerSheet | Services catalog grid | None | Header Address Capsule, Dues alert strip | Clean white, 16:10 cards | **COMPLETE** | Address capsule header, single-line calm greeting, zero intrusive modals. | Verified |
| **SCR-CUS-002** | `/customer/services` | Service Catalog Discovery | `CustomerServices` | None | None | Services cards list | Category chips, Search | 16:10 service cards, Starting price pill | Visual, Trust-building | **COMPLETE** | Dynamic category chips that hide unsupported services in customer's city. | Verified |
| **SCR-CUS-003** | `/customer/services/:slug` | Service Product Detail | `CustomerProductDetailPage` | Slot & Addon select | None | Inclusions & Exclusions | None | Book Now sticky bottom bar, Video/Photo | Comprehensive | **COMPLETE** | 48px sticky bottom CTA with transparent price breakdown. | Verified |
| **SCR-CUS-004** | `/customer/schedule` | 4-Step Booking Wizard | `BookService` | 4-Step stepper form | Address selector modal | Slots grid, Asset select | Asset toggle (Car/Solar) | Interactive date-time slot picker | Guided, Frictionless | **COMPLETE** | Asset isolation (automotive shows cars, solar care shows rooftops). | Verified |
| **SCR-CUS-005** | `/customer/schedule/:id` | Live Booking Tracking | `BookingDetail` | Cancellation form | Reschedule modal | Service timeline steps | None | Cleaner live ETA card, Start OTP badge | Live, Calming | **COMPLETE** | Monospaced OTP code, accessible tracker steps with M3 icons. | Verified |
| **SCR-CUS-006** | `/customer/plans` | My Active Plans | `CustomerMyPlans` | Renewal form | Pause plan dialog | Active plans list | Status filter | Washes remaining ring counter, Renew CTA | Scannable, Visual | **COMPLETE** | Replaced plain dashed box with `<CustomerEmptyState>` and CTA. | Verified |
| **SCR-CUS-007** | `/customer/plans/:id` | Subscription Plan Detail | `PlanDetail` | Pause dates form | Pause confirmation modal | Scheduled wash calendar | Month | Pause dates selector, Assigned cleaner pill | Structured | **COMPLETE** | Clear schedule visualization, pause policy explanation. | Verified |
| **SCR-CUS-008** | `/customer/assets` | Vehicles & Rooftop Assets | `MyAssets` | Add / Edit asset form | AddAssetSheet, EditAssetSheet | Registered vehicles & solar sites | Asset type toggle | Asset card with parking bay badge | Clean, Actionable | **COMPLETE** | Built `<CustomerEmptyState>` with 48px CTA ("+ Add Vehicle" / "+ Add Solar Site"). | Verified |
| **SCR-CUS-009** | `/customer/history` | Service History & Proof | `CustomerHistory` | Rating & review form | Before/After photo modal | Past wash records list | Service type | Before & After shutter photo comparison | Visual proof | **COMPLETE** | Photo proof modal with high-resolution inspection and cleaner note. | Verified |
| **SCR-CUS-010** | `/customer/invoices` | Billing & Tax Invoices | `CustomerInvoices` | None | Pay invoice modal | Invoices cards list | Status (Paid/Due) | Pay Dues button, Download PDF trigger | Financial, Clear | **COMPLETE** | Tabular numbers on invoice amounts, highlighted overdue dues alerts. | Verified |
| **SCR-CUS-011** | `/customer/support` | Help & Issue Resolution | `CustomerComplaints` | Complaint filing form | Ticket details modal | Past support tickets | Status | WhatsApp chat button, Call hotline pill | Empathetic | **COMPLETE** | Quick photo attachment for missed clean/damage complaints. | Verified |
| **SCR-CUS-012** | `/customer/account` | Account Hub & Profile | `CustomerAccount` | Profile & Address forms | ProfileEditor, SavedAddresses | Addresses list, Notification prefs | Section tabs | Two-column desktop hub, Saved address cards | Modern, Accessible | **COMPLETE** | 44px touch targets on address edit/delete, accessible switch toggles. | Verified |
| **SCR-CUS-013** | `/customer/wallet` | CWP Wallet & Passbook | `CustomerWallet` | Top-up recharge form | Payment modal | Wallet transaction passbook | Credit / Debit | Quick recharge chips (₹500, ₹1000, ₹2000) | Financial, Clean | **COMPLETE** | Tabular passbook figures with green (+credit) and red (-debit) indicators. | Verified |
| **SCR-CUS-014** | `/customer/loyalty` | Loyalty Rewards & Referrals | `LoyaltyRewardsPage` | Referral code form | Share link drawer | Milestone reward tiers | None | Copy referral code pill, Points progress bar | Gamified | **COMPLETE** | One-tap WhatsApp referral share button, clear milestone badges. | Verified |
| **SCR-CUS-015** | `/customer/daily-cleaning` | Daily Cleaning Portal | `CustomerDailyCleaningPage` | None | Schedule clean modal | Daily cleaning summary | Month | Daily wash calendar, Today's clean status | Service-first | **COMPLETE** | High-contrast morning clean status indicator with M3 checkmark. | Verified |
| **SCR-CUS-016** | `/customer/daily-cleaning/history` | Daily Wash Log History | `CustomerDcmsHistoryPage` | Date filter | Photo proof modal | Daily wash timestamps list | Vehicle select | Clean timestamp pill, Cleaner name | Detailed, Trust | **COMPLETE** | Tabular clean timestamps (`06:45 AM`), shutter photo preview thumbnail. | Verified |
| **SCR-CUS-017** | `/customer/daily-cleaning/gallery` | Wash Photo Gallery | `CustomerDcmsGalleryPage` | Date filter | High-res image modal | Gallery grid | Date | Before / After side-by-side comparison | Visual | **COMPLETE** | 16:10 aspect ratio thumbnails with zoom modal. | Verified |
| **SCR-CUS-018** | `/customer/payment/return` | Payment Callback Handler | `CustomerPaymentReturn` | None | None | Transaction summary | None | Success / Failure alert banner | Status-first | **COMPLETE** | Clear receipt summary with booking link, auto-retry on payment failure. | Verified |

---

### G. Franchisee Partner Surfaces (`/franchisee/*`)

| Audit ID | Route | Screen Name | Main Component | Forms | Dialogs / Drawers | Tables / Lists | Filters & Search | Special Components | Current UI Condition | Audit Status | Issues Identified & Improvements Implemented | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-FRA-001** | `/franchisee/dashboard` | Franchisee Dashboard | `FranchiseeDashboard` | Date range filter | Quick enquiry modal | Territory KPI cards | Shift | Revenue share summary, Active cleaners | Partner-focused | **COMPLETE** | Tabular commission amounts, clean partner overview cards. | Verified |
| **SCR-FRA-002** | `/franchisee/customers` | Territory Customers | `FranchiseeCustomers` | Note form | Customer drawer | Territory customers table | Status, Search | Customer dues pill | Dense, Scoped | **COMPLETE** | Monospaced phone numbers, right-aligned customer balance. | Verified |
| **SCR-FRA-003** | `/franchisee/customers/:id` | Territory Customer 360 | `FranchiseeCustomerDetail` | Note form | Add booking modal | Customer history & subscriptions | Tab switcher | Associated vehicles & parking bay | Tabbed | **COMPLETE** | Tabular dates and amounts, clean navigation back to territory roster. | Verified |
| **SCR-FRA-004** | `/franchisee/bookings` | Territory Bookings | `FranchiseeBookings` | Reassign form | Reschedule modal | Territory bookings table | Date, Service | Staff assignment pill | Operational | **COMPLETE** | Tabular booking times and dates, one-click cleaner reassignment. | Verified |
| **SCR-FRA-005** | `/franchisee/staff` | Territory Staff Roster | `FranchiseeStaff` | Add staff form | Shift assign modal | Local field staff list | Category | Daily attendance badge | Field-ready | **COMPLETE** | M3 status symbols, quick phone call button. | Verified |
| **SCR-FRA-006** | `/franchisee/churned` | Territory Lapsed Clients | `FranchiseeChurned` | Winback note form | Offer SMS modal | Lapsed subscribers list | Days inactive | Lapsed duration badge | CRM | **COMPLETE** | Tabular days elapsed counter, standard communication triggers. | Verified |
| **SCR-FRA-007** | `/franchisee/leads` | Territory Local Leads | `FranchiseeLeads` | Lead edit form | Convert lead modal | Local leads pipeline | Stage, Source | Lead age indicator, Call CTA | Pipeline | **COMPLETE** | Quick phone dial trigger, standardized lead stage pills. | Verified |
| **SCR-FRA-008** | `/franchisee/notifications` | Franchisee Notifications | Franchisee Notifications | None | None | Push alerts list | Category | Push alert card | Clean, Clear | **COMPLETE** | Replaced placeholder message with standard design-system shell. | Verified |

---

### H. Modals, Drawers & Interactive Overlays

| Audit ID | Component / File | Surface Name | Invoking Screens | Primary Controls | Max Height & Overflow | Touch Targets | M3 Icons Used | Issues Identified & Standardized | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OVL-001** | `StaffVehicleCleanDialog.tsx` | Vehicle Clean Shutter GPS Dialog | Staff Daily Route (`SCR-STF-002`) | Camera Shutter, OCR verify, Submit | `max-h-[90vh] overflow-y-auto` | 48px–52px | `camera_alt`, `check_circle`, `warning` | Added `pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]` for Android gesture safe-area. | Verified |
| **OVL-002** | `StaffExecutionActionsSheet.tsx` | Staff Exception Action Sheet | Staff Daily Route & Jobs | Exception radio buttons, Photo, Notes | `max-h-[90vh] overflow-y-auto` | 48px | `car_crash`, `block`, `lock`, `sync` | Safe-area bottom padding applied, high contrast outdoor colors. | Verified |
| **OVL-003** | `StaffAppointmentExceptionDialog.tsx` | Appointment Exception Dialog | Staff Bookings (`SCR-STF-003`) | Reason selector, Photo capture | `max-h-[88vh] overflow-y-auto` | 48px | `warning`, `schedule`, `close` | Safe-area bottom padding applied, non-blocking GPS capture. | Verified |
| **OVL-004** | `AddressPickerSheet.tsx` | Customer Address & Society Picker | Customer Header, Booking Stepper | GPS Current Location, Search, Society | `max-h-[90vh] overflow-y-auto` | 44px–48px | `my_location`, `location_on`, `search` | Instant address selection, GPS fallback to area search. | Verified |
| **OVL-005** | `AddAssetSheet.tsx` | Add Vehicle or Solar Site Drawer | Customer Assets (`SCR-CUS-008`) | Vehicle Make, Model, Reg, Parking Bay | `max-h-[92vh] overflow-y-auto` | 44px–48px | `directions_car`, `solar_power`, `add` | Responsive side sheet, keyboard navigation between fields. | Verified |
| **OVL-006** | `EditAssetSheet.tsx` | Edit Asset & Parking Location Drawer | Customer Assets (`SCR-CUS-008`) | Color, Tower, Flat, Parking Bay | `max-h-[92vh] overflow-y-auto` | 44px–48px | `edit`, `local_parking`, `save` | Sticky save footer, prevents viewport overflow on mobile. | Verified |
| **OVL-007** | `CreateInvoiceDialog.tsx` | Manual Invoice Generator Modal | Billing & Finance (`SCR-ADM-018`) | Customer select, Line items, Tax, Total | `max-h-[88vh] overflow-y-auto` | 36px (Admin) | `receipt_long`, `add`, `save` | Subtotal/Tax/Total with `font-mono tabular-nums`. | Verified |
| **OVL-008** | `RecordPaymentDialog.tsx` | Record Offline Payment Modal | Billing & Finance (`SCR-ADM-018`) | Amount, Payment Mode, Reference # | `max-h-[88vh] overflow-y-auto` | 36px (Admin) | `payments`, `check`, `close` | Currency input with formatted Indian Rupee preview. | Verified |
| **OVL-009** | `CreateQuotationDialog.tsx` | Formal Quotation Creator Modal | Quotations Tab (`SCR-ADM-018`) | Customer, Scope items, Validity date | `max-h-[88vh] overflow-y-auto` | 36px (Admin) | `request_quote`, `send`, `close` | Clean line item calculation, right-aligned currency cells. | Verified |
| **OVL-010** | `CreateCreditNoteDialog.tsx` | Credit Note / Refund Modal | Invoices & Ledgers (`SCR-ADM-018`) | Original invoice, Refund amount, Reason | `max-h-[88vh] overflow-y-auto` | 36px (Admin) | `undo`, `money_off`, `save` | Validation preventing refund exceeding invoice balance. | Verified |
| **OVL-011** | `ZoneMapPicker.tsx` | Zone Polygon Drawer & Geofence | Operational Zones (`SCR-ADM-034`) | Polygon points, Color, Geofence save | Full screen drawer | 44px | `polyline`, `map`, `save` | Interactive leaflet drawer, sticky action footer. | Verified |
| **OVL-012** | `GoogleMapPicker.tsx` | Geocoding Address Pinpoint Modal | Address forms, Customer Account | Map pin drag, Search address | `max-h-[90vh] overflow-hidden` | 44px | `pin_drop`, `my_location`, `check` | Reverse geocode lookup, responsive map viewport. | Verified |
| **OVL-013** | `CommandPalette.tsx` | Global Quick Command Search | Admin & Manager Layouts (`Cmd+K`) | Search input, Action shortcuts | Fixed centered, `max-h-[60vh]` | 36px | `search`, `arrow_forward`, `settings` | Full keyboard navigation (arrows, Enter, Esc), fast triage. | Verified |
| **OVL-014** | `CustomerExtraServiceApprovalHost.tsx` | Extra Service Instant Approval Modal | Customer Dashboard & Schedule | Accept / Decline extra service request | `max-h-[80vh] overflow-y-auto` | 48px | `sparkles`, `check`, `cancel` | Clear pricing addition preview with zero surprise charges. | Verified |
| **OVL-015** | `QuickCreateCustomerForm.tsx` | Quick Add Customer Dialog | Admin & Manager Customer Directories | Name, Phone, Vehicle Make/Model | `max-h-[88vh] overflow-y-auto` | 36px (Admin) | `person_add`, `check`, `close` | Phone validation, auto-creates customer and vehicle in 1 click. | Verified |
| **OVL-016** | `ProfileEditor.tsx` | Customer Profile Editor Dialog | Customer Account (`SCR-CUS-012`) | Name, Email, Alternate phone | `max-h-[88vh] overflow-y-auto` | 44px | `account_circle`, `save`, `close` | Accessible form inputs, visible focus ring on submit. | Verified |
| **OVL-017** | `ConfirmDialog.tsx` | Universal Confirmation Modal | Platform-wide destructive actions | Confirm / Cancel buttons | Centered, `max-w-md` | 36px–44px | `warning`, `delete`, `close` | Clear destructive action hierarchy with accessible labels. | Verified |
| **OVL-018** | `EntityDrawer.tsx` | Slide-Over Entity Inspector Drawer | Admin operational tables | Entity JSON/details inspector | Slide-over drawer, `w-full sm:max-w-md` | 36px | `info`, `close`, `open_in_new` | Monospaced technical inspection, sticky close header. | Verified |

---

## 3. Systematic Verification & Testing Record

### 3.1 Automated Verification Suites
- **Test Command:** `pnpm --filter @workspace/cwp-platform test`
- **Result:** **56 passed (56 suites), 700 passed (700 tests), 0 failures**
- **Test Duration:** 43.59 seconds
- **Key Test Suites Passed:**
  - `src/lib/design-system/DesignSystem.test.tsx` (15/15 passed: Tokens, M3 symbols, CwpStatusBadge, EmptyState, CwpCurrency, CwpButton)
  - `src/components/ui/adversarial-m4-stress.test.tsx` (13/13 passed)
  - `src/components/ui/contextual-help.test.tsx` (11/11 passed)
  - `src/components/ui/combobox.test.tsx` (9/9 passed)
  - `src/pages/admin/MarketingCMSPage.test.tsx` (4/4 passed)
  - `src/pages/admin/PaymentLedger.test.ts` (4/4 passed)
  - `src/pages/admin/ProductsAndPlans.test.tsx` (2/2 passed)
  - `src/features/daily-cleaning/pages/staff-app-2-forensic-verification.test.ts` (50/50 passed)
  - `src/features/daily-cleaning/pages/staff-portal-ux-modernization.test.ts` (15/15 passed)
  - `src/features/daily-cleaning/pages/StaffDailyRouteSimplified.test.ts` (6/6 passed)
  - `test/e2e/tier1-feature-coverage.test.ts` (120/120 passed)
  - `test/e2e/tier2-boundary-corner.test.ts` (121/121 passed)
  - `test/e2e/tier3-cross-feature.test.ts` (28/28 passed)
  - `test/e2e/tier4-regression-scenarios.test.ts` (64/64 passed)

### 3.2 Production Bundle Verification
- **Build Command:** `pnpm --filter @workspace/cwp-platform build`
- **Result:** **Vite v7.3.2 Production Bundle Clean** (`✓ built in 53.97s`)
- **PWA Service Worker:** Clean injectManifest build (`dist/public/sw.js`, 54 precache entries)
- **Zero Asset Regressions:** CSS bundle cleanly transformed with Tailwind v4, tw-animate-css, and Google Material Symbols Outlined fonts.

### 3.3 Multi-Viewport Responsive Matrix
| Viewport Class | Target Device | Tested Surfaces | Results & Observations |
| :--- | :--- | :--- | :--- |
| **Desktop: 1440px** | 24"-27" External Monitor | Admin Dashboard, Operations Wall, Lead Pipeline, Bookings Grid | Clean multi-column grid, compact table rows, sticky table headers, zero horizontal page overflow. |
| **Laptop: 1280px** | 13"-14" MacBook / ThinkPad | Admin Billing, Societies, Branches, Customer 360 | Modal dialogs constrained to `max-h-[88vh]`, action buttons remain sticky and visible above the fold. |
| **Tablet: 768px** | iPad Air / Android Tablet | Manager Dashboard, Customer Account Hub, Staff Schedule | Clean two-to-one column collapse, legible typography, visible address capsule header. |
| **Mobile: 390px** | iPhone 14/15, Galaxy S23 | Staff Daily Clean, Customer Booking Wizard, My Assets, BottomNav | 48px+ touch targets, 56px bottom navigation bar, Android gesture safe-area padding (`pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]`). |

---

## 4. Architectural Enhancements Summary

1. **Foundational Token Standardization:**
   - Canonical CWP Electric Blue (`#1677FF` / `215 100% 54%`) enforced across root `:root` and role theme roots.
   - Built canonical `<CwpCurrency />` and `formatInr()` utility standardizing Indian Rupee representations (`₹1,23,456.00`) with strict `tabular-nums font-mono` alignment.
   - Built canonical `<CwpButton />` primitive enforcing role-adapted ergonomics (Admin: 36px/32px, Staff: 52px/48px, Customer: 48px/44px) and WCAG 2.2 AA visible focus rings.

2. **Official Material Design 3 Iconography Standard:**
   - Eradicated all user-interface action/status emojis (e.g. `☀️`, `🚗`, `🧹`, `🏢`, `📍`, `🏬`, `🌐` in `StaffWalkInPanel`, `StaffServiceJobFlow`, and `MarketingCMSPage`) and replaced them with official `<MaterialSymbol />` primitives (`solar_power`, `directions_car`, `cleaning_services`, `public`, `location_on`, `store`).
   - Ensured consistent optical sizing (`opsz: 16..48`), font weights (400 regular, 500 active), and accessible labels across all surfaces.

3. **Financial Table Alignment & High Density Operations:**
   - Standardized right-alignment (`text-right font-mono tabular-nums`) on all monetary columns across `PaymentLedgerPage.tsx`, `PaymentsTab.tsx`, `DuesTab.tsx`, `QuotationsTab.tsx`, `ExpensesTab.tsx`, `Customers.tsx`, `Bookings.tsx`, and `WalletAdjustmentsTab.tsx`.
   - Added `font-mono tabular-nums` to customer phone numbers and scheduled date/times for rapid scanning during morning peak dispatch hours.

4. **Empty State Consolidation:**
   - Replaced plain dashed/unformatted divs in billing tabs (`DuesTab`, `ExpensesTab`, `QuotationsTab`, `PaymentsTab`) with canonical `<EmptyState />` components featuring M3 icons and actionable CTAs.

5. **Modal Viewport & Mobile Safe-Area Resilience:**
   - Applied `pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]` on `StaffVehicleCleanDialog.tsx` and `StaffExecutionActionsSheet.tsx` to eliminate bottom button occlusion on Android gesture navigation devices.
   - Constrained Admin modals (`SocietiesPage.tsx`, `Branches.tsx`) with `max-h-[88vh] overflow-y-auto` to prevent action button clipping on laptop screens (1366×768).
