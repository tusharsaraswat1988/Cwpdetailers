# Service Catalog — Final Implementation Readiness Report

**Project:** CWP Detailers  
**Date:** 15 June 2026  
**Status:** Pre-implementation validation — **not ready to ship**  
**Basis:** [`SERVICE_CATALOG_REDESIGN_REPORT_V3.md`](./SERVICE_CATALOG_REDESIGN_REPORT_V3.md)  
**Goal:** Confirm pricing governance for franchise expansion and prove a branch owner can run the business without software-engineering terminology.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Pricing Control — Option A vs Option B](#2-pricing-control--option-a-vs-option-b)
3. [Recommended Pricing Model](#3-recommended-pricing-model)
4. [Terminology Leak Audit](#4-terminology-leak-audit)
5. [Readiness Scorecard](#5-readiness-scorecard)
6. [Implementation Phases (When Approved)](#6-implementation-phases-when-approved)
7. [Acceptance Criteria — Branch Owner Test](#7-acceptance-criteria--branch-owner-test)
8. [Document History](#8-document-history)

---

## 1. Executive Summary

### Verdict: **Not implementation-ready**

The **founder mental model is validated** (V3). The **codebase is not**. A branch owner opening the admin today would still encounter assets, locations, categories, matrices, slabs, entitlements, credits, and DCMS — across **28+ UI touchpoints** and **legacy seed data**.

### Pricing governance recommendation

**Adopt Option A as the default franchise rule**, with a **HQ-controlled** optional city price list (not franchise-edited matrices):

| Role | Controls |
|------|----------|
| **CWP HQ** | All product names, prices, plan inclusions, city availability, and any city-specific price list |
| **Franchise branch owner** | Enable/disable products in their city; run bookings, staff, billing |
| **Engineering** | Pricing engines (matrices, slabs) — never visible to HQ or franchise in daily UI |

Option B (franchise self-service price overrides) is **not recommended** for CWP’s branded, multi-city expansion model unless limited to HQ-approved exceptions.

### Readiness at a glance

| Area | Ready? |
|------|--------|
| Founder business model (docs) | ✅ Yes |
| Database can support model | ✅ Yes (tables exist) |
| Seed / catalog data aligned | ❌ No |
| Branch-owner UI copy & navigation | ❌ No |
| Service Catalog UI structure | ❌ No |
| Book Service wizard language | ❌ No |
| Customer Profile language | ⚠️ Partial (Phase 1B helped) |
| Pricing governance implemented | ❌ No (no RBAC split yet) |
| Technical terms hidden from branch owner | ❌ No |

**Estimated blockers:** 4 implementation phases before a franchise branch owner can pass the acceptance test in §7.

---

## 2. Pricing Control — Option A vs Option B

### Scenario

CWP expands via franchisees. Each city has a branch. Products are defined centrally (Car Wash, Daily Cleaning, Solar). The question is who sets the ₹ on the price tag.

---

### Option A — HQ controls all prices; franchise enables/disables products

**Rule:** Service Catalog is owned by CWP HQ. A franchise turns products on or off for their city. Prices are read-only for the branch owner.

| Dimension | Impact |
|-----------|--------|
| **Operational** | Branch opens → HQ publishes catalog → franchise toggles “we sell daily cleaning in Patna.” Staff book at HQ prices. No local pricing meetings, no branch-manager spreadsheet drift. Disputes resolved centrally. |
| **Branding** | **Strong.** Website, app, invoice, and branch quote show the same “Foam Wash ₹399” nationwide (or HQ-defined city list). Customer trust in “CWP price” preserved. |
| **Scalability** | **Strong.** One catalog update rolls to all cities. Analytics compare apples to apples. New city = toggle products + assign staff, not re-price 40 SKUs. |
| **Franchise economics** | Margin negotiated in franchise agreement (revenue share / cost-plus), not per-SKU local editing. Simpler contract. |
| **Flexibility** | **Low** for branch — cannot undercut locally or match a regional competitor without HQ action. |
| **Risk** | HQ becomes bottleneck for legitimate regional cost differences (tier-2 city labour). Mitigated by HQ publishing **city price lists** (still HQ-authored, not franchise-edited). |

**Best when:** Brand consistency matters more than local price experimentation — which matches CWP’s franchise story.

---

### Option B — Franchise overrides prices per city

**Rule:** HQ defines products; franchise sets local ₹ per product (or per vehicle class) in their city.

| Dimension | Impact |
|-----------|--------|
| **Operational** | Each branch manager becomes a pricing analyst. Training burden rises. Errors (wrong hatchback price, forgotten solar AMC update) become revenue leaks. Audit trail fragmented. |
| **Branding** | **Weak.** Customer in Varanasi pays ₹399; friend in Patna pays ₹449 for “the same” CWP wash. Website cannot show one national price. SEO and ads become city-specific. |
| **Scalability** | **Poor.** N franchises × M products × optional vehicle variants = combinatorial config. HQ cannot read consolidated revenue without normalizing local overrides. |
| **Franchise economics** | **High local flexibility** — franchise can adjust for rent, labour, competition. |
| **Risk** | Race to the bottom between franchises; brand dilution; customer complaints (“your website said ₹399”); temptation to expose matrices/slabs to “fix” pricing — exactly the technical UX V3 rejects. |

**Best when:** Franchisees are quasi-independent operators under a loose brand — **not** CWP’s model.

---

### Side-by-side

| Criterion | Option A | Option B |
|-----------|----------|----------|
| Brand consistency | ✅ High | ❌ Low |
| Branch owner simplicity | ✅ High | ❌ Low |
| HQ analytics | ✅ Clean | ⚠️ Noisy |
| Local market response | ⚠️ HQ-mediated | ✅ Direct |
| Exposes pricing engines to franchise | ✅ Avoided | ❌ Almost inevitable |
| Matches V3 “sellable prices only” | ✅ Yes | ⚠️ Invites engine UI |

---

## 3. Recommended Pricing Model

### 3.1 Ruling — Option A with HQ city price lists

```
┌─────────────────────────────────────────────────────────┐
│  CWP HQ (Service Catalog)                               │
│  • Define products & sellable prices                  │
│  • Optional: Patna price list (HQ sets, not franchise)│
│  • Publish to cities                                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Franchise branch owner                                 │
│  • Toggle: “Sell this product in my city” ON/OFF       │
│  • Cannot edit ₹ (read-only price from HQ)             │
│  • Book → quote uses HQ/city price automatically       │
└─────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Engineering (hidden)                                   │
│  • vehicle_matrix, solar_slab rules                     │
│  • Used only when product = “quoted at booking”         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 When Patna needs different prices

Do **not** give franchise a matrix editor. HQ chooses one of:

1. **Separate product rows** — “Foam Wash — Patna” at ₹449 (founder-friendly, V3-aligned).
2. **HQ city price list** — same product slug, HQ sets Patna override in Admin → Cities (single ₹ field per product, not a grid).
3. **Separate DCMS plan rows** — “Premium Plan — Patna” at ₹1,699/month.

Franchise **never** edits these. Franchise only confirms “we sell this here.”

### 3.3 Variable pricing without exposing engines

| Product type | Branch owner sees | System does silently |
|--------------|-------------------|----------------------|
| Fixed-price service | ₹399 on catalog | — |
| Car size affects price | “Price confirmed at booking” | `service_pricing` matrix |
| Solar one-time | Quote: ₹2,400 for 40 panels | `solar_pricing_slabs` |
| Daily plan | ₹1,499/month on plan card | DCMS allocation rules |
| Wash package | ₹1,600 for 4 washes | Grant N washes on purchase |

### 3.4 RBAC implication (future implementation)

| Permission | HQ admin | Franchise branch owner |
|------------|----------|------------------------|
| Edit Service Catalog products/prices | ✅ | ❌ |
| Toggle city product availability | ✅ | ✅ (own city only) |
| View pricing engines | ✅ Engineering role only | ❌ |
| Book services / billing / staff | ✅ | ✅ |

---

## 4. Terminology Leak Audit

Scan date: 15 June 2026. Scope: admin UI, navigation, seed data, enums, packages, customer-facing ops paths.

**Legend:** 🔴 Branch owner sees today · 🟡 HQ/admin-only but should rename · ⚪ Backend-only (acceptable if never surfaced)

---

### 4.1 Asset

| Location | Leak | Severity |
|----------|------|----------|
| `BookServices/types.ts` — step label `"Asset"` | 🔴 | P0 |
| `AssetSelect.tsx` — “Which asset is being serviced?”, “Assets module” | 🔴 | P0 |
| `ReviewSummaryStep.tsx` — label `"Asset"` | 🔴 | P0 |
| `Customer360Overview.tsx` — “Service → Asset → Location → Booking” | 🔴 | P0 |
| `CustomerBookingDataContext.tsx` — same flow string | 🔴 | P0 |
| `CustomerLinkedAssetsPanel.tsx` — panel id, links to `/admin/assets` | 🔴 | P0 |
| `ActiveServicesSummary.tsx` — table column `"Asset"` | 🔴 | P0 |
| `AssetsPage.tsx` / `AssetDetail.tsx` — entire pages (“New asset”, “Asset not found”) | 🔴 | P1 (routes exist, sidebar hidden) |
| `CustomerDetail.tsx` — CTA links to `/admin/assets` | 🔴 | P0 |
| `assign-services/api.ts` — `assetLabel` (display if shown) | 🟡 | P1 |
| DB / API `assets`, `assetId` | ⚪ | OK if UI says “Car” / “Vehicle” |

**Target copy:** Car · Vehicle · Solar site — never “asset” in branch-owner UI.

---

### 4.2 Location

| Location | Leak | Severity |
|----------|------|----------|
| `BookServices/types.ts` — step `"Service Location"` | 🔴 | P0 |
| `LocationSelect.tsx` — “Service Locations module” | 🔴 | P0 |
| `ReviewSummaryStep.tsx` — `"Service location"` | 🟡 | P0 → “Service address” |
| `CustomerServiceLocationsPanel.tsx` — uses `service-locations` API | 🟡 | P1 |
| `ServiceLocationDetail.tsx` — “Service location not found” | 🔴 | P1 |
| `CustomerDetail.tsx` — CTA to `/admin/service-locations` | 🔴 | P0 |
| DB `service_locations`, `serviceLocationId` | ⚪ | OK |

**Target copy:** Service address · Where we go — never “location” as a module noun.

---

### 4.3 Category

| Location | Leak | Severity |
|----------|------|----------|
| `ProductsAndPlans.tsx` — Categories tab | 🔴 | P0 |
| `CategoriesTab.tsx` — “Service Categories” | 🔴 | P0 |
| `ServicesTab.tsx` — required Category dropdown, `serviceCategoryId` | 🔴 | P0 |
| `MasterData.tsx` — vehicle categories, service categories tabs | 🟡 | P1 (HQ admin) |
| `Staff.tsx` — “Staff Category” (supervisor/cleaning) | 🟡 | P2 (different domain — rename to “Role type”) |
| DB `service_categories`, `services.category` enum | ⚪ | Deprecate from founder path |
| Seed slugs: `doorstep-car-wash`, `solar-amc`, etc. | 🟡 | P1 |

**Target:** Revenue line picker (Car Wash / Daily Cleaning / Solar) — no “category” in catalog UI.

---

### 4.4 Matrix

| Location | Leak | Severity |
|----------|------|----------|
| `ServicesTab.tsx` — `"Vehicle Matrix (by category/seats)"` pricing model | 🔴 | P0 |
| `ServicesTab.tsx` — “Master Data → vehicle matrix” helper text | 🔴 | P0 |
| `PricingTab.tsx` — placeholder “Leave empty for matrix only”, display “Matrix pricing” | 🔴 | P0 |
| `dynamicPricing.ts` — `pricing_matrix` source | ⚪ | OK |
| DB `pricing_model = vehicle_matrix`, `service_pricing` | ⚪ | OK |

**Target:** Remove pricing model picker from branch catalog. HQ sets price or “confirmed at booking.”

---

### 4.5 Slab

| Location | Leak | Severity |
|----------|------|----------|
| `ProductsAndPlans.tsx` — Solar tab → `SolarSlabsTab` | 🔴 | P0 |
| `SolarSlabsTab.tsx` — “Add Solar Slab”, “Configured Slabs”, “Save Slab” | 🔴 | P0 |
| `ServicesTab.tsx` — `"Solar Slab (per panel)"`, “Configure panel slabs in Solar Slabs tab” | 🔴 | P0 |
| DB `solar_pricing_slabs`, `pricing_model = solar_slab` | ⚪ | OK |

**Target:** Delete slab UI from all founder/franchise paths.

---

### 4.6 Entitlement

| Location | Leak | Severity |
|----------|------|----------|
| `lib/customer-model/products.ts` — `hubSection: "entitlements"`, label “Wash packages & credits” | 🟡 | P1 |
| `customer-contracts.ts` — `source_system = entitlement`, `contract_credits` | ⚪ | OK |
| `fulfillmentMode.ts` — comments reference entitlements | ⚪ | OK |
| `service-catalog/api.ts` — `/catalog/entitlements`, `useCustomerEntitlements` | 🟡 | P1 if exposed in UI |
| `WalletSummaryPanel.tsx` — “Wash credits… live on service contracts” | 🔴 | P1 → “Washes left on package” |
| DB `customer_entitlements`, `catalog_package_entitlements` | ⚪ | OK |

**Target copy:** “Washes remaining”, “Visits remaining on plan” — never “entitlement.”

---

### 4.7 Credit

| Location | Leak | Severity |
|----------|------|----------|
| DB enum `wash_credit`, `cleaning_credit`, `detailing_credit` | ⚪ | **P0 seed cleanup** for `cleaning_credit` packages |
| `seed-catalog-migration.ts` — `cleaning_credit: 30` in daily-cleaning package | 🔴 | P0 |
| `PackagesTab.tsx` — no credit UI but lists solar + daily packages | 🔴 | P0 |
| `WalletSummaryPanel` — “not service credits” | 🟡 | Acceptable if wallet stays finance-only |
| Wallet transaction type `credit`/`debit` | 🟡 | P2 — finance domain; use “Added” / “Deducted” in branch UI |

**Target copy:** “4 washes included”, “2 washes left” — never “credits.”

---

### 4.8 Pricing Rule (and related)

| Location | Leak | Severity |
|----------|------|----------|
| `PricingTab.tsx` — “Price By City” tab group | 🔴 | P0 |
| `ProductsAndPlans.tsx` — PRICING_TABS group | 🔴 | P0 |
| `ServicesTab.tsx` — “Pricing Model” dropdown | 🔴 | P0 |
| V2/V3 docs “pricing rules” | ⚪ | Engineering docs only |

**Target:** No “Pricing” section in Service Catalog for branch owner. HQ city screen = product toggles + optional read-only prices.

---

### 4.9 Additional leaks (not in checklist but block founder UX)

| Term / concept | Location | Severity |
|----------------|----------|----------|
| **DCMS** | Sidebar Legacy → “DCMS Operations” | 🔴 P1 |
| **Package** (mixed lines) | `PackagesTab` shows solar AMC + daily-cleaning seed packages | 🔴 P0 |
| **Wash Card** in DCMS | `prune-dcms-plans.ts` — 4 washes, 0 cleanings | 🔴 P0 |
| **1 Time Wash** in DCMS | Same script — belongs in Car Wash Services | 🔴 P0 |
| **Daily Cleaning + 2 Washes** | `catalog_packages` seed — duplicates DCMS | 🔴 P0 |
| **Master Data** | Admin nav — vehicle brands, categories | 🟡 P1 HQ-only |
| **contract_credits** fulfillment label | Book services API types | 🟡 P1 |
| **Linked Assets** | Component filename + test ids | 🟡 P1 |

---

### 4.10 Navigation summary

| Nav item | Branch owner today | Target |
|----------|-------------------|--------|
| Customer Profile | ✅ Primary | Keep |
| Book / Assign / Updates | ✅ | Keep |
| Service Catalog | ⚠️ Leaks pricing tabs | Restructure V3 |
| Assets / Locations | ✅ Hidden from sidebar (Phase 1B) | Remove deep links from Customer CTAs |
| Master Data | 🟡 Admin section | HQ-only; strip service categories |
| Legacy → DCMS Operations | 🔴 | Hide from franchise role |
| Franchisee portal | ✅ Separate routes | Same copy rules apply |

---

## 5. Readiness Scorecard

| # | Gate | Status | Blocker count |
|---|------|--------|---------------|
| G1 | Founder model documented (V3) | ✅ Pass | 0 |
| G2 | Pricing governance decision | ✅ Pass (Option A §3) | 0 |
| G3 | DCMS schema matches Premium Plan | ✅ Pass | 0 |
| G4 | DCMS isolated from wash packages in **data** | ❌ Fail | 3 seed/plan leaks |
| G5 | Service Catalog UI = 3 lines, no engines | ❌ Fail | 5 tabs/components |
| G6 | Customer ops = no asset/location modules | ❌ Fail | 10+ strings/routes |
| G7 | Book Service wizard = plain language | ❌ Fail | 4 steps |
| G8 | Zero technical terms in branch-owner path | ❌ Fail | ~28 touchpoints |
| G9 | Franchise RBAC for Option A | ❌ Not built | New work |
| G10 | Branch owner acceptance test (§7) | ❌ Would fail today | All above |

**Overall readiness: 3 / 10 gates pass → Do not implement catalog restructure without Phase 1 copy + data cleanup plan.**

---

## 6. Implementation Phases (When Approved)

No code in this document. Recommended sequence:

### Phase 1 — Data & seed alignment (P0, no UI)

- Remove `catalog_packages` daily-cleaning bundles (`daily-cleaning-2-washes`, any `cleaning_credit`).
- Move “Wash Card” from `dcms_plans` → Car Wash Package; remove “1 Time Wash” from DCMS.
- Split `PackagesTab` data: wash-only under Car Wash; solar under Solar line.
- Document HQ price list per city (Option A) — can start as Varanasi-only until Patna launch.

### Phase 2 — Service Catalog restructure (P0 UI)

- Three revenue-line tabs: Car Wash (Services | Packages), Daily Cleaning, Solar (3 products).
- **Delete** from catalog: Price By City, Solar Pricing, Categories, Pricing Model dropdown.
- HQ catalog forms: name, description, price (or “quoted at booking”), inclusions — only.

### Phase 3 — Customer & booking language (P0 UI)

- Book Service steps: Customer → **Service address** → **Car / solar site** → Service → …
- Remove module references (“Assets module”, “Service Locations module”).
- Customer CTAs: inline add car/address dialogs — not `/admin/assets` or `/admin/service-locations`.
- Replace Overview flow hint: “Pick service, car, and address when booking.”
- Active services / history rows: show car + address on each line.

### Phase 4 — Pricing governance & franchise (P1)

- RBAC: franchise read-only catalog prices; city product toggles only.
- HQ Admin → Cities: product availability checklist (no matrix).
- Hide Master Data service categories + vehicle matrix from franchise role.
- Engineering-only tools for slab/matrix seeding (CLI or superadmin, not branch path).

### Phase 5 — Polish & validation (P2)

- Rename internal hub labels (`entitlements` → “Wash packages” in copy only).
- Staff “Category” → “Role type.”
- Run §7 acceptance test with non-technical user.

---

## 7. Acceptance Criteria — Branch Owner Test

Hand a franchise branch owner the admin **with no glossary**. They must complete all tasks using only plain business words.

| # | Task | Must not encounter |
|---|------|-------------------|
| 1 | Find customer Rajesh | — |
| 2 | Book Foam Wash for his Honda at home address | Asset, location, module link |
| 3 | Sell 4-wash package | Entitlement, credit |
| 4 | Enrol car on Premium daily plan (26 cleans, 2 washes, 4 offs) | DCMS, category |
| 5 | Sell solar 6-month plan | Slab, matrix |
| 6 | See what Rajesh is owed | Credit (wallet OK as “money balance”) |
| 7 | Confirm which products branch sells | Pricing rule, matrix |
| 8 | Explain the three things CWP sells | Category, engine |

**Pass threshold:** 8/8 tasks, 0 forbidden words on screen during tasks.

**Today:** Estimated **3/8 pass** (customer find, book partial, billing partial).

---

## 8. Document History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 15 Jun 2026 | Final pre-implementation readiness — pricing governance + leak audit |

---

## Appendix A — Pricing Decision Card (for founder sign-off)

**Question:** Who controls pricing when CWP expands through franchisees?

**Recommendation:** **Option A** — HQ controls all sellable prices; franchise enables/disables products per city.

**Why not Option B:** Damages brand consistency, forces pricing-engine UX into franchise hands, and scales poorly across cities.

**Exception path:** If Patna needs different ₹, HQ publishes a Patna price list — franchise does not self-edit.

**Sign-off required before Phase 4:** ☐ Approved ☐ Modified ☐ Rejected

---

## Appendix B — Forbidden Word List (branch-owner UI)

These words must **not appear** in any screen, button, tab, error message, or tooltip visible to a franchise branch owner:

`Asset` · `Location` (as a noun/module) · `Category` · `Matrix` · `Slab` · `Entitlement` · `Credit` (except “credit card” payment) · `Pricing Rule` · `Pricing Model` · `DCMS` · `Engine` · `Matrix pricing` · `Grant` · `Slug` · `Enum`

**Allowed replacements:** Car · Vehicle · Solar site · Service address · Plan · Package · Washes included · Washes left · Visits left · ₹/month · Price · Quote

---

## Appendix C — DCMS Premium Plan — final confirmation

Founder example:

```
Premium Plan — ₹1,499/month — 26 daily cleans — 2 washes — 4 weekly offs
```

| Field | `dcms_plans` column | Supported |
|-------|---------------------|-----------|
| Premium Plan | `name` | ✅ |
| ₹1,499/month | `price` (+ UI label “/month”) | ✅ |
| 26 daily cleans | `included_cleanings` | ✅ |
| 2 washes | `included_washes` | ✅ |
| 4 weekly offs | `weekly_offs` | ✅ |

**Isolated from wash packages after cleanup:** Yes — once `catalog_packages` daily bundles and DCMS “Wash Card” are relocated. Until then: **schema yes, data no**.

**Founder types this in admin today via:** Daily Cleaning Plans tab (`DcmsPlansPanel`) — correct surface, wrong surrounding catalog context and mixed seed data.
