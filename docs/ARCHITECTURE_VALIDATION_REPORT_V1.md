# Architecture Validation Report V1

**Project:** CWP Detailers  
**Date:** 14 June 2026  
**Status:** Final Pre-Implementation Validation — Documentation Only  
**Documents reviewed:**

- [`PRODUCTS_SERVICES_ADMIN_RESTRUCTURE_REPORT_V3.md`](./PRODUCTS_SERVICES_ADMIN_RESTRUCTURE_REPORT_V3.md)
- [`SCREEN_MAPPING_V2.md`](./SCREEN_MAPPING_V2.md)
- [`DATA_RELATIONSHIP_V1.md`](./DATA_RELATIONSHIP_V1.md)

**New companion docs:**

- [`SERVICE_CONTRACT_MODEL_V1.md`](./SERVICE_CONTRACT_MODEL_V1.md)
- [`IMPLEMENTATION_SEQUENCE_V1.md`](./IMPLEMENTATION_SEQUENCE_V1.md)

---

## Executive Verdict

| Question | Answer |
|----------|--------|
| Is architecture implementation-ready? | **Conditionally yes** |
| Can Sprint 1 start immediately? | **Yes** — nav restructure only |
| Can Sprint 4 start without further modeling? | **No** — Service Contract layer must be accepted first |
| Major rework risk if we proceed blindly? | **High** on Book Services without contract model |
| Overall recommendation | **Proceed with 8-sprint sequence; freeze SERVICE_CONTRACT_MODEL_V1 before Sprint 4** |

---

## 1. Architecture Review Findings

### 1.1 Strengths (Keep)

| Area | Assessment |
|------|------------|
| Module separation (8 ops modules) | Sound — matches how staff think |
| Service Locations | Correct — multi-site B2B requires this |
| Assets as independent masters | Correct — transfer and reuse supported |
| Wallet ₹-only rule | Clear — prevents entitlement confusion |
| Billing & Finance separate | Correct — finance can operate without booking context |
| Customer 360 Billing Summary | Correct — visibility without CRUD duplication |
| Existing backend primitives | `dcms_subscriptions`, `entitlements`, `customer_contracts` already exist |

### 1.2 Critical Gaps

| # | Gap | Impact | Resolution |
|---|-----|--------|------------|
| G1 | **No explicit Service Contract layer in V3/DATA_RELATIONSHIP** | Daily cleaning & AMC modeled as "bookings" | [`SERVICE_CONTRACT_MODEL_V1.md`](./SERVICE_CONTRACT_MODEL_V1.md) |
| G2 | **`serviceLocationId` absent on existing contracts** | Location chain breaks for DCMS | Add on contract create in Sprint 4 |
| G3 | **Three fulfillment modes not distinguished in Book Services docs** | Wrong runtime record created | Branch Step 8 by `fulfillmentMode` |
| G4 | **Asset ownership history underspecified** | Transfer breaks billing history | See §3 below |
| G5 | **No default location strategy** | Staff friction on first booking | See §4 below |
| G6 | **Work event types unnamed** | Visits vs bookings conflated | Rename: Booking = work event umbrella |

### 1.3 Medium Gaps

| # | Gap | Impact |
|---|-----|--------|
| G7 | Billing lifecycle doesn't distinguish contract vs visit invoicing | Periodic DCMS billing unclear |
| G8 | `customer_contracts` role as registry not prominent in V3 | Customer 360 may re-build 3 views |
| G9 | Solar AMC scheduled visit generation not specified | Manual booking for 24 visits |
| G10 | Renewal / extension workflow absent | End-of-contract churn |

### 1.4 Low Gaps (Future)

| # | Gap |
|---|-----|
| G11 | Franchisee-scoped locations |
| G12 | Coupon engine |
| G13 | Payment gateway reconciliation |
| G14 | Unified `service_contracts` single table |

---

## 2. Service Contract Recommendation

### Finding

V3 flattening **Customer → … → Booking** is insufficient. The codebase already stores contracts in `dcms_subscriptions`, `customer_entitlements`, and aggregates via `customer_contracts` — but V3 docs do not elevate this layer.

### Recommendation — **APPROVE Service Contract layer**

```
Customer → Service Location → Asset → Service → Service Contract → Work Events → Assignment → Invoice → Payment
```

| Contract type | Existing storage | Fulfillment |
|---------------|------------------|-------------|
| Daily cleaning | `dcms_subscriptions` | Recurring visits (`dcms_visits`) |
| Wash package | `customer_entitlements` | Credit redemption → `bookings` |
| Solar AMC | `customer_entitlements` | Scheduled visits → `bookings` |
| One-time | `bookings` | Direct — no long-lived contract |

**Do not** merge tables in Sprint 4. Unify **terminology and Book Services routing** first.

| Attribute | Value |
|-----------|-------|
| Priority | **Critical** |
| Risk | Medium (if schema merge attempted too early); Low (terminology + routing only) |
| Dependency | Blocks Sprint 4 until accepted |
| Document | [`SERVICE_CONTRACT_MODEL_V1.md`](./SERVICE_CONTRACT_MODEL_V1.md) |

---

## 3. Asset Ownership Recommendation

### Finding

V3 defines independent asset masters and `customer_asset_links` but does not distinguish **operational custody** vs **commercial billing party** vs **historical ownership**.

### Recommendation — **Three-track ownership model**

| Track | Purpose | Storage |
|-------|---------|---------|
| **Asset Master** | Identity of vehicle/solar (reg no, specs) | `assets` / `vehicles` / `solar_sites` |
| **Operational Link** | Who receives service now; at which location | `location_asset_links` + `customer_location_links` |
| **Ownership History** | Audit trail for transfers | `customer_asset_links` with `effectiveFrom`, `effectiveUntil`, `linkType` |

#### `linkType` values (proposed)

| Value | Meaning |
|-------|---------|
| `operational` | Current service recipient |
| `commercial` | Billing party if different (B2B fleet) |
| `historical` | Previous owner after transfer |

#### Transfer rules

| Rule | Detail |
|------|--------|
| Asset master never hard-deleted | Status → `retired` |
| On transfer | Close prior link (`effectiveUntil`); open new link |
| Historical billing | Invoices keep snapshot FKs — do not rewrite |
| Book Services | Uses **operational** link at booking time |
| Customer 360 | Shows current operational links only; history in Assets module |

| Attribute | Value |
|-----------|-------|
| Priority | **High** |
| Risk | Medium — migration of `vehicles.customerId` |
| Dependency | Sprint 3 (Assets) |

**Reject** separate "Operational Owner" and "Commercial Owner" as duplicate entities — use **link types** on one history table instead.

---

## 4. Default Service Location Recommendation

### Finding

Requiring manual location creation before every first booking adds friction for retail customers (single home address).

### Recommendation — **YES: auto-create default location**

| Trigger | Action |
|---------|--------|
| Customer create (admin) | Auto-create location `Primary` with `isDefault: true` |
| Customer quick-create (Book Services Step 1) | Same auto-create |
| Customer migration import | Backfill one default per customer from profile address |
| Corporate customer | Default + prompt to add Factory/Office as needed |

#### Default location fields

```
label:        "Primary" (or "Default")
locationType: residence (retail) | office (corporate default)
address:      copied from customer profile
isDefault:    true
isAutoCreated: true
```

#### Book Services behavior

| Scenario | Behavior |
|----------|----------|
| Customer has 1 default location | Pre-select in Step 2 |
| Customer has multiple | Show picker; default highlighted |
| Customer has none (legacy) | Prompt create OR auto-create on first Book Services |

| Attribute | Value |
|-----------|-------|
| Priority | **High** |
| Risk | Low |
| Dependency | Sprint 2 (Service Locations) |

---

## 5. Booking vs Contract Lifecycle Validation

### Finding

One-time and recurring services **must not** share the same lifecycle state machine.

### Validated model — **Three tracks** (see SERVICE_CONTRACT_MODEL_V1 §7)

| Track | Services | Parent entity | Work events |
|-------|----------|---------------|-------------|
| **A — Ad-hoc** | One-time wash, one-time solar | None (or ephemeral) | `bookings` |
| **B — Recurring contract** | Daily car cleaning | `dcms_subscriptions` | `dcms_visits` |
| **C — Credit contract** | Wash package, solar AMC | `customer_entitlements` | `bookings` on redeem |

### Conflict with V3 billing lifecycle

V3 lifecycle (`Quotation → … → Work Scheduled → …`) applies to **Track A** and **contract initiation** in Tracks B/C. Individual DCMS visits use a **shorter sub-lifecycle**:

```
Visit: scheduled → assigned → in_progress → complete (→ optional per-visit invoice)
```

| Attribute | Value |
|-----------|-------|
| Priority | **Critical** |
| Risk | High if ignored in Sprint 4 |
| Dependency | Sprint 4 + Sprint 7 |

---

## 6. Long-Term Scalability Review

| Future scenario | Architecture fit | Weak point | Mitigation |
|-----------------|-------------------|------------|------------|
| **Customer Portal** | Good | Book Services 9-step must become API-driven flow | Expose same chain as API contract in Sprint 4 |
| **Franchise Portal** | Partial | `franchiseeId` on contracts but no franchise-scoped locations | Phase B: franchisee location scope |
| **Staff Mobile App** | Good | Already uses DCMS visits + bookings | Service Contract ID on work events for context |
| **Route Optimization** | Partial | `dcms_subscription_locations` exists; no generic location geo on all work events | Ensure all work events carry `serviceLocationId` + geo |
| **GPS Tracking** | Partial | Service Updates is the right home | Add GPS fields to work events later |
| **Auto Assignment** | Partial | Assign Services unified queue planned | Contract type rules per fulfillment mode |
| **Payment Gateway** | Good | Billing separate | Webhook → Payment → Wallet overpay |
| **Coupons** | Gap | No coupon entity | Future `coupons` applied at Book Services Step 6 |
| **Subscription Renewals** | Gap | No renewal workflow | Contract status `expiring` in registry + renewal Book Services flow |
| **Multi-City** | Good | City pricing in Services module | Location carries city/branch |
| **Multi-Branch** | Partial | `branchId` on records | Enforce branch on location + contract create |

### Scalability verdict

Architecture **scales** if Service Contract layer is explicit. Biggest rework risk is **skipping contract abstraction** and bolting renewals/AMC scheduling onto flat bookings later.

---

## 7. Workflow Conflicts Identified

| Conflict | Parties | Resolution |
|----------|---------|------------|
| DCMS Subscriptions page sells contracts outside Book Services | DCMS nav vs Book Services | Retire sell path — Book Services only (SCREEN_MAPPING_V2) |
| Customer wizard creates contracts | Customer 360 vs Book Services | Remove wizard Sprint 5 |
| Entitlements called "wallet credits" in UI | Wallet vs entitlements | Copy audit Sprint 5 + 8 |
| `customer_contracts` bypassed | Registry vs direct queries | Active Services reads registry only |
| Location required but DCMS lacks FK | DATA_RELATIONSHIP vs dcms schema | Add `serviceLocationId` at contract create Sprint 4 |

---

## 8. Ownership Matrix (Final)

| Entity | Authoritative module | Customer 360 | Book Services | Billing |
|--------|---------------------|--------------|---------------|---------|
| Customer profile | Customers | Summary | Step 1 | Filter |
| Service Location | Service Locations | Read-only links | Step 2 | — |
| Asset | Assets | Read-only links | Step 3 | — |
| Catalog Service | Services | — | Step 4 | Line items |
| Service Contract | Book Services → runtime tables | Active Services | Creates | Links invoice |
| Work Event | Book Services / schedulers | — | Creates (one-time) | Per job |
| Assignment | Assign Services | — | Step 9 queue | — |
| Invoice/Payment | Billing & Finance | Billing Summary | Step 7 emit | Full CRUD |
| Wallet ₹ | Billing & Finance | Summary | — | Full CRUD |

---

## 9. Implementation Readiness Checklist

| Item | Ready? |
|------|--------|
| Sprint 1 — Nav restructure | ✅ Yes |
| Sprint 2 — Service Locations + default location | ✅ Yes |
| Sprint 3 — Assets + ownership history | ✅ Yes (with link model) |
| Sprint 4 — Book Services | ⚠️ After SERVICE_CONTRACT_MODEL_V1 sign-off |
| Sprint 5 — Customer 360 | ✅ Yes (depends Sprint 4 progress) |
| Sprint 6 — Assign Services | ✅ Yes |
| Sprint 7 — Service Updates | ✅ Yes |
| Sprint 8 — Billing | ✅ Yes |

---

## 10. Required Document Updates (Post-Validation)

| Document | Action |
|----------|--------|
| `DATA_RELATIONSHIP_V1.md` | Add Service Contract + Work Events (addendum when implementing) |
| `PRODUCTS_SERVICES_ADMIN_RESTRUCTURE_REPORT_V3.md` | Reference SERVICE_CONTRACT_MODEL_V1 (optional addendum) |
| `SCREEN_MAPPING_V2.md` | No structural change; Sprint 4 notes fulfillment branching |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 14 Jun 2026 | Final pre-implementation validation |

---

*Documentation only. No code, migrations, routes, or component changes.*
