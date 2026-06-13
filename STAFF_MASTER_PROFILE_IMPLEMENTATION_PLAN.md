# Staff Master Profile — Implementation Plan

**Status:** Plan approved (v1.1) — **coding deferred**  
**Prerequisite:** Read `STAFF_MASTER_PROFILE_ENHANCEMENT.md` (v1.1) before starting code.  
**Type:** Enhancement to existing Staff Management — **not** a new module  
**Estimated effort:** 9–13 dev days (1 developer, including migration + QA)  
**Out of scope:** Payroll · Leave · Attendance redesign · Separate HR/Documents module

---

## Schedule & Current Priority

**Do not start Staff Master Profile implementation until pilot validation is complete.**

| Order | Workstream | Doc reference |
|---|---|---|
| **1 (now)** | MVP Smoke Test | `CWP_MVP_IMPLEMENTATION_PLAN.md` — T26 |
| **2** | Pilot Readiness Verification | `CWP_PILOT_READINESS_AUDIT.md` |
| **3** | Pilot Execution | `PILOT_EXECUTION_PLAN.md` |
| **4 (after pilot)** | Staff Master Profile (this plan) | SMP-1 → SMP-17 |

Implementation begins only when stakeholders sign off post-pilot. Until then, this document remains the approved build spec — no schema, API, or UI changes for SMP tasks.

---

## Goal

Deliver a **Staff Detail page** with complete employee master data and in-page document management, backed by schema extensions, document APIs, Cloudinary reuse, inactive-staff assignment rules, and **Profile Completion %** on the staff table and list UI.

---

## Success Definition

1. Admin opens `/admin/staff/:id` and sees all profile sections (photo, personal, status, roles, addresses, banking, vehicle, documents).  
2. Admin uploads profile photo and Aadhaar PDF → views in modal → replaces file → audit shows both events.  
3. Staff list shows completion %; sorting/filtering by incomplete profiles works.  
4. UPI ID, own-vehicle flag, and vehicle registration number persist and appear on detail + list avatar row where relevant.  
5. Driving license, vehicle insurance, and police verification cards show optional expiry dates; expired docs flagged in UI (warning badge, not blocking).  
6. Setting staff to Inactive removes them from booking assignment dropdown; API rejects new assignment.  
7. Past bookings for inactive staff still visible in history.  
8. No new top-level admin nav item for documents or HR.

---

## Phase Overview

| Phase | Focus | Est. |
|---|---|---|
| **P1** | Database schema + migrations + seed roles | 2 d |
| **P2** | API: profile fields, roles, documents, expiry, completion % | 3 d |
| **P3** | Admin Staff Detail page + photo + document viewer UI | 3.5 d |
| **P4** | List enhancements + assignment filters + inactive guards | 1 d |
| **P5** | Migration, OpenAPI regen, QA | 1.5 d |

---

## Task Index

| ID | Task | Phase | Priority |
|---|---|---|---|
| SMP-1 | Extend `staff` table columns | P1 | P0 |
| SMP-2 | `staff_role_master` + junction + seed | P1 | P0 |
| SMP-3 | `staff_documents` + audit table | P1 | P0 |
| SMP-4 | Data migration from legacy fields | P1 | P0 |
| SMP-5 | Staff role master API | P2 | P0 |
| SMP-6 | Extend staff CRUD + completion calculator | P2 | P0 |
| SMP-7 | Staff documents API + audit | P2 | P0 |
| SMP-8 | Inactive staff assignment guards | P2 | P0 |
| SMP-9 | Register Staff Detail route + shell | P3 | P0 |
| SMP-10 | Personal info + status + roles UI | P3 | P0 |
| SMP-11 | Address + banking UI | P3 | P0 |
| SMP-12 | Document cards + viewer modal | P3 | P0 |
| SMP-13 | Other documents dynamic list | P3 | P1 |
| SMP-14 | Staff list: completion % + filters | P4 | P0 |
| SMP-15 | Assignment dropdown `isActive=true` default | P4 | P0 |
| SMP-16 | OpenAPI regen + typecheck fix | P5 | P0 |
| SMP-17 | Manual QA checklist | P5 | P0 |

---

## P1 — Database

### SMP-1 — Extend `staff` table

**File:** `lib/db/src/schema/staff.ts`  
**Migration:** new SQL via Drizzle kit / manual migration in `lib/db/migrations/`

**Add columns:**

```sql
-- Personal
alternate_phone          text
date_of_birth            date
gender                   text  -- or pgEnum
emergency_contact_name   text  -- migrate from guardian_name
emergency_contact_phone  text  -- migrate from guardian_phone

-- Structured addresses (current)
current_address_line1    text
current_address_area     text
current_address_landmark text
current_address_city     text
current_address_state    text
current_address_pincode  text

-- Structured addresses (permanent)
permanent_address_line1    text
permanent_address_area     text
permanent_address_landmark text
permanent_address_city     text
permanent_address_state    text
permanent_address_pincode  text
permanent_same_as_current  boolean DEFAULT false

-- Banking & payments
bank_name                  text
bank_branch                text
upi_id                     text

-- Profile photo (Cloudinary secure URL)
profile_photo_url          text

-- Vehicle (field ops)
owns_vehicle               boolean NOT NULL DEFAULT false
vehicle_registration_number text

-- Profile completion
profile_completion_percent integer NOT NULL DEFAULT 0
```

**Validation notes:**

- `upi_id` — optional; validate UPI format (`name@bank` / phone UPI) on PATCH  
- `owns_vehicle = true` → `vehicle_registration_number` recommended; required for profile completion when flag is true  
- `profile_photo_url` — JPG/PNG/WEBP via Cloudinary; stored on `staff` row (not `staff_documents`)

**Keep (deprecated but not dropped in v1):** `local_address`, `permanent_address`, `guardian_name`, `guardian_phone`, `role` enum, `aadhaar`, `pan`, `bank_passbook_url`, `agreement_url`.

**Acceptance:**

- [ ] Migration runs on empty and populated DB  
- [ ] `insertStaffSchema` / Zod updated  
- [ ] Types export from `@workspace/db`

---

### SMP-2 — Role master + junction

**Files:**

- `lib/db/src/schema/staff-roles.ts` (new)
- Export from `lib/db/src/schema/index.ts`

**Tables:**

```typescript
staffRoleMasterTable = pgTable("staff_role_master", {
  id: serial().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  createdAt, updatedAt,
});

staffRoleAssignmentsTable = pgTable("staff_role_assignments", {
  staffId: integer().references(() => staffTable.id).notNull(),
  roleId: integer().references(() => staffRoleMasterTable.id).notNull(),
}, (t) => [unique().on(t.staffId, t.roleId)]);
```

**Seed script** (`scripts/src/seed.ts` or dedicated `seed-staff-roles.ts`):

| slug | name |
|---|---|
| `car_washer` | Car Washer |
| `daily_car_cleaner` | Daily Car Cleaner |
| `solar_cleaner` | Solar Cleaner |
| `interior_detailer` | Interior Detailer |
| `coating_detailer` | Coating Detailer |

**Acceptance:**

- [ ] Seed idempotent (upsert by slug)  
- [ ] Junction supports multiple roles per staff

---

### SMP-3 — Documents + audit

**File:** `lib/db/src/schema/staff-documents.ts` (new)

**`staff_documents`:**

- `id`, `staff_id`, `document_type` (enum or text)
- `document_number`, `title`, `description` (nullable)
- `expiry_date` (date, nullable) — **optional**; used for `driving_license`, `vehicle_insurance`, `police_verification` only
- `file_url`, `content_type`, `file_size_bytes`
- `uploaded_by_user_id`, `uploaded_at`
- `is_current` (default true)
- `replaced_by_document_id` (nullable self-FK)
- timestamps

**Document type enum values:**

`aadhaar`, `pan`, `driving_license`, `address_proof`, `bank_cancelled_cheque`, `bank_passbook`, `staff_consent_form`, `vehicle_insurance`, `vehicle_registration`, `police_verification`, `medical_certificate`, `other`

**`staff_document_audit`:**

- `id`, `staff_id`, `document_id`, `action` (`uploaded` | `replaced` | `deleted`)
- `previous_document_id` (nullable)
- `actor_user_id`, `metadata` (jsonb optional), `created_at`

**Acceptance:**

- [ ] Unique partial index: one `is_current=true` per (`staff_id`, `document_type`) where type ≠ `other`  
- [ ] Multiple `other` docs allowed

---

### SMP-4 — Legacy data migration

**Script:** `scripts/src/migrate-staff-profile.ts`

| Legacy | Target |
|---|---|
| `guardian_name` | `emergency_contact_name` |
| `guardian_phone` | `emergency_contact_phone` |
| `local_address` | `current_address_line1` |
| `permanent_address` | `permanent_address_line1` |
| `bank_passbook_url` | insert `staff_documents` row type `bank_passbook` if URL present |
| `agreement_url` | insert `staff_documents` row type `staff_consent_form` if URL present |
| `aadhaar` / `pan` text | `document_number` on doc rows when file URL added later |

**Post-migration:** Run completion % backfill (SMP-6).

**Acceptance:**

- [ ] No staff row loses existing URL or text data  
- [ ] Backfill sets `profile_completion_percent` for all rows

---

## P2 — API

### SMP-5 — Staff role master API

**File:** `artifacts/api-server/src/routes/staff-roles.ts` (new)  
**Register in:** `artifacts/api-server/src/routes/index.ts`

| Method | Path | Auth |
|---|---|---|
| GET | `/staff-role-master` | Admin read |
| POST | `/staff-role-master` | Admin create |
| PATCH | `/staff-role-master/:id` | Admin update (name, sort, isActive) |

| Method | Path | Auth |
|---|---|---|
| GET | `/staff/:id/roles` | Admin |
| PUT | `/staff/:id/roles` | Admin — body: `{ roleIds: number[] }` |

**Acceptance:**

- [ ] Tenant scope not required (company-wide master) OR scoped by `company_id` if multi-tenant pattern exists — **match existing staff tenant model**  
- [ ] Returns role IDs + names for Staff Detail checkboxes

---

### SMP-6 — Extend staff CRUD + completion %

**File:** `artifacts/api-server/src/routes/staff.ts`

**Changes:**

1. `GET /staff` — include `profileCompletionPercent`, optional `?minCompletion=`, `?maxCompletion=`, default `isActive` unset on admin list, **`isActive=true` when `?forAssignment=true`**
2. `GET /staff/:id` — full profile + embedded `roles[]`, `documents[]` (current only), completion breakdown object
3. `PATCH /staff/:id` — accept all new personal/address/banking/vehicle fields + `profilePhotoUrl` + `permanentSameAsCurrent`
4. After every PATCH and document mutation → call `recalculateProfileCompletion(staffId)`

**v1.1 fields on PATCH:** `upiId`, `ownsVehicle`, `vehicleRegistrationNumber`, `profilePhotoUrl`

**Completion calculator** — `artifacts/api-server/src/lib/staffProfileCompletion.ts` (new)

```typescript
// Returns { percent: number, breakdown: Record<string, boolean> }
// Weights per STAFF_MASTER_PROFILE_ENHANCEMENT.md
```

**Acceptance:**

- [ ] PATCH validates phone/email via existing `contactFields` helpers  
- [ ] `permanentSameAsCurrent: true` copies current → permanent server-side  
- [ ] List response includes `profileCompletionPercent`

---

### SMP-7 — Staff documents API

**File:** `artifacts/api-server/src/routes/staff-documents.ts` (new, mounted under `/staff/:id/documents`)

| Method | Path | Behaviour |
|---|---|---|
| GET | `/staff/:id/documents` | Current docs; `?includeHistory=true` for audit UI |
| POST | `/staff/:id/documents` | Create — body: type, documentNumber, fileUrl, contentType, size, expiryDate?, title?, description? |
| PATCH | `/staff/:id/documents/:docId` | Update metadata only (`documentNumber`, `expiryDate`) without file replace |
| POST | `/staff/:id/documents/:docId/replace` | Mark old `is_current=false`, insert new, write audit |
| DELETE | `/staff/:id/documents/:docId` | Only `other` type; soft-delete or hard per policy |
| GET | `/staff/:id/documents/:docId/audit` | Audit rows |

**Auth:** Admin/staff-manager roles only; staff self cannot upload compliance docs in v1.

**Storage:** Client uploads to Cloudinary first; API only persists URL + metadata (same as bookings).

**Acceptance:**

- [ ] MIME whitelist: PDF, JPEG, PNG, WEBP  
- [ ] `uploaded_by_user_id` from `req.user.id`  
- [ ] Replace chain linked via `replaced_by_document_id`  
- [ ] `expiryDate` accepted only for `driving_license`, `vehicle_insurance`, `police_verification`; ignored for other types  
- [ ] GET documents returns `isExpired` computed flag when `expiry_date < today` (display only; no API block)

---

### SMP-8 — Inactive staff assignment guards

**Files to touch:**

- `artifacts/api-server/src/routes/bookings.ts` — create + PATCH `staffId`, assign endpoint
- `artifacts/api-server/src/routes/leads.ts` — assign staff
- `artifacts/api-server/src/routes/vehicles.ts` — `assignedStaffId`

**Helper:** `assertStaffAssignable(staffId)` → throws 409 if `!isActive`

**Acceptance:**

- [ ] Inactive staff cannot be newly assigned  
- [ ] Existing assignments unchanged when staff deactivated  
- [ ] Clear error message: `"Staff member is inactive and cannot receive new assignments"`

---

## P3 — Admin UI

### SMP-9 — Staff Detail route + shell

**New file:** `artifacts/cwp-platform/src/features/staff/pages/StaffDetail.tsx`  
**Register in:** `artifacts/cwp-platform/src/App.tsx`

```tsx
<Route path="/admin/staff/:id" component={StaffDetail} />
```

**Layout:** `AdminLayout` + sticky header (profile photo avatar, name, status toggle, completion ring, back link)

**Profile photo:** circular avatar in header; click to upload/replace via Cloudinary; fallback initials from name

**Data:** `useGetStaff` + new hooks after OpenAPI regen, or interim `fetch` + React Query.

**Acceptance:**

- [ ] “View Details →” link from list resolves (currently 404)  
- [ ] 404 state for invalid id

---

### SMP-10 — Personal + status + roles UI

**Sections on StaffDetail:**

1. **Personal Information** — form fields Section 1; save button per section or global save  
2. **Status** — `Switch` bound to `isActive`; confirm dialog on deactivate  
3. **Roles** — checkbox group from `GET /staff-role-master`; save via `PUT /staff/:id/roles`  
4. **Vehicle** — `Own Vehicle` toggle; when on, show `Vehicle Registration Number` text input

**Components (suggested):**

- `features/staff/components/StaffProfilePhoto.tsx`
- `features/staff/components/StaffPersonalForm.tsx`
- `features/staff/components/StaffVehicleForm.tsx`
- `features/staff/components/StaffRolesCheckboxGroup.tsx`
- `features/staff/components/StaffStatusToggle.tsx`

**Acceptance:**

- [ ] Multi-role persists and reloads correctly  
- [ ] Deactivate shows warning about assignment exclusion

---

### SMP-11 — Address + banking UI

**Components:**

- `StaffAddressForm.tsx` — current + permanent + “Same as current” checkbox  
- `StaffBankingForm.tsx` — fields Section 6 + **UPI ID**

**Acceptance:**

- [ ] Checking “same as current” disables permanent fields and mirrors on save  
- [ ] IFSC uppercase validation (optional client hint)  
- [ ] UPI ID optional; basic format validation on blur

---

### SMP-12 — Document cards + viewer

**Reuse:** `uploadFileToCloudinary` from `@/lib/media-url`  
**Presign:** existing `POST /api/storage/uploads/request-url`

**Components:**

- `StaffDocumentGrid.tsx` — fixed-type cards  
- `StaffDocumentCard.tsx` — missing | present | **expired** states  
- `StaffDocumentViewerModal.tsx` — image preview / PDF iframe  
- Actions: View, Download (`<a download>`), Print, Replace (hidden file input)

**Expiry UI (optional field):**

- Date picker on cards for `driving_license`, `vehicle_insurance`, `police_verification`  
- Show “Expires DD MMM YYYY” when set; amber **Expired** badge when past date  
- Expiry editable without re-upload via PATCH document metadata

**Acceptance:**

- [ ] Upload → card updates without full page reload  
- [ ] PDF opens in modal; image zoom-friendly  
- [ ] Print triggers browser print on preview content  
- [ ] Replace shows audit snippet (uploaded by/date)  
- [ ] Expiry date saves independently of file; expired badge visible on list detail document grid

---

### SMP-13 — Other documents dynamic list

**Component:** `StaffOtherDocumentsList.tsx`

- Add row: title, description, file  
- List with View/Download/Replace/Delete  
- Unlimited entries

**Priority:** P1 within phase (can ship after fixed types if timeboxed)

---

## P4 — List & Assignments

### SMP-14 — Staff list enhancements

**File:** `artifacts/cwp-platform/src/features/staff/pages/Staff.tsx`

**Add:**

- Column: Profile Completion % (progress bar)  
- Filter tabs: Active | Inactive | All  
- Badge for inactive rows  
- Optional: “Incomplete (&lt;80%)” filter

**Acceptance:**

- [ ] Sort by completion % (client-side OK for &lt;500 staff)

---

### SMP-15 — Assignment dropdown defaults

**Files (grep `useListStaff` / staff select):**

- `artifacts/cwp-platform/src/features/bookings/pages/Bookings.tsx`
- `artifacts/cwp-platform/src/pages/franchisee/Bookings.tsx`
- Any Daily Ops / vehicle assignment UI

**Change:** Pass `{ isActive: true, forAssignment: true }` or equivalent query param.

**Acceptance:**

- [ ] Inactive staff not shown in assignment pickers  
- [ ] Admin can toggle “Show inactive” in advanced assign dialog (optional P2)

---

## P5 — Integration & QA

### SMP-16 — OpenAPI regen

**Commands (project standard):**

```bash
pnpm run openapi:generate   # or project-specific script
pnpm run typecheck
```

**Packages:** `lib/api-zod`, `lib/api-client-react`

**Acceptance:**

- [ ] Generated hooks for new endpoints  
- [ ] No new typecheck errors in staff feature files

---

### SMP-17 — QA checklist

| # | Test |
|---|---|
| 1 | Create staff with minimal fields → completion % low |
| 2 | Fill personal + upload Aadhaar + PAN → % increases |
| 3 | Assign 2 roles → roles persist |
| 4 | Replace PAN file → audit shows 2 entries |
| 5 | Deactivate staff → absent from booking assign dropdown |
| 6 | Attempt API assign inactive → 409 |
| 7 | Historical booking still shows inactive staff name |
| 8 | “Same as current address” mirrors permanent |
| 9 | Upload PDF + PNG + WEBP → all viewable |
| 10 | Migrate legacy staff with `bank_passbook_url` → doc card populated |
| 11 | Upload profile photo → avatar on header and staff list |
| 12 | Set UPI ID + banking fields → completion % updates |
| 13 | Enable own vehicle + reg number → fields persist; disable hides reg input |
| 14 | Set DL expiry in past → expired badge; future date → no badge |
| 15 | Update insurance expiry without replace → PATCH metadata only |

---

## File Change Summary

| Area | New | Modified |
|---|---|---|
| Schema | `staff-roles.ts`, `staff-documents.ts` | `staff.ts`, `index.ts` |
| Migration | SQL + `migrate-staff-profile.ts` | `seed.ts` |
| API | `staff-roles.ts`, `staff-documents.ts`, `staffProfileCompletion.ts` | `staff.ts`, `bookings.ts`, `leads.ts`, `vehicles.ts`, `routes/index.ts` |
| Frontend | `StaffDetail.tsx`, ~10 components (incl. photo, vehicle) | `Staff.tsx`, `App.tsx` |
| Generated | — | `lib/api-client-react`, `lib/api-zod` |

---

## Profile Completion % — Implementation Detail

**Column:** `staff.profile_completion_percent` (integer 0–100)

**Recalculate triggers:**

- `PATCH /staff/:id`
- Document POST / replace / delete
- `PUT /staff/:id/roles`

**Algorithm (reference weights):**

```
personalScore     = 18 * (filledRequiredPersonal / requiredPersonalCount)
photoScore        = 5 if profile_photo_url set else 0
rolesScore        = 10 if roles.length >= 1 else 0
currentAddrScore  = 10 if city + state + pincode filled else partial
permanentScore    = 5 if permanent complete OR sameAsCurrent else 0
govCoreScore      = 18 * (aadhaarDoc + panDoc + numbers) / requirements
govExtraScore     = 5 if driving_license OR address_proof uploaded else 0
bankingScore      = 17 * (bank fields + bank doc + upi_id) / requirements  // upi counts within banking bucket
vehicleScore      = 2 if !owns_vehicle OR (owns_vehicle AND vehicle_registration_number) else 0
complianceBonus   = min(5, 2.5 * optionalComplianceCount)  // cap at 5; expiry dates do NOT affect %
TOTAL             = min(100, sum)
```

**Note:** Document expiry dates are operational warnings only — they do not reduce profile completion %.

Expose `breakdown` in `GET /staff/:id` for UI checklist tooltip.

**List UI:** `<Progress value={percent} />` + `{percent}%`

---

## Risk & Mitigations

| Risk | Mitigation |
|---|---|
| Legacy `staff.role` enum conflicts with new role master | Keep enum for auth; display operational roles from junction; map `technician` → Car Washer in migration optional |
| Staff Detail route missing today | SMP-9 first UI task — unblocks all sections |
| Large PDF preview in modal | Use iframe; fallback to new tab |
| Cloudinary not configured in env | Surface same error as job photos; block upload with toast |
| PII in logs | Never log document numbers, UPI ID, or account numbers; mask Aadhaar in UI (XXXX-XXXX-1234) |
| Expired compliance docs | UI badge only in v1; no auto-deactivate or assignment block unless added post-pilot |

---

## Deployment Notes (Render)

- No new service — API + DB migration only  
- Run migration before deploy or as release command  
- Cloudinary env vars already required for photos — staff docs reuse same credentials  
- Ephemeral disk: all files in Cloudinary, not local FS  

---

## Definition of Done

- [ ] All SMP tasks P0 complete  
- [ ] QA checklist passed  
- [ ] `STAFF_MASTER_PROFILE_ENHANCEMENT.md` acceptance criteria met  
- [ ] No new admin nav module for HR/Documents  
- [ ] Profile Completion % visible on staff table and detail  

---

## Recommended Implementation Order

```
SMP-1 → SMP-2 → SMP-3 → SMP-4
  → SMP-6 → SMP-7 → SMP-5 → SMP-8
    → SMP-9 → SMP-10 → SMP-11 → SMP-12 → SMP-13
      → SMP-14 → SMP-15 → SMP-16 → SMP-17
```

**Do not start frontend document UI until SMP-7 document API is testable via curl/Postman.**

**Do not start any SMP task until MVP smoke test and pilot execution are validated.**

---

## v1.1 Additions (approved pre-implementation)

| Addition | Storage | UI location |
|---|---|---|
| Staff Profile Photo | `staff.profile_photo_url` | Detail header + list avatar |
| UPI ID | `staff.upi_id` | Banking section |
| Own Vehicle flag | `staff.owns_vehicle` | Vehicle section (Personal area) |
| Vehicle Registration Number | `staff.vehicle_registration_number` | Shown when `owns_vehicle = true` |
| Expiry Date (optional) | `staff_documents.expiry_date` | DL, Vehicle Insurance, Police Verification cards |

---

*Plan version: 1.1 · Approved · Implementation deferred until post-pilot validation.*
