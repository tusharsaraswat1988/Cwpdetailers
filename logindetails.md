# CWP Platform — Hardcoded Login Details

> **Source:** `scripts/src/seed.ts`, `.env.example`, `PHASE1_IMPLEMENTATION_REPORT.md`, `backup.sql`  
> **Last updated:** 13 June 2026

---

## Kaise kaam karta hai (important)

**Role password se decide NAHI hota.**

1. User **phone number** daalta hai → system `users` table mein us phone se account dhundhta hai
2. Us account ka **`role` database mein fixed hai** (customer / staff / admin / …)
3. Password sirf verify karta hai ki sahi user hai ya nahi
4. Login ke baad portal **phone ke linked role** se khulta hai — password se nahi

```
Phone → DB lookup → user.role → correct portal redirect
```

Har phone number **unique** hai (`users.phone` unique constraint). Ek phone = ek account = ek role.

**Seed mein alag phone ranges:**
- Customer phones → `9001xxxxxx`
- Staff phones → `9011xxxxxx`
- Admin phone → `9999999999`

Same phone customer aur staff dono ke liye use nahi ho sakta.

---

## Login URLs

| Portal | URL | Allowed roles (phone ke basis pe) |
|--------|-----|-----------------------------------|
| Customer / Staff | `/login` | customer, staff, franchisee |
| Admin | `/admin/login` | admin, superadmin, manager |
| Register | `/register` | naya customer account (phone + apna password) |

**API:** `POST /api/auth/login` → `{ "phone": "9001001001", "password": "..." }`  
Response mein `user.role` aata hai — ye phone ke account se DB se aata hai.

---

## Saare accounts — phone number primary (pilot seed)

Command: `pnpm --filter @workspace/scripts run seed`  
(ya `npx tsx scripts/src/seed.ts`)

| Phone (Login ID) | Role | Name | Password | Login URL |
|------------------|------|------|----------|-----------|
| **9999999999** | admin | Admin CWP | admin123 | `/admin/login` |
| **9001001001** | customer | Arjun Sharma | customer123 | `/login` |
| **9001001002** | customer | Sunita Patel | customer123 | `/login` |
| **9001001005** | customer | Rohit Agarwal | customer123 | `/login` |
| **9011001001** | staff | Ravi Kumar | staff123 | `/login` |
| **9011001002** | staff | Suresh Yadav | staff123 | `/login` |

**Email (reference only — login phone se hota hai):**

| Phone | Email |
|-------|-------|
| 9999999999 | admin@cwpdetailers.com |
| 9001001001 | arjun@gmail.com |
| 9001001002 | sunita@gmail.com |
| 9001001005 | rohit@gmail.com |
| 9011001001 | ravi@cwp.com |
| 9011001002 | suresh@cwp.com |

---

## Legacy accounts (purani DB — `backup.sql`)

| Phone (Login ID) | Role | Name | Password | Notes |
|------------------|------|------|----------|-------|
| 9999999999 | admin | Admin CWP | admin123 | Legacy SHA-256 hash |
| 9876543210 | staff | Rajesh Kumar | staff123 | Purana seed — staffId linked nahi |
| 9876543211 | staff | Priya Singh | staff123 | Purana seed — Lucknow |
| 7540077333 | customer | Tushar Saraswat | *(register pe set)* | Password codebase mein nahi |
| 9011001001 | staff | Ravi Kumar | staff123 | Admin ne credentials se banaya |
| 9011001002 | staff | Suresh Yadav | staff123 | Admin ne credentials se banaya |

---

## Accounts jinka password hardcoded nahi hai

| Phone kaise milta hai | Role | Password kaise set hota hai |
|-----------------------|------|------------------------------|
| Franchisee record | franchisee | Admin `/admin/franchisees` → Create Account |
| Staff record (verified) | staff | Admin `/admin/credentials` → Create Account |
| `/register` | customer | User khud choose karta hai |

---

## Quick reference (phone → role → password)

```
9999999999  →  admin     →  admin123      →  /admin/login
9001001001  →  customer  →  customer123   →  /login  (Arjun Sharma)
9001001002  →  customer  →  customer123   →  /login  (Sunita Patel)
9001001005  →  customer  →  customer123   →  /login  (Rohit Agarwal)
9011001001  →  staff     →  staff123      →  /login  (Ravi Kumar)
9011001002  →  staff     →  staff123      →  /login  (Suresh Yadav)
```

Legacy (purani DB):
```
9876543210  →  staff  →  staff123  →  /login  (Rajesh Kumar)
9876543211  →  staff  →  staff123  →  /login  (Priya Singh)
7540077333  →  customer  →  (unknown)  →  /login  (Tushar Saraswat)
```

---

## Important notes

1. **Role = phone ke account se** — password change karne se role change nahi hota
2. Seed dobara mat chalao agar production data hai
3. Fresh DB pe seed: `pnpm --filter @workspace/scripts run seed`
4. Ye sirf dev/pilot ke liye — production mein strong unique passwords use karo
