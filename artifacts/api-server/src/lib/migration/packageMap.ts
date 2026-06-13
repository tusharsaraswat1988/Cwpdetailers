/**
 * Maps legacy product / plan names to catalog package slugs.
 * Used during migration when workbook rows omit package_slug.
 */
export const MIGRATION_PACKAGE_MAP: Record<string, string> = {
  // Car wash credit packs
  "4 wash": "4-wash-package",
  "4 wash package": "4-wash-package",
  "4-wash": "4-wash-package",
  "flex 4 wash": "4-wash-package",

  // Daily cleaning combos
  "daily cleaning + 2 washes": "daily-cleaning-2-washes",
  "daily cleaning 2 washes": "daily-cleaning-2-washes",
  "daily + 2 washes": "daily-cleaning-2-washes",
  "daily clean 2 wash": "daily-cleaning-2-washes",

  // Solar AMC
  "12 month solar amc": "12-month-solar-amc-package",
  "12-month solar amc": "12-month-solar-amc-package",
  "12 month amc": "12-month-solar-amc-package",
  "solar amc 12": "12-month-solar-amc-package",
  "6 month solar amc": "6-month-solar-amc-package",
  "6-month solar amc": "6-month-solar-amc-package",
  "6 month amc": "6-month-solar-amc-package",
  "solar amc 6": "6-month-solar-amc-package",

  // Legacy daily exterior plans (service_plans migrated slugs)
  "daily exterior clean": "daily-exterior-clean",
  "daily clean 1 full wash": "daily-clean-1-full-wash",
  "daily clean 2 full wash": "daily-clean-2-full-wash",
  "daily premium clean": "daily-premium-clean",
};

/** Normalize legacy name and resolve to catalog slug, or return input if already a slug. */
export function resolvePackageSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  if (MIGRATION_PACKAGE_MAP[key]) return MIGRATION_PACKAGE_MAP[key];
  // Already a slug-like value
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) return key;
  return null;
}
