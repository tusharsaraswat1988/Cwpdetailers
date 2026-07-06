import "./load-env.js";
import { db, authPendingGoogleTable, usersTable, customersTable, sessionsTable } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { hashPassword } from "../../artifacts/api-server/src/lib/passwords.ts";
import { assertContactIdentityAvailable } from "../../artifacts/api-server/src/lib/contactIdentity.ts";
import { generateOpaqueToken, hashOpaqueToken } from "../../artifacts/api-server/src/lib/googleAuth.ts";

const phone = "7054007733";
const email = "tabbytechsolutions@gmail.com";
const googleId = "113392830596958739176";

async function main() {
  const linkToken = generateOpaqueToken();
  await db.insert(authPendingGoogleTable).values({
    tokenHash: hashOpaqueToken(linkToken),
    googleId,
    email,
    name: "TS",
    portal: "customer",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  const identityCheck = await assertContactIdentityAvailable(phone, email);
  if (!identityCheck.ok) {
    console.error("identity blocked:", identityCheck.body);
    process.exit(1);
  }

  const pw = await hashPassword(generateOpaqueToken());
  const pending = (await db.select().from(authPendingGoogleTable).where(eq(authPendingGoogleTable.email, email)))[0];

  const linkedUser = await db.transaction(async (tx) => {
    const [user] = await tx.insert(usersTable).values({
      name: pending.name,
      phone,
      email,
      passwordHash: pw,
      role: "customer",
      googleId: pending.googleId,
      authProvider: "google",
      isActive: true,
    }).returning();

    const [customer] = await tx.insert(customersTable).values({
      userId: user!.id,
      name: pending.name,
      phone,
      email,
      city: "Varanasi",
      status: "active",
    }).returning();

    const [updated] = await tx.update(usersTable).set({ customerId: customer!.id }).where(eq(usersTable.id, user!.id)).returning();
    await tx.delete(authPendingGoogleTable).where(eq(authPendingGoogleTable.id, pending.id));
    return updated;
  });

  console.log("SUCCESS user id", linkedUser?.id, "customer_id", linkedUser?.customerId);
  process.exit(0);
}

main().catch(e => { console.error("FAIL", e); process.exit(1); });
