# Staff Master Profile — Future Backlog

**Status:** Backlog only — not in v1.1 scope  
**Approved for implementation:** `STAFF_MASTER_PROFILE_ENHANCEMENT.md` v1.1 · `STAFF_MASTER_PROFILE_IMPLEMENTATION_PLAN.md` v1.1  
**Do not implement backlog items until v1.1 is complete after pilot validation.**

---

## Current Priority (unchanged)

| Order | Workstream |
|---|---|
| 1 | MVP Smoke Test |
| 2 | Pilot Readiness Audit |
| 3 | Pilot Execution |
| 4 | Staff Master Profile v1.1 implementation (post-pilot sign-off) |

This document does **not** modify the v1.1 implementation plan. Items below are recorded for a future release (v1.2+).

---

## BL-1 — Staff Verification Status

**Goal:** Extend staff lifecycle beyond active/inactive with an explicit verification workflow visible on Staff Detail and filterable on the staff list.

### Status values

| Status | Meaning |
|---|---|
| **Pending Verification** | Profile submitted or created; not yet reviewed by admin |
| **Verified** | Admin approved; eligible for assignments (subject to active flag) |
| **Rejected** | Admin rejected; reason recorded; not eligible for new assignments |
| **Suspended** | Temporarily blocked (e.g. compliance lapse); distinct from inactive |

### Future scope (high level)

- Status badge on staff list and Staff Detail header
- Admin actions: Verify · Reject · Suspend · Reinstate
- Optional link to existing Staff Approval flow without duplicating document UI
- Filter tabs on `/admin/staff`: Pending · Verified · Rejected · Suspended
- Assignment rules: only **Verified + Active** staff in default assignment dropdowns

*Backlog only — no schema, API, or UI work until v1.1 ships.*

---

## BL-2 — Staff Notes Timeline

**Goal:** Internal admin notes on a staff member — chronological history on Staff Detail, not customer-facing.

### Fields per note

| Field | Description |
|---|---|
| **Date** | When the note was recorded (timestamp) |
| **Author** | Admin user who wrote the note |
| **Note** | Free-text content |

### Future scope (high level)

- “Notes” section on Staff Detail — reverse-chronological timeline
- Add-note form (author auto-filled from session)
- Optional note category tags (e.g. performance, compliance, general) — TBD at implementation
- Notes are admin-only; not visible on staff field portal (`/staff/profile`)

*Backlog only — no schema, API, or UI work until v1.1 ships.*

---

## BL-3 — Expiring Documents Dashboard Widget

**Goal:** Admin dashboard visibility for staff compliance documents approaching or past expiry (driving license, vehicle insurance, police verification — per v1.1 optional expiry dates).

### Widget behaviour (future)

- Dashboard card: **Expiring Documents**
- Lists staff with documents expiring within configurable window (e.g. 30 days) or already expired
- Columns: Staff name · Document type · Expiry date · Days remaining · link to Staff Detail document card
- Sort: expired first, then soonest expiry
- Optional: count badge on admin nav near Staff

### Data dependency

Requires v1.1 `staff_documents.expiry_date` and document types with expiry support before this widget is meaningful.

*Backlog only — no dashboard or widget work until v1.1 ships.*

---

## Backlog Index

| ID | Item | Target release |
|---|---|---|
| BL-1 | Staff Verification Status | Post v1.1 |
| BL-2 | Staff Notes Timeline | Post v1.1 |
| BL-3 | Expiring Documents Dashboard Widget | Post v1.1 |

---

*Backlog version: 1.0 · Record-only · No implementation · No changes to v1.1 implementation plan.*
