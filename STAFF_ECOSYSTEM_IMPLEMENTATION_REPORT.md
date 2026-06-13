# CWP Staff Ecosystem v1.0 — Implementation Report

**Project:** CWP Detailers + Kleansolar  
**Date:** 2026-06-13  
**Scope:** Operational staff backbone — identity, roles/skills, employment, travel, compliance documents, banking, performance, notes, profile completion  
**Out of scope:** Payroll · Leave · Attendance module · Recruitment · Salary processing

---

## Summary

Staff Management is now an **operational master profile system** for field teams — not a generic HRMS. Admins manage complete staff records, compliance documents, capability (roles + skill levels), and performance from a single **Staff Detail** page with six tabs. The system reuses existing Cloudinary uploads, franchisee hierarchy (Partner), and booking data for auto-generated performance metrics.

---

## What Was Built

### Database (`lib/db/migrations/007_staff_ecosystem.sql`)

| Area | Tables / columns |
|---|---|
| **Identity** | Extended `staff`: employee code, photo, DOB, gender, alternate phone, emergency contact, verification incl. `suspended` |
| **Employment** | `employment_type`, rate fields (wash, daily cleaning, solar, AMC), monthly salary |
| **Travel** | `owns_vehicle`, vehicle type/reg, petrol model, rate per KM |
| **Operations** | `city`, `reporting_manager_id`, availability, weekly off, working hours |
| **Address** | Structured current + permanent address (7 fields each), same-as-current flag |
| **Banking** | Bank name, branch, UPI ID |
| **Completion** | `profile_completion_percent`, section flags (identity/documents/bank/address) |
| **Roles** | `staff_role_master` (seeded 5 operational roles) + `staff_role_assignments` with skill level |
| **Documents** | `staff_documents` with expiry, upload metadata, replace chain |
| **Notes** | `staff_notes` admin timeline |

**Apply migration:**

```bash
psql $DATABASE_URL -f lib/db/migrations/007_staff_ecosystem.sql
```

Or: `pnpm --filter @workspace/db run push`

---

### API (`artifacts/api-server/src/routes/`)

| Endpoint | Purpose |
|---|---|
| `GET /api/staff/dashboard-stats` | Admin dashboard: avg completion, incomplete count, pending verification |
| `GET /api/staff-role-master` | Operational role master list |
| `GET /api/staff/:id/ecosystem` | Full profile bundle (roles, docs, notes, performance, completion) |
| `PATCH /api/staff/:id/ecosystem` | Update all profile sections |
| `PUT /api/staff/:id/roles` | Multi-role + skill level assignments |
| `POST /api/staff/:id/verification-status` | Pending / Verified / Rejected / Suspended |
| `GET/POST /api/staff/:id/documents` | Document vault CRUD |
| `POST /api/staff/:id/documents/:docId/replace` | Replace with audit chain |
| `DELETE /api/staff/:id/documents/:docId` | Other docs only |
| `GET/POST /api/staff/:id/notes` | Admin notes timeline |
| `GET /api/staff/:id/performance-profile` | Auto-generated job metrics |
| `GET /api/staff?forAssignment=true` | Active, non-suspended staff for assignment pickers |

**Business rules:**

- Inactive or **Suspended** staff → `409` on booking assign / PATCH staffId
- Employee code auto-generated on create: `CWP-STF-00001`
- Profile completion recalculated on profile PATCH and document changes
- Cloudinary upload unchanged: `POST /api/storage/uploads/request-url`

**Libraries:**

- `artifacts/api-server/src/lib/staffEcosystem/profileCompletion.ts`
- `artifacts/api-server/src/lib/staffEcosystem/recalculate.ts`
- `artifacts/api-server/src/lib/staffEcosystem/performanceProfile.ts`

---

### Admin UI (`artifacts/cwp-platform`)

| Page / file | Change |
|---|---|
| `/admin/staff` | Profile completion bar, photo thumbnail, employee code |
| `/admin/staff/:id` | **New** Staff Detail — 6 tabs (Overview, Roles & Skills, Documents, Banking, Performance, Notes) |
| Admin Dashboard | Staff profile stats widget (avg completion, incomplete, pending verify) |
| `src/lib/staff-ecosystem/api.ts` | Typed API client |
| `src/features/staff/pages/StaffDetail.tsx` | Full detail UI with document viewer modal |

**Staff Detail tabs map to spec:**

1. **Overview** — Identity, status, verification, employment, travel, city/partner/manager, availability, addresses  
2. **Roles & Skills** — Multi-select roles + Trainee/Basic/Intermediate/Expert per role  
3. **Documents** — Mandatory + optional vault; View / Download / Replace / Print  
4. **Banking** — Account fields + UPI; bank proof via Documents tab  
5. **Performance** — Read-only metrics from bookings + complaints  
6. **Notes** — Admin-only timeline (date, author, note)

---

## Seeded Operational Roles

1. Daily Car Cleaner  
2. Car Washer  
3. Solar Cleaner  
4. Interior Detailer  
5. Coating Detailer  

---

## Profile Completion Logic

Four equal sections (25% each):

| Section | Complete when |
|---|---|
| Identity | Name, phone, email, DOB, gender, joining, emergency contact, photo, employee code |
| Documents | Aadhaar, PAN, DL, address proof + bank proof uploaded |
| Bank | Holder, bank name, account, IFSC, branch + bank doc |
| Address | Current + permanent (or same-as-current) with city/state/pincode |

Shown on: Staff list · Staff Detail header · Admin Dashboard stats.

---

## Performance Profile (auto-generated)

Aggregated from `bookings` + `complaints`:

- Total / completed jobs  
- Daily cleaning visits · Car washes · Solar jobs · Solar AMC visits  
- Average rating · Complaints received · Last job date  

---

## Files Changed / Added

### Schema
- `lib/db/src/schema/staff.ts` (extended)
- `lib/db/src/schema/staff-ecosystem.ts` (new)
- `lib/db/src/schema/index.ts`
- `lib/db/migrations/007_staff_ecosystem.sql`

### API
- `artifacts/api-server/src/routes/staff.ts`
- `artifacts/api-server/src/routes/staff-ecosystem.ts` (new)
- `artifacts/api-server/src/routes/bookings.ts` (assign guards)
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/lib/staffEcosystem/*` (new)

### Frontend
- `artifacts/cwp-platform/src/features/staff/pages/StaffDetail.tsx` (new)
- `artifacts/cwp-platform/src/features/staff/pages/Staff.tsx`
- `artifacts/cwp-platform/src/pages/admin/StaffDetail.tsx` (new)
- `artifacts/cwp-platform/src/pages/admin/Dashboard.tsx`
- `artifacts/cwp-platform/src/lib/staff-ecosystem/api.ts` (new)
- `artifacts/cwp-platform/src/App.tsx`

---

## Verification

| Check | Result |
|---|---|
| `@workspace/api-server` TypeScript | **Pass** |
| `@workspace/cwp-platform` TypeScript | Pre-existing `HistoryPanel.tsx` errors only; Staff Ecosystem files clean |
| Migration SQL | Idempotent `IF NOT EXISTS` pattern |
| Route `/admin/staff/:id` | Registered (after `/admin/staff-approval` to avoid param collision) |

**Manual QA recommended:**

1. Apply migration `007_staff_ecosystem.sql`  
2. Open `/admin/staff` → verify completion % on cards  
3. Open staff detail → save identity, assign roles with skill levels  
4. Upload Aadhaar PDF via Documents tab → view in modal  
5. Deactivate or suspend staff → confirm booking assign returns 409  
6. Dashboard → Staff Profiles stat shows avg completion  

---

## Deployment Notes

1. Run migration before deploy.  
2. Cloudinary env vars required for photo/document uploads.  
3. Legacy `bank_passbook_url` / `agreement_url` migrated into `staff_documents` on migration run.  
4. Legacy `staff.role` enum retained for auth compatibility; operational roles live in junction table.

---

## Explicit Non-Goals (unchanged)

- Payroll processing  
- Leave management  
- Attendance redesign (attendance API unchanged; not surfaced on new detail tabs)  
- Recruitment  
- Separate HR or Documents module  

---

*Report generated after Staff Ecosystem v1.0 implementation.*
