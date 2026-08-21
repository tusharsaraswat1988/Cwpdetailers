/** Ordered SQL files applied by `pnpm migrate:pending` (005+). */
export const PENDING_MIGRATIONS = [
  "005_legal_cms.sql",
  "006_master_data.sql",
  "007_staff_ecosystem.sql",
  "008_service_catalog.sql",
  "009_legacy_migration.sql",
  "010_dcms.sql",
  "011_dcms_enhancements.sql",
  "012_vehicle_reference_photos.sql",
  "013_dcms_production.sql",
  "014_visit_plate_ocr.sql",
  "015_push_notifications.sql",
  "016_push_notification_logs.sql",
  "017_staff_location_logs.sql",
  "018_dcms_plan_vehicle_type.sql",
  "019_customer_tier3.sql",
  "020_dcms_plan_addons.sql",
  "021_staff_category.sql",
  "022_complaints_supervisor.sql",
  "023_customer_reactivation.sql",
  "024_remove_legacy_daily_wash.sql",
  "025_customer_contracts.sql",
  "026_products_homepage.sql",
  "027_contact_identity_unique.sql",
  "028_gst_invoicing.sql",
  "029_service_locations.sql",
  "030_assets.sql",
  "031_service_contracts_sprint4b.sql",
  "032_sprint4c_billing_integration.sql",
  "033_sprint6_service_assignments.sql",
  "034_sprint7_service_executions.sql",
  "035_auth_google_password_reset.sql",
  "036_wallet_transactions.sql",
  "037_vehicles_assigned_staff.sql",
  "038_dcms_plan_seater_only.sql",
  "039_service_assignment_task_types.sql",
  "040_backfill_assignment_tenant.sql",
  "041_execution_photo_geo.sql",
  "042_remove_legacy_daily_booking_data.sql",
  "043_auth_otp_codes.sql",
  "044_branding_settings_bms.sql",
  "045_branding_theme_defaults.sql",
  "046_catalog_package_addons.sql",
  "047_addresses.sql",
  "048_booking_platform.sql",
  "049_booking_engine_phase52.sql",
  "050_booking_time_model_and_type.sql",
  "051_assignment_platform_phase53.sql",
  "052_field_execution_phase54.sql",
  "053_execution_ready_backfill.sql",
  "054_job_orchestration_phase55.sql",
  "055_billing_commercial_closure_phase56.sql",
  "056_solar_rate_card.sql",
  "057_vehicle_seat_override.sql",
  "058_dcms_visit_car_not_available.sql",
  "059_dcms_one_present_cleaning_per_day.sql",
  "060_staff_extra_service_requests.sql",
  "061_attendance_selfie.sql",
  "062_saved_locations_structured.sql",
] as const;

export type Queryable = {
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

async function hasEnumLabel(db: Queryable, typeName: string, label: string): Promise<boolean> {
  const { rows } = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = '${typeName.replace(/'/g, "''")}'
        AND e.enumlabel = '${label.replace(/'/g, "''")}'
    ) AS ok
  `);
  return Boolean(rows[0]?.ok);
}

async function hasType(db: Queryable, typeName: string): Promise<boolean> {
  const { rows } = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = '${typeName.replace(/'/g, "''")}'
    ) AS ok
  `);
  return Boolean(rows[0]?.ok);
}

async function hasTable(db: Queryable, table: string): Promise<boolean> {
  const { rows } = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${table.replace(/'/g, "''")}'
    ) AS ok
  `);
  return Boolean(rows[0]?.ok);
}

async function hasColumn(db: Queryable, table: string, column: string): Promise<boolean> {
  const { rows } = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${table.replace(/'/g, "''")}'
        AND column_name = '${column.replace(/'/g, "''")}'
    ) AS ok
  `);
  return Boolean(rows[0]?.ok);
}

/**
 * Detectors for migrations that are not safe to blindly re-execute.
 * If the effect is already in the database, the runner records the file and skips SQL.
 */
export async function isMigrationAlreadyApplied(db: Queryable, filename: string): Promise<boolean> {
  switch (filename) {
    case "010_dcms.sql":
      return hasTable(db, "dcms_visits");
    case "024_remove_legacy_daily_wash.sql":
      return (await hasTable(db, "subscriptions"))
        && !(await hasEnumLabel(db, "subscription_type", "daily_wash"))
        && !(await hasColumn(db, "subscriptions", "daily_rate"));
    case "049_booking_engine_phase52.sql":
      return hasEnumLabel(db, "booking_status", "waiting_assignment");
    case "054_job_orchestration_phase55.sql":
      return hasType(db, "job_ops_status");
    case "055_billing_commercial_closure_phase56.sql":
      return hasType(db, "invoice_commercial_status");
    case "056_solar_rate_card.sql":
      return hasColumn(db, "solar_pricing_slabs", "term");
    case "057_vehicle_seat_override.sql":
      return hasColumn(db, "vehicles", "seat_category_id");
    case "058_dcms_visit_car_not_available.sql":
      return hasEnumLabel(db, "dcms_visit_status", "car_not_available");
    case "059_dcms_one_present_cleaning_per_day.sql": {
      const { rows } = await db.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'dcms_visits_one_present_cleaning_per_day'
        ) AS ok
      `);
      return Boolean(rows[0]?.ok);
    }
    case "060_staff_extra_service_requests.sql":
      return hasTable(db, "extra_service_requests");
    case "061_attendance_selfie.sql":
      return hasColumn(db, "attendance", "selfie_photo_url");
    default:
      return false;
  }
}

/** When tracking is empty, mark every file up to the latest detected milestone as applied. */
export async function inferBaselineFilename(db: Queryable): Promise<string | null> {
  const milestones = [
    "058_dcms_visit_car_not_available.sql",
    "057_vehicle_seat_override.sql",
    "056_solar_rate_card.sql",
    "055_billing_commercial_closure_phase56.sql",
    "054_job_orchestration_phase55.sql",
    "049_booking_engine_phase52.sql",
    "010_dcms.sql",
  ];
  for (const file of milestones) {
    if (await isMigrationAlreadyApplied(db, file)) return file;
  }
  return null;
}

export function filesThrough(pending: readonly string[], filename: string): string[] {
  const idx = pending.indexOf(filename);
  if (idx < 0) return [];
  return pending.slice(0, idx + 1);
}
