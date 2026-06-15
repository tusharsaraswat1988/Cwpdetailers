/**
 * Send a test job alert push to a staff member (by staff id or phone).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run test:staff-alert -- 1
 *   pnpm --filter @workspace/scripts run test:staff-alert -- 9011001001
 *
 * Requires DATABASE_URL and VAPID_* env vars (same as api-server).
 */
import "./load-env.js";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendStaffJobTestAlert } from "../../artifacts/api-server/src/lib/push/staffJobNotify.js";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: test:staff-alert <staffId | phone>");
    process.exit(1);
  }

  const isPhone = /^\d{10}$/.test(arg);
  const [staff] = await db
    .select({ id: staffTable.id, name: staffTable.name, phone: staffTable.phone })
    .from(staffTable)
    .where(isPhone ? eq(staffTable.phone, arg) : eq(staffTable.id, parseInt(arg, 10)))
    .limit(1);

  if (!staff) {
    console.error(`Staff not found for ${isPhone ? "phone" : "id"}: ${arg}`);
    process.exit(1);
  }

  console.log(`Sending test job alert to ${staff.name} (${staff.phone}, id=${staff.id})…`);
  const result = await sendStaffJobTestAlert(staff.id, staff.name);
  console.log(result.message);
  process.exit(result.ok ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
