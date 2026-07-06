/**
 * Permanently delete ALL customers and related data.
 * Staff, admin, franchisee accounts are NOT removed.
 *
 * Usage:
 *   pnpm exec tsx src/delete-all-customers.ts --dry-run
 *   pnpm exec tsx src/delete-all-customers.ts --confirm
 */
import "./load-env.js";
import { pool } from "@workspace/db";

async function tableExists(table: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
  return Boolean(rows[0]?.reg);
}

async function runOptional(label: string, sql: string): Promise<number> {
  const table = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/i)?.[1];
  if (table && !(await tableExists(table))) {
    console.log(`  skip ${label} (no table ${table})`);
    return 0;
  }
  try {
    const result = await pool.query(sql);
    const count = result.rowCount ?? 0;
    if (count > 0) console.log(`  ✓ ${label}: ${count}`);
    return count;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "42P01" || code === "42703") {
      console.log(`  skip ${label} (${code})`);
      return 0;
    }
    throw err;
  }
}

async function deleteAllCustomers(dryRun: boolean) {
  const { rows: countRows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM customers`);
  const customerCount = Number(countRows[0]?.n ?? 0);
  console.log(`Found ${customerCount} customer(s) to delete.`);

  if (customerCount === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const { rows: sample } = await pool.query<{ id: number; name: string; phone: string; email: string | null }>(
    `SELECT id, name, phone, email FROM customers ORDER BY id LIMIT 10`,
  );
  console.log("Sample customers:", sample);

  if (dryRun) {
    console.log("\nDry run — no changes made. Re-run with --confirm to delete.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Self-reference
    await client.query(`UPDATE customers SET referred_by_customer_id = NULL WHERE referred_by_customer_id IS NOT NULL`);

    const steps: Array<[string, string]> = [
      // DCMS (deepest children first)
      ["dcms activity logs", `DELETE FROM dcms_activity_logs WHERE subscription_id IN (
          SELECT id FROM dcms_subscriptions WHERE customer_id IN (SELECT id FROM customers))`],
      ["dcms missed visit logs", `DELETE FROM dcms_missed_visit_logs WHERE subscription_id IN (
          SELECT id FROM dcms_subscriptions WHERE customer_id IN (SELECT id FROM customers))`],
      ["dcms visit feedback", `DELETE FROM dcms_visit_feedback WHERE customer_id IN (SELECT id FROM customers)`],
      ["dcms visits", `DELETE FROM dcms_visits WHERE subscription_id IN (
          SELECT id FROM dcms_subscriptions WHERE customer_id IN (SELECT id FROM customers))`],
      ["dcms pause history", `DELETE FROM dcms_pause_history WHERE subscription_id IN (
          SELECT id FROM dcms_subscriptions WHERE customer_id IN (SELECT id FROM customers))`],
      ["dcms staff assignments", `DELETE FROM dcms_staff_assignments WHERE subscription_id IN (
          SELECT id FROM dcms_subscriptions WHERE customer_id IN (SELECT id FROM customers))`],
      ["dcms subscription locations", `DELETE FROM dcms_subscription_locations WHERE subscription_id IN (
          SELECT id FROM dcms_subscriptions WHERE customer_id IN (SELECT id FROM customers))`],
      ["dcms subscriptions", `DELETE FROM dcms_subscriptions WHERE customer_id IN (SELECT id FROM customers)`],

      // Service execution children
      ["service execution photos", `DELETE FROM service_execution_photos WHERE execution_id IN (
          SELECT id FROM service_executions WHERE customer_id IN (SELECT id FROM customers))`],
      ["service execution notes", `DELETE FROM service_execution_notes WHERE execution_id IN (
          SELECT id FROM service_executions WHERE customer_id IN (SELECT id FROM customers))`],
      ["service execution checklist", `DELETE FROM service_execution_checklist_items WHERE execution_id IN (
          SELECT id FROM service_executions WHERE customer_id IN (SELECT id FROM customers))`],
      ["service execution location logs", `DELETE FROM service_execution_location_logs WHERE execution_id IN (
          SELECT id FROM service_executions WHERE customer_id IN (SELECT id FROM customers))`],
      ["service executions", `DELETE FROM service_executions WHERE customer_id IN (SELECT id FROM customers)`],

      // Entitlements
      ["entitlement consumption log", `DELETE FROM entitlement_consumption_log WHERE entitlement_id IN (
          SELECT id FROM customer_entitlements WHERE customer_id IN (SELECT id FROM customers))`],
      ["customer entitlements", `DELETE FROM customer_entitlements WHERE customer_id IN (SELECT id FROM customers)`],

      // Assets chain
      ["location asset links", `DELETE FROM location_asset_links WHERE asset_id IN (
          SELECT cal.asset_id FROM customer_asset_links cal WHERE cal.customer_id IN (SELECT id FROM customers))`],
      ["customer asset links", `DELETE FROM customer_asset_links WHERE customer_id IN (SELECT id FROM customers)`],
      ["assets (customer)", `DELETE FROM assets WHERE id IN (
          SELECT a.id FROM assets a
          LEFT JOIN vehicles v ON v.id = a.vehicle_id
          LEFT JOIN solar_sites ss ON ss.id = a.solar_site_id
          WHERE v.customer_id IN (SELECT id FROM customers) OR ss.customer_id IN (SELECT id FROM customers))`],

      // Bookings / subscriptions chain
      ["booking events", `DELETE FROM booking_events WHERE booking_id IN (
          SELECT id FROM bookings WHERE customer_id IN (SELECT id FROM customers))`],
      ["lead activities (customer leads)", `DELETE FROM lead_activities WHERE lead_id IN (
          SELECT id FROM leads WHERE customer_id IN (SELECT id FROM customers))`],

      // Invoices / payments
      ["payments", `DELETE FROM payments WHERE customer_id IN (SELECT id FROM customers)`],
      ["invoices", `DELETE FROM invoices WHERE customer_id IN (SELECT id FROM customers)`],

      // Communications
      ["comm conversation messages", `DELETE FROM comm_conversation_messages WHERE conversation_id IN (
          SELECT id FROM comm_conversations WHERE customer_id IN (SELECT id FROM customers))`],
      ["comm conversation notes", `DELETE FROM comm_conversation_notes WHERE conversation_id IN (
          SELECT id FROM comm_conversations WHERE customer_id IN (SELECT id FROM customers))`],
      ["comm conversations", `DELETE FROM comm_conversations WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm journey events", `DELETE FROM comm_journey_events WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm csat responses", `DELETE FROM comm_csat_responses WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm link tracking", `DELETE FROM comm_link_tracking WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm timeline", `DELETE FROM comm_timeline WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm workflow runs", `DELETE FROM comm_workflow_runs WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm consent history", `DELETE FROM comm_consent_history WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm campaign attribution", `DELETE FROM comm_campaign_attribution WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm events", `DELETE FROM comm_events WHERE customer_id IN (SELECT id FROM customers)`],
      ["comm customer consents", `DELETE FROM comm_customer_consents WHERE customer_id IN (SELECT id FROM customers)`],

      // Notification events
      ["notification event logs", `DELETE FROM notification_event_logs WHERE event_id IN (
          SELECT id FROM notification_events WHERE customer_id IN (SELECT id FROM customers))`],
      ["notification events", `DELETE FROM notification_events WHERE customer_id IN (SELECT id FROM customers)`],

      // Direct customer_id tables
      ["pending service assignments", `DELETE FROM pending_service_assignments WHERE customer_id IN (SELECT id FROM customers)`],
      ["service assignments", `DELETE FROM service_assignments WHERE customer_id IN (SELECT id FROM customers)`],
      ["customer contracts", `DELETE FROM customer_contracts WHERE customer_id IN (SELECT id FROM customers)`],
      ["wallet transactions", `DELETE FROM wallet_transactions WHERE customer_id IN (SELECT id FROM customers)`],
      ["quotations", `DELETE FROM quotations WHERE customer_id IN (SELECT id FROM customers)`],
      ["complaints", `DELETE FROM complaints WHERE customer_id IN (SELECT id FROM customers)`],
      ["bookings", `DELETE FROM bookings WHERE customer_id IN (SELECT id FROM customers)`],
      ["subscriptions", `DELETE FROM subscriptions WHERE customer_id IN (SELECT id FROM customers)`],
      ["vehicles", `DELETE FROM vehicles WHERE customer_id IN (SELECT id FROM customers)`],
      ["solar sites", `DELETE FROM solar_sites WHERE customer_id IN (SELECT id FROM customers)`],
      ["saved locations", `DELETE FROM saved_locations WHERE customer_id IN (SELECT id FROM customers)`],
      ["customer location links", `DELETE FROM customer_location_links WHERE customer_id IN (SELECT id FROM customers)`],

      // Leads — nullify or delete customer link
      ["leads customer link", `UPDATE leads SET customer_id = NULL WHERE customer_id IN (SELECT id FROM customers)`],

      // Legacy migration maps
      ["migration row log (customers)", `DELETE FROM migration_row_log WHERE entity_type = 'customer'`],
      ["migration entity map (customers)", `DELETE FROM migration_entity_map WHERE entity_type = 'customer'`],
    ];

    console.log("\nDeleting related data…");
    for (const [label, sql] of steps) {
      await runOptionalOnClient(client, label, sql);
    }

    // Customer login users
    console.log("\nDeleting customer user accounts…");
    const { rows: userIds } = await client.query<{ id: number }>(`
      SELECT DISTINCT u.id FROM users u
      WHERE u.role = 'customer'
         OR u.customer_id IN (SELECT id FROM customers)
         OR u.id IN (SELECT user_id FROM customers WHERE user_id IS NOT NULL)
    `);
    console.log(`  Found ${userIds.length} customer user(s)`);

    for (const { id: userId } of userIds) {
      const { rows: fn } = await client.query(
        `SELECT to_regprocedure('clear_user_references(integer)') IS NOT NULL AS ok`,
      );
      if (fn[0]?.ok) {
        await client.query(`SELECT clear_user_references($1)`, [userId]);
      } else {
        await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
      }
      await client.query(`DELETE FROM password_reset_codes WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }

    // Orphan customer users (Google sign-up aborted mid-way)
    const orphanUsers = await client.query(`
      SELECT id FROM users WHERE role = 'customer' AND customer_id IS NULL
    `);
    for (const row of orphanUsers.rows as { id: number }[]) {
      await client.query(`DELETE FROM sessions WHERE user_id = $1`, [row.id]);
      await client.query(`DELETE FROM users WHERE id = $1`, [row.id]);
    }
    if (orphanUsers.rowCount) {
      console.log(`  ✓ orphan customer users: ${orphanUsers.rowCount}`);
    }

    await client.query(`UPDATE customers SET user_id = NULL`);
    const delCustomers = await client.query(`DELETE FROM customers`);
    console.log(`  ✓ customers: ${delCustomers.rowCount ?? 0}`);

    await client.query(`DELETE FROM auth_pending_google`);
    console.log(`  ✓ auth_pending_google cleared`);

    await client.query("COMMIT");
    console.log("\nDone — all customers and related data deleted.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function runOptionalOnClient(
  client: Awaited<ReturnType<typeof pool.connect>>,
  label: string,
  sql: string,
) {
  const table = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/i)?.[1];
  if (table) {
    const { rows } = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    if (!rows[0]?.reg) {
      console.log(`  skip ${label} (no table ${table})`);
      return 0;
    }
  }

  const sp = `sp_${label.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}_${Math.random().toString(36).slice(2, 8)}`;
  await client.query(`SAVEPOINT ${sp}`);
  try {
    const result = await client.query(sql);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    const count = result.rowCount ?? 0;
    if (count > 0) console.log(`  ✓ ${label}: ${count}`);
    return count;
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    const code = (err as { code?: string; message?: string }).code;
    if (code === "42P01" || code === "42703") {
      console.log(`  skip ${label} (${code})`);
      return 0;
    }
    throw err;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");

  if (!dryRun && !confirm) {
    console.error("Refusing to run without --dry-run or --confirm");
    console.error("  pnpm exec tsx src/delete-all-customers.ts --dry-run");
    console.error("  pnpm exec tsx src/delete-all-customers.ts --confirm");
    process.exit(1);
  }

  await deleteAllCustomers(dryRun);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
