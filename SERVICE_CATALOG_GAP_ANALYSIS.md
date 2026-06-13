# CWP Service Catalog Engine — Gap Analysis

**Date:** 14 June 2026  
**Scope:** Review current implementation vs. required multi-city Service Catalog Engine  
**Current operations:** Varanasi | **Future:** Patna, Lucknow, and additional cities

---

## Review Summary

| Area | Current State | Location |
|------|---------------|----------|
| Database | Partial catalog schema | `lib/db/src/schema/services.ts`, `service-management.ts`, `city-masters.ts`, `vehicle-masters.ts`, `subscriptions.ts` |
| Services | Basic CRUD + legacy enum | `services` table, `artifacts/api-server/src/routes/services.ts` |
| Pricing | Vehicle matrix (no city); solar hardcoded | `service_pricing`, `dynamicPricing.ts`, `solarPricing.ts` |
| Packages | `service_plans` (subscription tiers) | `service-management.ts`, seed in `seed-master-data.ts` |
| Bookings | Auto-price on create; credit on complete | `bookings.ts`, `subscriptions/service.ts` |
| Entitlements | Subscription counters only | `subscriptions.servicesUsed/Remaining` |
| CMS/SEO | Site-wide only | `legal-cms.ts`, `Landing.tsx` hardcoded content |
| Admin UI | Basic service list; no pricing/plans UI | `admin/Services.tsx`, `admin/MasterData.tsx` |

---

## A. What Already Exists?

### Database & Masters
- **`services`** — name, description, category enum, basePrice, duration, features, imageUrl, assignmentStrategy
- **`service_categories`** — name, slug, legacyCategory, sortOrder, isActive
- **`service_plans`** — subscription/package tiers linked to serviceId (price, durationMonths, features, tag)
- **`service_pricing`** — vehicle category × seat category price matrix (no city dimension)
- **`vehicle_categories` / `seat_categories`** — master data for vehicle-based pricing
- **`states` / `cities` / `service_areas` / `pincodes`** — geographic masters (Varanasi, Lucknow, etc. seeded)
- **`subscriptions`** — visit counters (`totalServices`, `servicesUsed`, `servicesRemaining`), AMC types, offDays, wallet daily rate

### API
- CRUD: `/api/services`, `/api/masters/service-categories`, `/api/masters/service-plans`, `/api/masters/service-pricing`
- Public: `/api/catalog/services`, `/api/catalog/plans`, `/api/pricing/quote?serviceId=&vehicleModelId=`
- Booking price resolution via `resolveBookingAmount()` in `dynamicPricing.ts`

### Business Logic (Partial)
- Vehicle pricing matrix lookup with fallbacks (exact → seat → category → basePrice)
- Subscription credit decrement on booking **completion** (`decrementOnCompletion`)
- Daily cleaning wallet debit on completion
- Renewal/expiry reminders via subscription daily tick
- Fixed 18% GST helpers (`gst.ts`) on invoices

### Admin & Customer UI
- Admin: basic service create/delete, master data for vehicles/cities/categories
- Customer: `BookService.tsx` uses catalog + pricing quote
- Landing: DB plans when available; hardcoded fallbacks for solar tiers, testimonials, cities

---

## B. What Is Hardcoded?

| Item | Hardcoded Value | File |
|------|-----------------|------|
| Solar cleaning price | ₹60/panel, min ₹800 | `solarPricing.ts`, `cwp-platform/src/lib/solar-pricing.ts` |
| GST rate | 18% global | `gst.ts` |
| Service category enum | pgEnum in DB + UI array | `services.ts`, `admin/Services.tsx` |
| Homepage car wash plans | Fallback array when DB empty | `Landing.tsx` |
| Solar AMC tiers | Hardcoded discount tiers | `Landing.tsx` |
| Testimonials | Static array | `Landing.tsx` |
| Cities served | `["Varanasi"]` | `Landing.tsx` |
| Seed pricing | ₹299–₹799 wash matrix, ₹600–₹1600 plans | `seed-master-data.ts` |
| Business types | Implicit via enum, not admin-managed catalog structure | Multiple |

**No city-specific pricing exists anywhere in runtime logic.**

---

## C. What Can Already Be Configured?

| Capability | Mechanism | Limitation |
|------------|-----------|------------|
| Service list | Admin Services + API | No edit, no CMS, no archive |
| Service categories | Master Data API | No display/SEO flags |
| Vehicle pricing matrix | API `/masters/service-pricing` | No admin UI; no cityId |
| Subscription plans | API `/masters/service-plans` | No admin UI; not entitlement-aware |
| Vehicle/seat classes | Master Data admin | ✅ Fully configurable |
| Cities/pincodes | Master Data admin | Not linked to services or pricing |
| Site SEO | SEO Settings admin | Site-wide only |
| Brand identity | Brand admin | Not service-specific |

---

## D. What Must Be Redesigned?

1. **Service Categories** — Add display flags (website, booking, SEO), richer admin UX
2. **Services** — Slug, status (active/disabled/archived), CMS fields, per-service GST, pricing model type
3. **City-Specific Pricing** — `cityId` on pricing rows + city availability matrix
4. **GST Engine** — Per service/package/addon pricing type (inclusive/exclusive) + global default
5. **Solar Pricing** — DB-driven slabs (panel ranges, per-panel rate, minimum billing) per city
6. **Addons** — New addon catalog + service linkage + booking selection
7. **Package Builder** — Packages as entitlement containers (not just price tiers)
8. **Entitlement Engine** — Dedicated `customer_entitlements` with credits, expiry, status (beyond subscription counters)
9. **Consumption Rules** — Wire entitlements to booking completion (extend existing subscription flow)
10. **Self-Booking Eligibility** — Check credits + validity + city coverage
11. **Reminder Hooks** — Event hooks for notification engine (AMC due, expiry)
12. **Service CMS + SEO** — Per-service and per-city content
13. **Homepage CMS** — Admin-managed sections (no hardcoded marketing)
14. **Admin UX** — Tabbed service catalog console (not giant forms)

---

## E. Can Current Structure Support Future Requirements?

| Requirement | Current Support | Verdict |
|-------------|-----------------|---------|
| **Multi-city pricing** | Cities exist; pricing has no cityId | ❌ Must extend |
| **Vehicle-based pricing** | `service_pricing` matrix works | ✅ Extend with cityId |
| **Solar slab pricing** | Hardcoded formula only | ❌ New `solar_pricing_slabs` table |
| **Addons** | Not present | ❌ New tables + booking integration |
| **AMC packages** | `subscriptions` + `service_plans` partial | ⚠️ Extend with entitlement engine |
| **Entitlements** | Subscription counters only | ⚠️ Redesign with dedicated entitlements |

**Conclusion:** Foundation is usable (services, vehicle matrix, plans, subscriptions, city masters) but requires schema extension and engine layer — not a greenfield rewrite.

---

## F. Migration Impact

### Data Migration (Varanasi)
| Current Record | Target |
|----------------|--------|
| Basic Car Wash, Premium Car Wash | Services under "Doorstep Car Wash" category with slugs |
| Solar Panel Cleaning | Service with solar slab pricing (₹60/panel, min ₹800) |
| Solar AMC (Annual) | Package with 12 cleaning credits / 365 days |
| Daily Cleaning plans (₹1000–₹1600) | `catalog_packages` with entitlements |
| `service_pricing` matrix | Copy to Varanasi cityId rows |
| Hardcoded Landing content | `homepage_sections` records |

### Code Migration
- Replace `computeSolarCleaningPrice()` with DB lookup
- Extend `resolveVehiclePricing()` with optional `cityId`
- Extend `resolveBookingAmount()` with city + addons
- Booking completion: consume entitlement credits (alongside subscription decrement)
- Landing.tsx: read from catalog CMS APIs

### Risk
- **Low:** Existing bookings/subscriptions unaffected (additive schema)
- **Medium:** Pricing quote API signature gains `cityId` param (backward compatible default = Varanasi)
- **Low:** Admin users gain new `/admin/catalog` screen; old `/admin/services` redirects

### Rollback
- Migration 008 is additive (ALTER + CREATE). Rollback = drop new tables/columns; legacy fields preserved.

---

## Recommended Architecture

```
service_categories (admin, sortable, display flags)
    └── services (CMS, GST, pricing model, slug)
            ├── service_city_availability (city on/off + base override)
            ├── service_pricing (city × vehicle × seat)
            ├── solar_pricing_slabs (city × panel range)
            └── service_addon_links → service_addons

catalog_packages (not services)
    └── catalog_package_entitlements (service + credit count + validity)

customer_entitlements (runtime grants from packages/AMC)
    └── consumed on booking completion

homepage_sections + service_city_content (CMS/SEO)
```

---

## Phase 1 Complete — Proceed to Implementation

Implementation will deliver Migration 008, catalog engine library, API routes, Varanasi data migration, admin catalog console, and removal of hardcoded pricing paths.
