# FULL PUBLIC SURFACE SECURITY AUDIT

Date: 2026-06-17 (UTC)
Repository: `/workspace`
Mode: Read-only audit (no application code modifications)

## Scope requested

- `/tournament/:id/register`
- `/tournament/:id/display`
- `/tournament/:id/side-display`
- `/tournament/:id/obs`
- `/live/:id`
- `/owner-app/join`
- `/tournament/:id/auction`

## Scope validation result

The exact tournament/owner/OBS routes requested above are **not implemented as explicit routes** in this repository.

Key observations:

- No `tournament`, `owner-app`, `obs`, or `auction` route declarations were found in frontend route files or backend route modules.
- `/live/:id` and `/owner-app/join` are not explicit routes, but are effectively matched by the generic client route `/:citySlug/:serviceSlug`.
- No organiser/operator role model exists in this codebase; roles are: `customer`, `staff`, `admin`, `superadmin`, `franchisee`, `manager`.

## Route protection (requested routes)

| Route | Exists explicitly | Effective behavior | Auth expectation |
|---|---:|---|---|
| `/tournament/:id/register` | No | NotFound | Public 404 |
| `/tournament/:id/display` | No | NotFound | Public 404 |
| `/tournament/:id/side-display` | No | NotFound | Public 404 |
| `/tournament/:id/obs` | No | NotFound | Public 404 |
| `/tournament/:id/auction` | No | NotFound | Public 404 |
| `/live/:id` | No | Matched by `/:citySlug/:serviceSlug` | Public |
| `/owner-app/join` | No | Matched by `/:citySlug/:serviceSlug` | Public |

## API exposure from effective page path

For `/:citySlug/:serviceSlug` (`CityServicePage`), observed network call:

- `GET /api/catalog/{citySlug}/{serviceSlug}`

Global app load also fetches public branding:

- `GET /api/branding/public`

## IDOR checks and findings

### Requested object tampering (tournament/team/owner/code)

- Not directly testable on requested surfaces because these route families are absent.

### Actual IDOR-like issues found on public APIs

1. **High**: Public self-booking eligibility probe
   - Endpoint: `GET /api/catalog/self-booking/check?customerId=...&serviceId=...`
   - Reachable publicly via catalog allowlist.
   - Can reveal entitlement status and internal `entitlementId` for enumerable customer IDs.

2. **High**: Public contact identity enumeration
   - Endpoint: `GET /api/contact/verify`
   - Unauthenticated.
   - Conflict responses expose entity class + internal entity IDs/names (`existingCustomerId`, `existingStaffId`, `existingUserId` style exposure via response body mapping).

## Owner app security (requested)

- No dedicated `/owner-app/*` module exists.
- `/owner-app/join` is currently just handled as a public city/service slug route, not as owner onboarding/auth.
- URL parameter changes on this path do not grant elevated role access by themselves, but route namespace ambiguity exists.

## OBS security (requested)

- No `/tournament/:id/obs` page or OBS-specific API endpoints found in this repository.
- Therefore, dedicated OBS display-only vs control-plane separation could not be validated on an implemented surface.

## Auction security (requested)

- No `/tournament/:id/auction` route exists in this repository.
- Access to this exact route is effectively unavailable (no matching implementation).

## PUBLIC SAFE ROUTES

- `/tournament/:id/register` (absent; no handler)
- `/tournament/:id/display` (absent; no handler)
- `/tournament/:id/side-display` (absent; no handler)
- `/tournament/:id/obs` (absent; no handler)
- `/tournament/:id/auction` (absent; no handler)

## PROTECTED ROUTES

- None among the requested seven (none implemented as protected explicit routes).

## EXPOSED DATA

1. Contact identity presence + internal IDs/names through `/api/contact/verify`.
2. Entitlement eligibility and internal `entitlementId` through `/api/catalog/self-booking/check`.
3. Public business profile fields through `/api/business-info` (includes owner/support contact fields in schema-backed payload).
4. Public catalog settings through `/api/catalog/settings`.

## CRITICAL RISKS

- No confirmed critical exploit path on the requested tournament/obs/auction routes themselves (they are absent in this repo).

## HIGH RISKS

- Public contact identity enumeration endpoint.
- Public self-booking eligibility endpoint with internal identifier exposure.

## MEDIUM RISKS

- Public `business-info` exposure of owner/support metadata.
- Public `catalog/settings` exposure of operational configuration.
- Cron mutation endpoint auth is conditional on `CRON_SECRET` being set.

## LOW RISKS

- Unauthenticated signed upload URL endpoint (`/api/storage/uploads/request-url`) may enable abuse/resource consumption if unthrottled.
- Route namespace ambiguity from broad `/:citySlug/:serviceSlug` matcher.

## FIX RECOMMENDATIONS

1. Require auth + scope checks for `/api/contact/verify`, or remove entity IDs/names from error payloads.
2. Remove `/catalog/self-booking/check` from anonymous allowlist; enforce authenticated customer-scoped checks.
3. Restrict `/api/catalog/settings` to authorised admin roles only.
4. Require `CRON_SECRET` at service startup; reject boot if missing.
5. Add auth/rate-limits and intent checks to `/api/storage/uploads/request-url`.
6. Reserve `/live/*` and `/owner-app/*` namespaces explicitly to prevent accidental public city/service route handling.
7. If tournament/auction/OBS routes are expected, run this same audit in the actual tournament repository (not present in this checkout).
