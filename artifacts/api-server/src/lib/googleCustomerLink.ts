import { db, authPendingGoogleTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emailsMatch } from "@workspace/validation";
import { hashPassword } from "./passwords";
import { generateOpaqueToken } from "./googleAuth";
import {
  ensureCustomerLoginUser,
  findCustomerByEmail,
  findCustomerByPhone,
} from "./customerAccount";

export { findCustomerByEmail };

/** Customer whose phone matches and whose email is empty or matches the Google sign-in email. */
export async function findCustomerForGooglePhoneLink(phone: string, googleEmail: string) {
  const customer = await findCustomerByPhone(phone);
  if (!customer) return null;
  if (customer.email?.trim() && !emailsMatch(customer.email, googleEmail)) return null;
  return customer;
}

type LinkGoogleCustomerOptions = {
  chosenPassword?: string | null;
};

export async function linkGoogleAuthToExistingCustomer(
  pending: {
    id: number;
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  },
  customer: Parameters<typeof ensureCustomerLoginUser>[0],
  options: LinkGoogleCustomerOptions = {},
) {
  const passwordHash = options.chosenPassword
    ? await hashPassword(options.chosenPassword)
    : await hashPassword(generateOpaqueToken());
  const authProvider = options.chosenPassword ? "hybrid" : "google";

  const user = await ensureCustomerLoginUser(customer, {
    googleId: pending.googleId,
    email: pending.email,
    avatarUrl: pending.avatarUrl,
    authProvider,
    passwordHash,
  });

  await db
    .delete(authPendingGoogleTable)
    .where(eq(authPendingGoogleTable.id, pending.id));

  return user;
}
