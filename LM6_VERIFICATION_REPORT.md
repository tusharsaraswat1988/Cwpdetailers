# Legacy Migration LM-1–LM-6 Verification Report

**Date:** 2026-06-14  
**Scope:** Schema, package map, import engine (parse/validate/customers), entitlement balance helpers, customer portal photo

---

## Files Changed

| Area | Path |
|------|------|
| **LM-1 Migration SQL** | `lib/db/migrations/009_legacy_migration.sql` |
| **LM-1 Drizzle — audit tables** | `lib/db/src/schema/legacy-migration.ts` |
| **LM-1 Drizzle — customer fields** | `lib/db/src/schema/customers.ts` |
| **LM-1 Schema export** | `lib/db/src/schema/index.ts` |
| **LM-2 Package map** | `artifacts/api-server/src/lib/migration/packageMap.ts` |
| **LM-3/5/6 Import engine** | `artifacts/api-server/src/lib/migration/legacyImportEngine.ts` |
| **LM-3 Types** | `artifacts/api-server/src/lib/migration/types.ts` |
| **LM-5 Validators** | `artifacts/api-server/src/lib/migration/validators.ts` |
| **LM-4 Entitlements** | `artifacts/api-server/src/lib/catalog/entitlementEngine.ts` |
| **Customer API + /me** | `artifacts/api-server/src/routes/customers.ts` |
| **Customer portal photo** | `artifacts/cwp-platform/src/pages/customer/Account.tsx` |
| **Sample workbook generator** | `scripts/src/generate-migration-sample.ts` |
| **Verification script** | `scripts/src/verify-migration-lm6.ts` |
| **Scripts / deps** | `scripts/package.json`, `artifacts/api-server/package.json` |

---

## Database Migration

**File:** `lib/db/migrations/009_legacy_migration.sql`

**Customer columns added:**
- `photo_url` — optional; import or customer portal upload
- `last_payment_date`
- `customer_since`
- `historical_wash_count` — optional
- `historical_solar_visit_count` — optional
- `operational_notes` — contract / operational notes

**Outstanding amount:** maps to existing `total_dues` column (no duplicate column).

**Audit tables:**
- `migration_batches`
- `migration_entity_map`
- `migration_row_log`

**Apply:**
```bash
pnpm --filter @workspace/scripts run migrate:legacy
```

---

## New Customer Fields (Import Template)

| Column | Platform field | Notes |
|--------|----------------|-------|
| `photo_url` | `customers.photo_url` | Optional; customer can update from portal |
| `outstanding_amount` | `customers.total_dues` | Alias `total_dues` also accepted |
| `last_payment_date` | `customers.last_payment_date` | YYYY-MM-DD |
| `customer_since` | `customers.customer_since` | YYYY-MM-DD |
| `historical_wash_count` | `customers.historical_wash_count` | Optional integer |
| `historical_solar_visit_count` | `customers.historical_solar_visit_count` | Optional integer |
| `operational_notes` | `customers.operational_notes` | Alias `contract_notes` |

---

## Sample Import Workbook

**Path:** `fixtures/legacy-migration-sample.xlsx`

**Regenerate:**
```bash
pnpm --filter @workspace/scripts run migration:sample
```

**Sample customers:**
| legacy_customer_id | phone | password | outstanding | customer_since |
|--------------------|-------|----------|-------------|----------------|
| LEG-9001 | 9009009001 | legacy9001 | ₹1200.50 | 2019-03-01 |
| LEG-9002 | 9009009002 | legacy9002 | ₹0 | 2024-06-10 |

---

## Screenshots

| Screenshot | Description |
|------------|-------------|
| `docs/screenshots/legacy-migration-lm6/customer-account-imported.png` | Imported customer logged in — shows customer since, outstanding amount, last payment, photo upload |

---

## Verification Results

**Command:**
```bash
pnpm --filter @workspace/scripts run verify:migration-lm6
```

**Result: 18/18 PASS**

| Check | Status |
|-------|--------|
| LM-1 customer columns (6) | PASS |
| LM-1 audit tables (3) | PASS |
| LM-2 resolvePackageSlug | PASS |
| LM-4 grantEntitlementWithBalance | PASS |
| LM-3 parse workbook | PASS (2 customers) |
| LM-5 validate customers | PASS |
| LM-6 dry-run import | PASS |
| LM-6 commit import | PASS |
| LM-6 imported customer login | PASS |
| LM-6 customer profile fields | PASS (dues=1200.50) |

---

## Next Phase (LM-7+)

- LM-7: Vehicles + solar sites import
- LM-8–LM-10: Packages, solar AMC, daily cleaning
- LM-11–LM-12: Dry-run wrapper polish + row log on commit
- LM-13–LM-16: API routes + admin UI
