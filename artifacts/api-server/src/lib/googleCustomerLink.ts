import { db, authPendingGoogleTable, staffTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { emailsMatch, parseContactIdentity } from "@workspace/validation";
import { hashPassword } from "./passwords";
import { generateOpaqueToken } from "./googleAuth";
import {
  ensureCustomerLoginUser,
  findCustomerByEmail,
  findCustomerByPhone,
} from "./customerAccount";
import { findUserByPhone } from "./userLookup";
import { conflictToHttpBody, findContactConflicts } from "./contactIdentity";

export { findCustomerByEmail };

async function findStaffByEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;
  const [row] = await db
    .select({ id: staffTable.id, name: staffTable.name, phone: staffTable.phone, email: staffTable.email })
    .from(staffTable)
    .where(
      and(
        sql`${staffTable.email} IS NOT NULL`,
        sql`TRIM(${staffTable.email}) <> ''`,
        sql`LOWER(TRIM(${staffTable.email})) = ${normalized}`,
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Reject Google customer signup when this email already belongs to staff. */
export async function assertGoogleEmailOkForCustomerSignup(
  googleEmail: string,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const normalized = googleEmail.toLowerCase().trim();
  if (!normalized) return { ok: true };

  const staff = await findStaffByEmail(normalized);
  if (staff) {
    return {
      ok: false,
      status: 403,
      body: {
        error:
          "This Google account belongs to a staff member. Use the Staff portal with your phone number and password.",
        conflict: {
          field: "email",
          entity: "staff",
          entityId: staff.id,
          entityName: staff.name,
        },
        existingStaffId: staff.id,
        existingStaffName: staff.name,
      },
    };
  }

  const [emailUser] = await db
    .select({ id: usersTable.id, role: usersTable.role, name: usersTable.name })
    .from(usersTable)
    .where(
      and(
        sql`${usersTable.email} IS NOT NULL`,
        sql`TRIM(${usersTable.email}) <> ''`,
        sql`LOWER(TRIM(${usersTable.email})) = ${normalized}`,
      ),
    )
    .limit(1);

  if (emailUser && emailUser.role !== "customer") {
    return {
      ok: false,
      status: 403,
      body: {
        error:
          emailUser.role === "staff"
            ? "This Google account belongs to a staff member. Use the Staff portal with your phone number and password."
            : "This Google account belongs to a different account type. Use the correct portal.",
        conflict: {
          field: "email",
          entity: "user",
          entityId: emailUser.id,
          entityName: emailUser.name,
          role: emailUser.role,
        },
      },
    };
  }

  return { ok: true };
}

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

function staffPortalMessage(role: string): string {
  if (role === "staff") {
    return "This mobile number belongs to a staff account. Use the Staff portal to sign in (phone + password).";
  }
  return "This mobile number is registered to a different account type. Use the correct portal.";
}

/**
 * Block Google customer signup when the phone/email already belongs to staff
 * (or any non-customer login). Must run before linking/creating a customer.
 */
export async function assertGooglePhoneOkForCustomerSignup(
  phone: string,
  googleEmail: string,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const phoneUser = await findUserByPhone(phone);
  if (phoneUser && phoneUser.role !== "customer") {
    return {
      ok: false,
      status: 409,
      body: {
        error: staffPortalMessage(phoneUser.role),
        conflict: { field: "phone", entity: "user", entityId: phoneUser.id, role: phoneUser.role },
      },
    };
  }

  const [staffRow] = await db
    .select({ id: staffTable.id, name: staffTable.name })
    .from(staffTable)
    .where(sql`RIGHT(REGEXP_REPLACE(${staffTable.phone}, '[^0-9]', '', 'g'), 10) = ${phone}`)
    .limit(1);

  if (staffRow) {
    return {
      ok: false,
      status: 409,
      body: {
        error: staffPortalMessage("staff"),
        conflict: {
          field: "phone",
          entity: "staff",
          entityId: staffRow.id,
          entityName: staffRow.name,
        },
        existingStaffId: staffRow.id,
        existingStaffName: staffRow.name,
      },
    };
  }

  const normalizedEmail = googleEmail.toLowerCase().trim();
  if (normalizedEmail) {
    const [emailUser] = await db
      .select({ id: usersTable.id, role: usersTable.role, name: usersTable.name })
      .from(usersTable)
      .where(
        and(
          sql`${usersTable.email} IS NOT NULL`,
          sql`TRIM(${usersTable.email}) <> ''`,
          sql`LOWER(TRIM(${usersTable.email})) = ${normalizedEmail}`,
        ),
      )
      .limit(1);

    if (emailUser && emailUser.role !== "customer") {
      return {
        ok: false,
        status: 409,
        body: {
          error:
            emailUser.role === "staff"
              ? "This Google account is linked to a staff login. Use the Staff portal (phone + password)."
              : "This Google account belongs to a different account type. Use the correct portal.",
          conflict: {
            field: "email",
            entity: "user",
            entityId: emailUser.id,
            entityName: emailUser.name,
            role: emailUser.role,
          },
        },
      };
    }
  }

  const parsed = parseContactIdentity(phone, googleEmail);
  if (!parsed.ok) {
    return { ok: false, status: 400, body: { error: parsed.error } };
  }

  const conflicts = await findContactConflicts(parsed.value);
  const staffConflict = conflicts.find(c => c.entity === "staff");
  if (staffConflict) {
    return { ok: false, status: 409, body: conflictToHttpBody(staffConflict) };
  }

  return { ok: true };
}
