# Staff Master Profile Enhancement

**Type:** Enhancement to existing Staff Management — **not** a new module  
**Scope:** Complete employee profile, in-profile document repository, compliance record, profile completion tracking  
**Out of scope:** Separate HR module · Payroll · Leave management · Attendance redesign · Separate document module

**Companion doc:** `STAFF_MASTER_PROFILE_IMPLEMENTATION_PLAN.md` (v1.1 — approved; **implementation deferred until post-pilot**)

**Current priority (before any SMP coding):** MVP Smoke Test → Pilot Readiness Verification → Pilot Execution

---

## Purpose

Every staff member should have a **complete employee master record** with personal details, addresses, banking, government IDs, compliance uploads, and ad-hoc documents — all managed **inside the existing Staff list and Staff Detail pages**.

Admins should never need to open a separate Documents or HR module. Field staff continue using `/staff/profile` for self-service attendance/performance only; this enhancement targets **admin master data**.

---

## Current Baseline (as of this spec)

| Area | Exists today | Gap vs this spec |
|---|---|---|
| **Schema** (`lib/db/src/schema/staff.ts`) | `name`, `phone`, `email`, single `role` enum (`technician`, `supervisor`, `driver`, `solar_technician`), `joiningDate`, flat `localAddress` / `permanentAddress`, `guardianName` / `guardianPhone`, `aadhaar`, `pan`, bank fields, `bankPassbookUrl`, `agreementUrl`, `isActive`, `verificationStatus` | Structured addresses, DOB, gender, alternate mobile, admin-managed multi-roles, document repository table, audit trail, `profileCompletionPercent` |
| **API** (`artifacts/api-server/src/routes/staff.ts`) | List/create/update, `?isActive=` filter, verify, create-account, performance, attendance | Document CRUD, role master API, completion % calculation, inactive-staff assignment guard |
| **Admin UI** (`artifacts/cwp-platform/src/features/staff/pages/Staff.tsx`) | List + minimal create dialog; links to `/admin/staff/:id` | **Staff Detail page route missing**; no profile sections; no document cards/viewer |
| **Storage** | Cloudinary via `POST /api/storage/uploads/request-url` + `uploadFileToCloudinary` | Wire staff documents through same pipeline |
| **Assignments** | Bookings/leads/vehicles assign by `staffId` | Inactive staff not filtered from all assignment dropdowns by default |

---

## Design Principles

1. **Extend, don’t fork** — All UI lives on Staff list + Staff Detail; no new top-level nav item.
2. **Reuse Cloudinary** — Same signed-upload flow as job photos and brand assets.
3. **Store role IDs, not labels** — Operational roles come from an admin-managed master list.
4. **Historical integrity** — Inactive staff keep past bookings, attendance, and documents visible.
5. **Audit every document change** — Who uploaded, when; who replaced, when.
6. **Profile Completion %** — Computed column on `staff` for list sorting and admin visibility.

---

## SECTION 1 — Staff Personal Information

Add or formalize the following fields on the staff master record.

| Field | DB column (proposed) | Notes |
|---|---|---|
| Full Name | `name` (existing) | Required; rename label in UI only |
| Mobile Number | `phone` (existing) | Required; validated 10-digit Indian mobile |
| Alternate Mobile Number | `alternate_phone` | Optional |
| Email | `email` (existing) | Optional; validated |
| Date of Birth | `date_of_birth` | `date` |
| Date of Joining | `joining_date` (existing) | `date` |
| Gender | `gender` | Enum: `male`, `female`, `other`, `prefer_not_to_say` |
| Emergency Contact Name | `emergency_contact_name` | Maps from legacy `guardian_name` with migration |
| Emergency Contact Number | `emergency_contact_phone` | Maps from legacy `guardian_phone` with migration |

**UI:** Single “Personal Information” card on Staff Detail; editable inline or via section save.

---

## SECTION 1A — Profile Photo

| Field | DB column | Notes |
|---|---|---|
| Profile Photo | `profile_photo_url` | Cloudinary secure URL; JPG, PNG, WEBP |

**UI:** Circular avatar in Staff Detail header and staff list row. Click to upload/replace. Fallback: initials from name.

**Storage:** Same Cloudinary signed-upload flow as documents; URL stored on `staff` row (not `staff_documents`).

---

## SECTION 1B — Vehicle Information

| Field | DB column | Notes |
|---|---|---|
| Own Vehicle | `owns_vehicle` | Boolean toggle; default `false` |
| Vehicle Registration Number | `vehicle_registration_number` | Required when `owns_vehicle = true` for profile completion |

**UI:** Toggle + conditional text field in Personal / Vehicle subsection on Staff Detail.

**Note:** This is the staff member’s **personal vehicle** for field ops compliance — not customer vehicle records.

---

## SECTION 2 — Staff Status

| Status | Value | Behaviour |
|---|---|---|
| Active | `is_active = true` (existing) | Eligible for new assignments |
| Inactive | `is_active = false` (existing) | **Cannot receive new assignments**; **hidden from assignment dropdowns by default** |

**Status toggle:** Switch on Staff Detail header and optional quick toggle on list row.

**Inactive staff rules:**

- `POST/PATCH` booking/lead/vehicle assignment APIs reject `staffId` when staff is inactive (409 with clear message).
- List endpoints used for assignment pickers default to `?isActive=true`.
- Admin list page shows filter: Active · Inactive · All (default: Active).
- Historical bookings, attendance, performance, and documents remain visible and read-only where appropriate.

---

## SECTION 3 — Staff Roles

Replace the single hardcoded `staff_role` enum for **operational job roles** with an admin-managed master list.

### Master table: `staff_role_master`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | Stored on staff |
| `name` | text | Display label |
| `slug` | text unique | Stable key |
| `is_active` | boolean | Soft-disable without breaking FK |
| `sort_order` | integer | Admin ordering |
| `created_at` / `updated_at` | timestamp | |

### Junction: `staff_role_assignments`

| Column | Type |
|---|---|
| `staff_id` | FK → staff |
| `role_id` | FK → staff_role_master |
| Unique (`staff_id`, `role_id`) | |

### Seed roles (initial data)

1. Car Washer  
2. Daily Car Cleaner  
3. Solar Cleaner  
4. Interior Detailer  
5. Coating Detailer  

**UI:** Multi-select checkboxes on Staff Detail. One staff member may have multiple roles.

**Legacy note:** Existing `staff.role` enum (`technician`, etc.) may remain temporarily for auth/scope compatibility; new operational roles live in the junction table. Implementation plan defines deprecation path.

---

## SECTION 4 — Address Information

Replace flat text addresses with structured JSON or normalized columns.

### Current Address

| Field | Column suffix |
|---|---|
| House / Flat | `current_address_line1` |
| Area | `current_address_area` |
| Landmark | `current_address_landmark` |
| City | `current_address_city` |
| State | `current_address_state` |
| Pincode | `current_address_pincode` |

### Permanent Address

Same six fields with `permanent_` prefix.

### Same as current address

- Checkbox: `[ ] Same as current address`
- When checked, permanent fields mirror current and are read-only until unchecked.
- On save, copy current → permanent in API if checkbox is true.

**Migration:** Parse or preserve legacy `local_address` / `permanent_address` text into `current_address_line1` / `permanent_address_line1` where possible.

---

## SECTION 5 — Government Documents

Upload support for fixed document types. **Allowed MIME:** PDF, JPG, PNG, WEBP.

| # | Document type key | Document number field |
|---|---|---|
| 1 | `aadhaar` | Aadhaar number (12 digits, masked in UI) |
| 2 | `pan` | PAN (existing `pan` column or per-doc record) |
| 3 | `driving_license` | DL number · **optional expiry date** |
| 4 | `address_proof` | Reference number (optional) |

**Optional expiry date** (on document record, not staff row):

| Document type | Field | Notes |
|---|---|---|
| Driving License | `expiry_date` | Optional; UI shows expired badge when past |
| Vehicle Insurance | `expiry_date` | Optional (Section 7) |
| Police Verification | `expiry_date` | Optional (Section 7) |

Expiry dates do **not** block profile completion % in v1; they are operational warnings only.

**Per document actions:**

- Document Number (text input)
- Upload File
- View (in-page viewer)
- Download
- Replace (creates audit entry; previous version retained in audit/history)

Government doc **files** live in `staff_documents` (Section 10). Numbers may stay on `staff` row for quick search or move entirely to document records — implementation plan standardizes on document table with optional `document_number`.

---

## SECTION 6 — Banking Details

| Field | Column |
|---|---|
| Account Holder Name | `bank_account_name` (existing) |
| Bank Name | `bank_name` (new) |
| Account Number | `bank_account_number` (existing) |
| IFSC Code | `bank_ifsc` (existing) |
| Branch | `bank_branch` (new) |
| UPI ID | `upi_id` (new) | Optional; validated UPI format |

**Document upload (one of):**

- Cancelled Cheque **OR** Bank Passbook  
- Type keys: `bank_cancelled_cheque`, `bank_passbook`  
- Only one required for completion scoring; both allowed if admin uploads both

**Actions:** View · Download · Replace (same as Section 5)

---

## SECTION 7 — Compliance Documents

Optional uploads — not required for “verified” status unless business rules say otherwise later.

| # | Document type key | Required for profile % | Expiry |
|---|---|---|---|
| 1 | `staff_consent_form` | Weighted optional | — |
| 2 | `vehicle_insurance` | Optional | Optional `expiry_date` |
| 3 | `vehicle_registration` | Optional | — |
| 4 | `police_verification` | Optional | Optional `expiry_date` |
| 5 | `medical_certificate` | Optional | — |

---

## SECTION 8 — Other Documents

Dynamic list — unlimited entries.

| Field | Storage |
|---|---|
| Document Title | `title` on `staff_documents` where `document_type = 'other'` |
| Description | `description` |
| Upload File | `file_url` |

**Examples:** Rental Agreement, Experience Certificate, Joining Form.

**UI:** “Add document” row with title, description, file picker; list with View / Download / Replace / Delete.

---

## SECTION 9 — Document Viewer (Staff Detail Page)

On **Staff Detail** (`/admin/staff/:id`), show a **Documents** section with card grid:

```
Documents
  ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Aadhaar    │ │    PAN      │ │ Driving Lic │
└─────────────┘ └─────────────┘ └─────────────┘
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Bank Doc    │ │Consent Form │ │   Other…    │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Card states:**

- **Missing** — dashed border, “Upload” CTA  
- **Present** — thumbnail/icon, doc number snippet, upload date  
- **PDF** — embed or new-tab preview  
- **Image** — inline preview modal  

**Actions (no navigation away):**

| Action | Behaviour |
|---|---|
| View | Modal / drawer with preview |
| Download | Direct `secure_url` download |
| Print | `window.print()` on preview or PDF iframe |
| Replace | Upload new file → audit trail → refresh card |

Do **not** require opening another module or route.

---

## SECTION 10 — Storage

Reuse existing Cloudinary infrastructure.

**Upload flow (unchanged pattern):**

1. Client calls `POST /api/storage/uploads/request-url` with `name`, `size`, `contentType`.
2. Client uploads via `uploadFileToCloudinary`.
3. Client persists metadata via staff document API with returned `secure_url`.

**Table: `staff_documents`**

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `staff_id` | FK | |
| `document_type` | text / enum | e.g. `aadhaar`, `pan`, `other` |
| `document_number` | text nullable | |
| `expiry_date` | date nullable | Optional; DL, vehicle insurance, police verification only |
| `title` | text nullable | Other docs only |
| `description` | text nullable | Other docs only |
| `file_url` | text | Cloudinary secure URL |
| `content_type` | text | MIME |
| `file_size_bytes` | integer nullable | |
| `uploaded_by_user_id` | FK → users | |
| `uploaded_at` | timestamp | |
| `is_current` | boolean | false when replaced |
| `replaced_by_document_id` | FK nullable | Chain to new version |
| `created_at` / `updated_at` | timestamp | |

**Folder convention:** `cwp/staff/{staffId}/{documentType}/` (override via env `CLOUDINARY_FOLDER` prefix).

**Do not** create S3, local disk, or a separate storage service.

---

## SECTION 11 — Audit Trail

**Table: `staff_document_audit`** (or audit columns on replace chain)

| Event | Fields recorded |
|---|---|
| Upload | `staff_id`, `document_id`, `action: uploaded`, `actor_user_id`, `timestamp`, `file_url`, `document_type` |
| Replace | `action: replaced`, `previous_document_id`, `new_document_id`, `actor_user_id`, `timestamp` |
| Delete (other docs only) | `action: deleted`, `actor_user_id`, `timestamp` |

**UI:** Collapsible “Document history” on each card showing uploaded by / date and replaced by / date.

Profile field edits (non-document) may use existing `updated_at` on `staff` row; document audit is mandatory per spec.

---

## Profile Completion %

**Recommendation (approved for this enhancement):** Add `profile_completion_percent` integer (0–100) on `staff` table.

### Calculation (server-side, recalculated on save/upload)

Weighted checklist — example weights (tunable in implementation):

| Category | Weight | Complete when |
|---|---|---|
| Personal info (name, phone, email, DOB, joining, gender, emergency contact) | 18% | All required personal fields filled |
| Profile photo | 5% | `profile_photo_url` uploaded |
| At least one operational role assigned | 10% | Junction has ≥1 active role |
| Current address (city, state, pincode minimum) | 10% | Required address fields filled |
| Permanent address or “same as current” | 5% | Permanent complete or mirrored |
| Government IDs (Aadhaar + PAN files + numbers) | 18% | Both docs uploaded with numbers |
| Driving license OR address proof | 5% | At least one uploaded |
| Banking (holder, bank name, account, IFSC, branch, UPI + bank doc) | 17% | All bank fields + one bank doc |
| Own vehicle (when flagged) | 2% | Reg number filled when `owns_vehicle = true`; auto-complete when flag false |
| Compliance (any 2 of 5) | 5% | Bonus optional section |

Document expiry dates are **not** part of completion scoring in v1.

**UI:**

- Staff list: progress bar or badge column sortable by completion %  
- Staff Detail: header ring/bar “Profile 72% complete” with checklist breakdown tooltip  
- Filter: “Incomplete profiles (&lt; 80%)” for admin cleanup

Recalculate in API after: PATCH staff, POST/PATCH/DELETE document, role assignment change.

---

## API Surface (summary)

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/staff-role-master` | Admin CRUD for role master |
| GET/PUT | `/api/staff/:id/roles` | List/set role IDs for staff |
| GET/POST | `/api/staff/:id/documents` | List/create documents |
| GET/PATCH/DELETE | `/api/staff/:id/documents/:docId` | View metadata, replace, delete other |
| GET | `/api/staff/:id/documents/:docId/audit` | Audit trail |
| PATCH | `/api/staff/:id` | Extended profile fields + `isActive` |
| GET | `/api/staff` | Add `profileCompletionPercent`, default `isActive=true` for assignment queries |

OpenAPI / `@workspace/api-client-react` regeneration required after route changes.

---

## Pages & Navigation

| Page | Route | Changes |
|---|---|---|
| Staff list | `/admin/staff` | Completion %, status filter, inactive badge |
| Staff Detail | `/admin/staff/:id` | **New page** — all sections 1–9 |
| Staff Approval | `/admin/staff-approval` | Link to full profile; no duplicate doc UI |
| Staff field portal | `/staff/profile` | **No change** (self-service only) |

---

## Acceptance Criteria (enhancement complete)

- [ ] Admin can upload profile photo; avatar visible on list and detail  
- [ ] UPI ID, own-vehicle flag, and vehicle registration number editable on Staff Detail  
- [ ] Optional expiry dates on driving license, vehicle insurance, and police verification; expired badge in UI  
- [ ] Admin can create/edit full personal info, addresses, banking on Staff Detail  
- [ ] Admin can assign multiple roles from master list (seed data present)  
- [ ] Admin can upload/view/download/replace all fixed document types + unlimited “other” docs  
- [ ] Document viewer works in-page (view, download, print, replace)  
- [ ] Cloudinary URLs stored with type, upload date, uploaded by  
- [ ] Audit trail visible for upload and replace events  
- [ ] Inactive staff excluded from assignment dropdowns by default; API blocks new assignments  
- [ ] `profile_completion_percent` shown on list and detail; updates on data change  
- [ ] No new HR/payroll/leave modules or separate document module added  
- [ ] Existing staff records migrated without data loss  

---

## Explicit Non-Goals

- Payroll or salary processing (monthly salary field may remain read-only legacy)  
- Leave management  
- Attendance module redesign  
- Staff self-upload of compliance docs (admin-only for v1 unless specified later)  
- Separate “Documents” module in admin nav  

---

*Document version: 1.1 · Approved · Implementation deferred until post-pilot validation · Build plan: `STAFF_MASTER_PROFILE_IMPLEMENTATION_PLAN.md` v1.1*
