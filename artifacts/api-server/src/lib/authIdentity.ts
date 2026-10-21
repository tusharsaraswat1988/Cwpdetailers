import {
  db,
  usersTable,
  customersTable,
  staffTable,
  type User,
  type Customer,
} from "@workspace/db";
import { eq, and, sql, or, isNull } from "drizzle-orm";
import { normalizeIndianMobile, normalizeEmail } from "./contactFields";
import { findUserByPhone } from "./userLookup";
import { findCustomerByPhone, findCustomerByEmail, ensureCustomerLoginUser } from "./customerAccount";
import { isRoleAllowedForPortal, portalMismatchMessage, type AuthPortal } from "./authPortals";

export type StructuredAuthErrorCode =
  | "OTP_PROVIDER_UNAVAILABLE"
  | "OTP_DELIVERY_FAILED"
  | "OTP_RATE_LIMITED"
  | "OTP_INVALID_OR_EXPIRED"
  | "ACCOUNT_NOT_ELIGIBLE"
  | "ACCOUNT_LINK_CONFLICT"
  | "PORTAL_MISMATCH"
  | "AUTH_INTERNAL_ERROR";

export class AuthError extends Error {
  public readonly code: StructuredAuthErrorCode;
  public readonly statusCode: number;
  public readonly publicMessage: string;

  constructor(code: StructuredAuthErrorCode, statusCode: number, publicMessage: string, internalDetails?: string) {
    super(internalDetails ?? publicMessage);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

export { normalizeIndianMobile, normalizeEmail };

export type ResolvedIdentityResult =
  | {
      status: "ELIGIBLE_USER";
      user: User;
      customer?: Customer | null;
    }
  | {
      status: "ELIGIBLE_CUSTOMER_WITHOUT_USER";
      customer: Customer;
    }
  | {
      status: "NOT_FOUND";
    }
  | {
      status: "INELIGIBLE_ROLE";
      user: User;
      reason: string;
    }
  | {
      status: "INELIGIBLE_SUSPENDED";
      user?: User | null;
      customer?: Customer | null;
      reason: string;
    };

/**
 * Shared canonical customer identity resolution across password, OTP, and account linking.
 * Never relies on unconstrained .limit(1) queries.
 */
export async function resolveCustomerIdentityByPhone(
  rawPhone: string,
): Promise<ResolvedIdentityResult> {
  const normalized = normalizeIndianMobile(rawPhone);
  if (!normalized) {
    throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 400, "Please enter a valid 10-digit mobile number.");
  }

  // 1. Check usersTable with canonical 10-digit and legacy variant lookup
  const user = await findUserByPhone(normalized);

  if (user) {
    if (!user.isActive) {
      return {
        status: "INELIGIBLE_SUSPENDED",
        user,
        reason: "Account suspended. Contact support.",
      };
    }
    if (user.role !== "customer") {
      const reason =
        user.role === "staff"
          ? "This phone number belongs to a staff account. Use the Staff portal to sign in."
          : ["admin", "superadmin", "manager"].includes(user.role)
            ? "This phone number belongs to an administrator. Use the Admin portal to sign in."
            : "This phone number is registered to a different account type.";
      return {
        status: "INELIGIBLE_ROLE",
        user,
        reason,
      };
    }

    let customer: Customer | null = null;
    if (user.customerId) {
      const [c] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, user.customerId))
        .limit(1);
      customer = c ?? null;
    } else {
      customer = await findCustomerByPhone(normalized);
      if (customer && !customer.userId) {
        // Safe link repair: same phone
        await db
          .update(customersTable)
          .set({ userId: user.id, updatedAt: new Date() })
          .where(eq(customersTable.id, customer.id));
        await db
          .update(usersTable)
          .set({ customerId: customer.id, updatedAt: new Date() })
          .where(eq(usersTable.id, user.id));
      }
    }

    return {
      status: "ELIGIBLE_USER",
      user,
      customer,
    };
  }

  // 2. No user found; check customersTable
  const customer = await findCustomerByPhone(normalized);
  if (customer) {
    if (customer.status !== "active") {
      return {
        status: "INELIGIBLE_SUSPENDED",
        customer,
        reason: "Account suspended. Contact support.",
      };
    }

    // Check if customer has an existing userId pointing to a valid user
    if (customer.userId) {
      const [linkedUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, customer.userId))
        .limit(1);

      if (linkedUser) {
        const normLinkedPhone = normalizeIndianMobile(linkedUser.phone);
        if (normLinkedPhone && normLinkedPhone !== normalized) {
          // Cross-phone link mismatch: treat as customer record needing safe repair
          return {
            status: "ELIGIBLE_CUSTOMER_WITHOUT_USER",
            customer,
          };
        }
        if (linkedUser.role !== "customer") {
          return {
            status: "INELIGIBLE_ROLE",
            user: linkedUser,
            reason: "This account is linked to an incompatible account type.",
          };
        }
        if (!linkedUser.isActive) {
          return {
            status: "INELIGIBLE_SUSPENDED",
            user: linkedUser,
            customer,
            reason: "Account suspended. Contact support.",
          };
        }
        return {
          status: "ELIGIBLE_USER",
          user: linkedUser,
          customer,
        };
      }
    }

    return {
      status: "ELIGIBLE_CUSTOMER_WITHOUT_USER",
      customer,
    };
  }

  return { status: "NOT_FOUND" };
}

/**
 * Resolve or safely link customer account upon verified OTP proof.
 */
export async function resolveOrRepairVerifiedCustomer(
  normalizedPhone: string,
  options: { authProvider?: string } = {},
): Promise<User> {
  const identity = await resolveCustomerIdentityByPhone(normalizedPhone);

  if (identity.status === "INELIGIBLE_ROLE") {
    throw new AuthError("PORTAL_MISMATCH", 403, identity.reason);
  }
  if (identity.status === "INELIGIBLE_SUSPENDED") {
    throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 401, identity.reason);
  }
  if (identity.status === "NOT_FOUND") {
    throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 401, "Invalid credentials");
  }

  if (identity.status === "ELIGIBLE_USER") {
    return identity.user;
  }

  // ELIGIBLE_CUSTOMER_WITHOUT_USER: verified ownership of phone
  return ensureCustomerLoginUser(identity.customer, {
    authProvider: options.authProvider ?? "otp",
  });
}
