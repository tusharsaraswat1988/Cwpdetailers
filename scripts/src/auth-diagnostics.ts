/**
 * CWP Detailers — Read-Only Identity & Authentication Integrity Diagnostics Tool
 *
 * Inspects database records for:
 * - Duplicate normalized phones / emails in users and customers
 * - Orphaned customer and user links
 * - Phone number mismatches across linked customer/user rows
 * - Conflicting Google identities across roles
 * - Stale pending Google link tokens and unconsumed OTP rows
 * - Active sessions on deactivated users
 *
 * STRICT SAFETY CONTRACT:
 * - Read-only execution (sets transaction READ ONLY).
 * - NEVER automatically merges users or modifies production records.
 * - Masks PII in output reports.
 */

import "./load-env.js";
import { pool } from "@workspace/db";

function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

function maskEmail(email?: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  const maskedUser = user.length <= 2 ? user[0] + "*" : `${user.slice(0, 2)}***${user.slice(-1)}`;
  return `${maskedUser}@${domain}`;
}

interface Anomaly {
  category: "DUPLICATE_PHONE" | "DUPLICATE_EMAIL" | "MISMATCHED_LINK" | "ORPHANED_CUSTOMER" | "GOOGLE_CONFLICT" | "STALE_RECORDS" | "DEACTIVATED_SESSION";
  severity: "WARNING" | "CRITICAL" | "INFO";
  description: string;
  details: Record<string, unknown>;
  remediationSuggestion?: string;
}

async function runDiagnostics() {
  console.log("================================================================================");
  console.log("   CWP DETAILERS — AUTHENTICATION & IDENTITY INTEGRITY DIAGNOSTICS (READ-ONLY)  ");
  console.log("================================================================================\n");

  const client = await pool.connect();
  const anomalies: Anomaly[] = [];

  try {
    await client.query("BEGIN TRANSACTION READ ONLY");

    // 1. Overview counts
    const overviewRes = await client.query(`
      SELECT
        (SELECT count(*) FROM users) as total_users,
        (SELECT count(*) FROM customers) as total_customers,
        (SELECT count(*) FROM staff) as total_staff,
        (SELECT count(*) FROM users WHERE role = 'admin' OR role = 'superadmin') as total_admins,
        (SELECT count(*) FROM sessions WHERE expires_at > NOW() AND revoked_at IS NULL) as active_sessions,
        (SELECT count(*) FROM auth_otp_codes WHERE created_at > NOW() - INTERVAL '24 hours') as recent_otps
    `);
    const counts = overviewRes.rows[0];

    console.log("📊 SYSTEM OVERVIEW:");
    console.log(`   • Users:           ${counts.total_users}`);
    console.log(`   • Customers:       ${counts.total_customers}`);
    console.log(`   • Staff:           ${counts.total_staff}`);
    console.log(`   • Admins:          ${counts.total_admins}`);
    console.log(`   • Active Sessions: ${counts.active_sessions}`);
    console.log(`   • 24h OTP Records: ${counts.recent_otps}`);
    console.log("--------------------------------------------------------------------------------\n");

    // 2. Duplicate normalized phones in customers
    const dupCustomerPhones = await client.query(`
      SELECT phone, count(*) as count, array_agg(id) as ids, array_agg(name) as names
      FROM customers
      GROUP BY phone
      HAVING count(*) > 1
    `);
    for (const row of dupCustomerPhones.rows) {
      anomalies.push({
        category: "DUPLICATE_PHONE",
        severity: "WARNING",
        description: `Customer phone ${maskPhone(row.phone)} shared across ${row.count} customer records.`,
        details: { customerIds: row.ids, phone: maskPhone(row.phone) },
        remediationSuggestion: `Review customer IDs [${row.ids.join(", ")}] to confirm if they represent duplicate profiles or different branches.`,
      });
    }

    // 3. Duplicate normalized emails in users (case-insensitive)
    const dupUserEmails = await client.query(`
      SELECT lower(trim(email)) as norm_email, count(*) as count, array_agg(id) as ids, array_agg(role) as roles
      FROM users
      WHERE email IS NOT NULL AND trim(email) <> ''
      GROUP BY lower(trim(email))
      HAVING count(*) > 1
    `);
    for (const row of dupUserEmails.rows) {
      anomalies.push({
        category: "DUPLICATE_EMAIL",
        severity: "CRITICAL",
        description: `User email ${maskEmail(row.norm_email)} is shared across multiple users with roles: ${row.roles.join(", ")}.`,
        details: { userIds: row.ids, roles: row.roles, email: maskEmail(row.norm_email) },
        remediationSuggestion: `Inspect user accounts [${row.ids.join(", ")}] and update conflicting email records manually.`,
      });
    }

    // 4. Mismatched user-customer phone links
    // customers.user_id points to a user whose phone doesn't match customers.phone
    const mismatchedCustomerLinks = await client.query(`
      SELECT c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
             u.id as user_id, u.name as user_name, u.phone as user_phone, u.role
      FROM customers c
      JOIN users u ON c.user_id = u.id
      WHERE c.phone <> u.phone
    `);
    for (const row of mismatchedCustomerLinks.rows) {
      anomalies.push({
        category: "MISMATCHED_LINK",
        severity: "CRITICAL",
        description: `Customer #${row.customer_id} (${maskPhone(row.customer_phone)}) linked to User #${row.user_id} with conflicting phone (${maskPhone(row.user_phone)}).`,
        details: {
          customerId: row.customer_id,
          customerPhone: maskPhone(row.customer_phone),
          userId: row.user_id,
          userPhone: maskPhone(row.user_phone),
        },
        remediationSuggestion: `Verify whether Customer #${row.customer_id} should be unlinked (UPDATE customers SET user_id = NULL WHERE id = ${row.customer_id}) or assigned to a matching user account.`,
      });
    }

    // 5. Mismatched users.customer_id link
    const mismatchedUserCustomerLinks = await client.query(`
      SELECT u.id as user_id, u.phone as user_phone, u.customer_id, c.phone as customer_phone
      FROM users u
      JOIN customers c ON u.customer_id = c.id
      WHERE u.phone <> c.phone
    `);
    for (const row of mismatchedUserCustomerLinks.rows) {
      anomalies.push({
        category: "MISMATCHED_LINK",
        severity: "CRITICAL",
        description: `User #${row.user_id} (${maskPhone(row.user_phone)}) has customer_id #${row.customer_id} with conflicting phone (${maskPhone(row.customer_phone)}).`,
        details: {
          userId: row.user_id,
          userPhone: maskPhone(row.user_phone),
          customerId: row.customer_id,
          customerPhone: maskPhone(row.customer_phone),
        },
        remediationSuggestion: `Audit User #${row.user_id} customer link. Safe query: UPDATE users SET customer_id = NULL WHERE id = ${row.user_id};`,
      });
    }

    // 6. Orphaned customer users: users with role = 'customer' whose customer_id IS NULL or invalid
    const unlinkedCustomerUsers = await client.query(`
      SELECT u.id, u.name, u.phone, u.email, u.auth_provider, u.created_at
      FROM users u
      WHERE u.role = 'customer' AND (u.customer_id IS NULL OR u.customer_id NOT IN (SELECT id FROM customers))
    `);
    for (const row of unlinkedCustomerUsers.rows) {
      anomalies.push({
        category: "ORPHANED_CUSTOMER",
        severity: "INFO",
        description: `Customer User #${row.id} (${maskPhone(row.phone)}) does not have an associated customer profile row.`,
        details: { userId: row.id, phone: maskPhone(row.phone), authProvider: row.auth_provider },
        remediationSuggestion: `System automatically resolves or repairs this upon successful login via resolveOrRepairVerifiedCustomer.`,
      });
    }

    // 7. Conflicting Google identities: Google users whose email matches a staff or admin account
    const googleCollisions = await client.query(`
      SELECT u1.id as google_user_id, u1.google_id, u1.email, u1.role as google_role,
             u2.id as colliding_user_id, u2.role as colliding_role
      FROM users u1
      JOIN users u2 ON lower(trim(u1.email)) = lower(trim(u2.email)) AND u1.id <> u2.id
      WHERE u1.google_id IS NOT NULL
    `);
    for (const row of googleCollisions.rows) {
      anomalies.push({
        category: "GOOGLE_CONFLICT",
        severity: "CRITICAL",
        description: `Google user #${row.google_user_id} (${maskEmail(row.email)}) conflicts with User #${row.colliding_user_id} (role: ${row.colliding_role}).`,
        details: {
          googleUserId: row.google_user_id,
          collidingUserId: row.colliding_user_id,
          collidingRole: row.colliding_role,
          email: maskEmail(row.email),
        },
        remediationSuggestion: `Ensure portal isolation blocks customer login from accessing staff/admin credentials.`,
      });
    }

    // 8. Stale pending Google tokens older than 1 hour
    const staleGoogleTokens = await client.query(`
      SELECT count(*) as stale_count
      FROM auth_pending_google
      WHERE expires_at < NOW() - INTERVAL '1 hour'
    `);
    if (parseInt(staleGoogleTokens.rows[0].stale_count, 10) > 0) {
      anomalies.push({
        category: "STALE_RECORDS",
        severity: "INFO",
        description: `${staleGoogleTokens.rows[0].stale_count} expired pending Google signup tokens can be pruned.`,
        details: { count: staleGoogleTokens.rows[0].stale_count },
        remediationSuggestion: `DELETE FROM auth_pending_google WHERE expires_at < NOW() - INTERVAL '1 day';`,
      });
    }

    // 9. Stale OTP records older than 7 days
    const staleOtps = await client.query(`
      SELECT count(*) as stale_count
      FROM auth_otp_codes
      WHERE created_at < NOW() - INTERVAL '7 days'
    `);
    if (parseInt(staleOtps.rows[0].stale_count, 10) > 0) {
      anomalies.push({
        category: "STALE_RECORDS",
        severity: "INFO",
        description: `${staleOtps.rows[0].stale_count} OTP verification records older than 7 days are candidates for housekeeping.`,
        details: { count: staleOtps.rows[0].stale_count },
        remediationSuggestion: `DELETE FROM auth_otp_codes WHERE created_at < NOW() - INTERVAL '30 days';`,
      });
    }

    // 10. Sessions on deactivated users
    const deactivatedSessions = await client.query(`
      SELECT s.id, s.user_id, u.phone, u.name, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE u.is_active = FALSE AND s.expires_at > NOW() AND s.revoked_at IS NULL
    `);
    for (const row of deactivatedSessions.rows) {
      anomalies.push({
        category: "DEACTIVATED_SESSION",
        severity: "WARNING",
        description: `Active session token exists on deactivated user #${row.user_id} (${maskPhone(row.phone)}).`,
        details: { sessionId: row.id, userId: row.user_id, role: row.role },
        remediationSuggestion: `Revoke session: UPDATE sessions SET revoked_at = NOW() WHERE user_id = ${row.user_id} AND revoked_at IS NULL;`,
      });
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Diagnostics query execution failed:", err);
    throw err;
  } finally {
    client.release();
  }

  // Report anomalies
  const critical = anomalies.filter(a => a.severity === "CRITICAL");
  const warnings = anomalies.filter(a => a.severity === "WARNING");
  const info = anomalies.filter(a => a.severity === "INFO");

  console.log("🔍 DIAGNOSTICS SCAN RESULTS:");
  console.log(`   • Critical Anomalies: ${critical.length === 0 ? "0 (Clean)" : critical.length}`);
  console.log(`   • Warnings:           ${warnings.length === 0 ? "0 (Clean)" : warnings.length}`);
  console.log(`   • Informational:      ${info.length}`);
  console.log("--------------------------------------------------------------------------------\n");

  if (anomalies.length === 0) {
    console.log("✅ All identity and authentication records are 100% healthy and consistent.");
  } else {
    for (const a of anomalies) {
      const badge = a.severity === "CRITICAL" ? "🔴 [CRITICAL]" : a.severity === "WARNING" ? "🟡 [WARNING]" : "🔵 [INFO]";
      console.log(`${badge} ${a.category}: ${a.description}`);
      if (a.remediationSuggestion) {
        console.log(`   Suggested Remediation: ${a.remediationSuggestion}`);
      }
      console.log("");
    }
  }

  console.log("================================================================================");
  console.log("🛡️  READ-ONLY AUDIT COMPLETE — ZERO RECORDS MUTATED.");
  console.log("================================================================================\n");

  return { anomalies, criticalCount: critical.length, warningCount: warnings.length, infoCount: info.length };
}

runDiagnostics()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
