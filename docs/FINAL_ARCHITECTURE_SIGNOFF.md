# Final Architecture Sign-Off

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Status:** Pre-Development Gate  
**Review panel:** Final architecture validation (documentation review)

---

## Sign-Off Decision

# ✅ Approved with Conditions

Architecture is **implementation-ready**. Sprint 1 (Navigation Restructure) **may begin immediately**.

Sprint 4 must follow the **4A → 4B → 4C** split defined in [`SERVICE_CONTRACT_REVIEW_V2.md`](./SERVICE_CONTRACT_REVIEW_V2.md) §6.

---

## Documents Under Review

| # | Document | Status |
|---|----------|--------|
| 1 | [`ARCHITECTURE_VALIDATION_REPORT_V1.md`](./ARCHITECTURE_VALIDATION_REPORT_V1.md) | ✅ Accepted |
| 2 | [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) | ✅ Accepted with Sprint 4 amendment (below) |
| 3 | [`PRODUCTS_SERVICES_ADMIN_RESTRUCTURE_REPORT_V3.md`](./PRODUCTS_SERVICES_ADMIN_RESTRUCTURE_REPORT_V3.md) | ✅ Accepted |
| 4 | [`DATA_RELATIONSHIP_V1.md`](./DATA_RELATIONSHIP_V1.md) | ✅ Accepted with terminology addendum |
| 5 | [`SCREEN_MAPPING_V2.md`](./SCREEN_MAPPING_V2.md) | ✅ Accepted |
| 6 | [`SERVICE_CONTRACT_MODEL_V1.md`](./SERVICE_CONTRACT_MODEL_V1.md) | ✅ Accepted with V2 clarifications |
| 7 | [`SERVICE_CONTRACT_REVIEW_V2.md`](./SERVICE_CONTRACT_REVIEW_V2.md) | ✅ This review |

---

## What Is Approved

### Domain model

- Eight operational modules (Services, Service Locations, Assets, Customers, Book Services, Assign Services, Service Updates, Billing & Finance)
- Book Services chain: **Customer → Service Location → Asset → Service → …**
- **Service Contract** as logical layer mapping to existing tables (`dcms_subscriptions`, `customer_entitlements`, `bookings`, `customer_contracts`)
- Three fulfillment tracks: `one_time`, `contract_recurring`, `contract_credits`
- Wallet = ₹ monetary ledger only; packages = entitlements, not wallet
- Customer 360 Billing Summary retained (read-only)
- Default Service Location on customer create
- Asset ownership via link history (`operational` / `commercial` / `historical`)
- No new modules beyond what is already specified

### Service type coverage

| Line | Variants | Approved mapping |
|------|----------|------------------|
| Daily Car Cleaning | Monthly / Quarterly / Half-yearly / Annual | `contract_recurring` → `dcms_subscriptions` |
| Doorstep Wash | One-time | `one_time` → `bookings` |
| Doorstep Wash | Multi-wash package | `contract_credits` → `customer_entitlements` |
| Solar | One-time | `one_time` → `bookings` |
| Solar | 6 / 12 / Custom AMC | `contract_recurring` → entitlement + scheduled jobs |

### Implementation sequence

| Sprint | Approved to start | Notes |
|--------|-------------------|-------|
| **Sprint 1** — Nav restructure | **✅ Now** | No blockers |
| **Sprint 2** — Service Locations | After Sprint 1 | Default location included |
| **Sprint 3** — Assets | After Sprint 2 | Ownership links included |
| **Sprint 4A** — Wizard shell (steps 1–7) | After Sprint 3 | Replaces monolithic Sprint 4 |
| **Sprint 4B** — Contract persistence | After Sprint 4A | Fulfillment branching |
| **Sprint 4C** — Quote/invoice/assign | After Sprint 4B | E2E sell |
| **Sprint 5** — Customer 360 | After Sprint 4B (partial) | Billing Summary |
| **Sprint 6** — Assign Services | After Sprint 4C | |
| **Sprint 7** — Service Updates | After Sprint 6 | |
| **Sprint 8** — Billing | After Sprint 4C + 5 | |

### Long-term compatibility (no redesign required)

- Customer portal: reads `customer_contracts` + visits + jobs + invoices
- Staff app: continues `dcms_visits` + `bookings` APIs
- Franchise portal: same model with `franchiseeId` scoping
- Renewals: new plan via Book Services + Communication Center reminders
- Route optimization / GPS: additive geo on locations and work events

---

## Conditions (Must Meet Before / During Implementation)

These are **not architecture blockers** for Sprint 1. They are **mandatory implementation rules** for Sprints 2–4.

| # | Condition | Owner | Deadline |
|---|-----------|-------|----------|
| C1 | Adopt **business terminology glossary** from SERVICE_CONTRACT_REVIEW_V2 §1.2 in all admin UI copy | Frontend | Sprint 1 + 4A |
| C2 | **Split Sprint 4** into 4A / 4B / 4C per SERVICE_CONTRACT_REVIEW_V2 §6 | Engineering lead | Sprint planning |
| C3 | Solar AMC classified as **`contract_recurring`** only (not `contract_credits`) | Backend | Sprint 4B |
| C4 | Wash packages remain **`contract_credits`** only | Backend | Sprint 4B |
| C5 | Solar AMC visit **auto-scheduler** may follow 4B; manual job creation acceptable interim | Product | Post 4B |
| C6 | Add `serviceLocationId` on new contract/booking creates | Backend | Sprint 4B |
| C7 | Never expose "Entitlement", "DCMS", or "Subscription" in admin UI | Frontend | Sprint 1 onward |
| C8 | `customer_contracts` registry is **sole read path** for Customer 360 Active Plans | Backend | Sprint 4B / 5 |

---

## Remaining Blockers Before Development

### Blockers for Sprint 1

**None.** ✅

Sprint 1 is navigation and copy only — no schema, no contract logic, no Book Services.

### Blockers for Sprint 4 (collectively)

| Blocker | Status | Resolution |
|---------|--------|------------|
| SERVICE_CONTRACT_MODEL_V1 acceptance | ✅ Resolved | This sign-off |
| Sprints 2–3 complete (locations + assets) | ⏳ Pending | Execute sequence |
| Sprint 4 split agreed | ✅ Resolved | 4A/4B/4C in conditions |
| Solar AMC fulfillment mode ambiguity | ✅ Resolved | `contract_recurring` (C3) |

### Non-blockers (explicitly deferred)

| Item | Why not blocking |
|------|------------------|
| Solar AMC auto-scheduler | Manual jobs until automation built |
| Unified `service_contracts` single table | Registry pattern sufficient for V1 |
| Renewal automation | Post–Sprint 4B workflow |
| Payment gateway | Billing module already separate |
| Coupon engine | Future discount step |
| Franchisee-scoped locations | `franchiseeId` exists; full scoping later |

---

## Explicitly Not Approved (Out of Scope for This Phase)

| Item | Reason |
|------|--------|
| Merging `dcms_subscriptions` + `entitlements` into one table now | High risk; registry pattern sufficient |
| New "Loyalty" or "Credits Wallet" module | Founder ruled wallet = ₹ only |
| Customer-owned asset/location CRUD | Assets + Service Locations modules own CRUD |
| Skipping Service Locations step in Book Services | Required for B2B multi-site |

---

## Risk Register (Accepted)

| Risk | Level | Mitigation |
|------|-------|------------|
| Sprint 4 domain complexity | High | Split 4A/4B/4C |
| Asset/location migration | Medium–High | Dual-read `vehicles.customerId` |
| Solar AMC without scheduler | Medium | Manual jobs interim (C5) |
| Billing regression in 4C | Medium–High | Feature flags + parallel quotation route |
| Terminology drift in UI | Low | Glossary (C1, C7) |

---

## Architecture Readiness Statement

> **The architecture is genuinely ready for development.**
>
> SERVICE_CONTRACT_MODEL_V1 is complete and practical for CWP's three service lines and six product families. The model maps to code that already exists. No additional domain modules are required.
>
> Further architecture discussion should be limited to **implementation detail within approved sprints** — not new structural redesign.

---

## Sign-Off Checklist

| Check | Done? |
|-------|-------|
| All service types validated | ✅ |
| Terminology recommendation documented | ✅ |
| Renewal workflow architecturally supported | ✅ |
| Customer portal compatible | ✅ |
| Staff app compatible | ✅ |
| Sprint 4 split recommended | ✅ |
| Sprint 1 unblocked | ✅ |
| No code/migrations in this review | ✅ |

---

## Next Action

**Begin Sprint 1 — Navigation Restructure.**

Reference: [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md) Sprint 1 acceptance criteria.

Amend implementation sequence during sprint planning to replace "Sprint 4" with **4A, 4B, 4C** (documentation update in next planning pass — not a sign-off blocker).

---

## Document History

| Version | Date | Decision |
|---------|------|----------|
| 1.0 | 14 Jun 2026 | **Approved with Conditions** |

---

*This sign-off covers architecture documentation only. Production implementation follows approved sprint sequence.*
