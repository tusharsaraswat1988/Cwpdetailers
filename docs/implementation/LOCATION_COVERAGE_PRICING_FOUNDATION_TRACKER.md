# CWP Location, Coverage & Pricing Foundation — Implementation Tracker

**Status:** In Progress (audit/design baseline; code implementation not yet verified)
**Branch:** `feat/location-coverage-pricing-foundation`
**Base:** `main`
**Canonical PRD:** `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md`
**Scope:** Extend the existing Location Intelligence Platform; do not create a parallel location stack.

## Repository-grounded baseline

The existing `docs/LOCATION_INTELLIGENCE_PLATFORM.md` declares:
- Location Intelligence V1, CoverageStrategyV1, address parsers, city/PIN repositories, confidence scoring and CoveragePolicy are established.
- `LocationContext` already supports address formatted text, Google Place ID, coordinates, postal code, service area, city, state/country, branch and franchise (branch/franchise currently reserved).
- Structured address persistence and frontend address component storage are listed as Phase 2 remaining work.
- Branch/franchise resolvers, Pricing/ETA/Workforce modules and geographic hierarchy DB model are listed as Phase 3+ remaining work.
- PricingPolicy is currently a stub.

The canonical PRD already includes multi-city configuration, customer-address, service catalog/pricing, staff route, geolocation and admin scope requirements. Existing branch governance and tenant-scope middleware must be reused; do not create duplicate branch access-control systems.

## Workstream / acceptance outline

### LOC-001 — Canonical structured location records (P0, In Progress)
- Persist normalized address components while preserving Google Place ID and lat/lng as optional signals.
- Canonical location identity must not rely on society-name spelling.
- Model society/community and individual property as distinguishable location types.
- Additive, reversible migration; legacy address records remain valid.
- Acceptance: duplicate Place ID/canonical records are prevented where applicable; legacy address flows continue to work.

### LOC-002 — Geographic identity and branch/zone mapping (P0, Planned)
- Represent geographic City/Locality/Sector/Society/Property independently from CWP Branch and Operational Zone.
- A branch can manage multiple zones; a location is linked to operational scope through explicit mapping.
- Reuse current branch and branch-assignment governance.
- Acceptance: moving a zone between branches does not require recreating its geographic locations; backend authorization rejects unauthorized scope.

### LOC-003 — Deterministic location resolution (P0, Planned)
- Resolve customer-submitted Google/GPS evidence to canonical location using Place ID, coordinates/boundary and structured components, with explicit ambiguity outcomes.
- Names and aliases are matching signals, not identifiers.
- Unresolved locations must not be silently assigned to a branch.
- Acceptance: exact, candidate/ambiguous, and unresolved scenarios have automated tests.

### LOC-004 — Explicit service coverage (P0, Planned)
- Configure coverage by branch/zone and supported location target (society/community, individual property, geographic area).
- Keep “location identified” distinct from “serviceable”.
- Coverage checks remain backend authoritative and reuse Location Intelligence V1.
- Acceptance: coverage disabled or missing fails closed; city-disabled services cannot become bookable through fallback.

### PRICE-001 — Configurable density/travel-aware price rules (P0, Planned)
- Pricing dimensions: service, branch, optional zone, location type, plan/package, effective dates, active status; support an optional explicit location override.
- Precedence: explicit location override → zone+location type → branch+location type → configured branch default. No cross-city/branch implicit fallback.
- Store immutable applied price snapshot on booking/subscription; effective price changes must not silently rewrite existing customer contracts.
- Acceptance: missing configuration blocks checkout; precedence and effective-date behavior are tested; decimal-safe monetary arithmetic.

### UX-001 — Customer, staff and admin integration (P1, Planned)
- Customer: location capture/confirmation, address details, serviceability and derived price; internal branch/zone terms remain hidden.
- Staff: jobs use canonical property/location ID; show entry gate/tower/flat/parking details and directions; GPS is evidence/navigation only, not authorization or branch reassignment.
- Admin: clear active branch scope; scope change refreshes all dependent data; manage zones, coverage and pricing with server-side authorization.
- Acceptance: end-to-end Noida and Varanasi scenarios, including cross-branch access rejection.

## Delivery safeguards
- Preserve existing Varanasi workflows and legacy coverage/serviceability APIs.
- Do not run production migrations or destructive backfills without explicit approval and backup/review.
- Requirements stay In Progress/Unverified until repository test and build evidence is available.
- This tracker is not a claim that implementation or verification is complete.

## Next implementation sequence
1. Inspect address, city, society, branch, coverage, pricing schemas and migration conventions.
2. Finalize the additive schema shape against existing tables (avoid duplicate entities).
3. Implement schema + migration + repositories/mappers.
4. Implement resolvers and coverage/pricing policies.
5. Integrate admin/customer/staff UI and tests.
6. Synchronize the canonical PRD with actual implementation and evidence.
