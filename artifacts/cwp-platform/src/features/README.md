# Feature-folder architecture

Domain-grouped pages and components live here under `features/<domain>/`.
This folder hosts the canonical convention for new work; existing pages in
`src/pages/admin/...`, `src/pages/customer/...`, etc. are still wired up in
`App.tsx` and should be migrated incrementally.

Each feature folder may export pages, hooks, and components scoped to that
domain. Cross-cutting primitives (DataTable, FilterBar, etc.) belong in
`src/components/shared/`, not here.

Portal design systems (Platform brand + portal density):

| Portal | Folder |
|--------|--------|
| Marketing | `features/landing` |
| Admin | `features/admin-ds` |
| Customer | `features/customer-ds` |
| Staff (field workforce) | `features/staff-ds` |

```
features/
  customers/    # customer CRUD, customer portal, segments
  leads/        # CRM leads pipeline (planned, Task #3)
  bookings/     # booking workflow, staff task board
  subscriptions/
  staff/        # staff portal + admin staff management
  staff-ds/     # Staff Design System (field UX)
  billing/      # invoices, payments, quotations
  complaints/
  franchisees/
  churned/
  analytics/
  auth/         # login, register, password reset
  admin-ds/
  customer-ds/
  landing/
```

## Migration pattern

When moving a page from `pages/<role>/X.tsx` into `features/<domain>/pages/X.tsx`:

1. Copy the file into `features/<domain>/pages/`.
2. Replace the original with a one-line re-export so `App.tsx` keeps working:
   `export { default } from "@/features/<domain>/pages/X";`
3. After every page that references it has been migrated, the shim can be deleted.

Shared layouts (`AdminLayout`, `CustomerLayout`, `StaffLayout`, `FranchiseeLayout`)
stay under `components/layout/` and are re-exported from `components/shared/layouts.ts`.
