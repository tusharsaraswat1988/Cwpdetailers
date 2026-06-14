import { db, customersTable, staffTable, usersTable } from "@workspace/db";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import {
  type ContactConflict,
  type ContactConflictField,
  type ContactEntityType,
  type ParsedContactIdentity,
  contactConflictMessage,
  parseContactIdentity,
} from "@workspace/validation";

export type ContactExclude = {
  entity: ContactEntityType;
  id: number;
};

const PHONE_MATCH = (tablePhone: SQL | unknown, normalized: string) =>
  sql`RIGHT(REGEXP_REPLACE(${tablePhone}, '[^0-9]', '', 'g'), 10) = ${normalized}`;

const EMAIL_MATCH = (tableEmail: SQL | unknown, normalized: string) =>
  sql`LOWER(TRIM(${tableEmail})) = ${normalized}`;

export { parseContactIdentity, contactConflictMessage };
export type { ContactConflict, ParsedContactIdentity, ContactEntityType };

export async function findContactConflicts(
  identity: ParsedContactIdentity,
  exclude?: ContactExclude,
): Promise<ContactConflict[]> {
  const conflicts: ContactConflict[] = [];

  const phoneConflict = await findPhoneConflict(identity.phone, exclude);
  if (phoneConflict) conflicts.push(phoneConflict);

  if (identity.email) {
    const emailConflict = await findEmailConflict(identity.email, exclude);
    if (emailConflict && !conflicts.some(c => c.entity === emailConflict.entity && c.entityId === emailConflict.entityId)) {
      conflicts.push(emailConflict);
    }
  }

  return conflicts;
}

async function findPhoneConflict(
  phone: string,
  exclude?: ContactExclude,
): Promise<ContactConflict | null> {
  const customer = await findEntityByPhone("customer", customersTable, phone, exclude);
  if (customer) return customer;

  const staff = await findEntityByPhone("staff", staffTable, phone, exclude);
  if (staff) return staff;

  const user = await findEntityByPhone("user", usersTable, phone, exclude);
  return user;
}

async function findEmailConflict(
  email: string,
  exclude?: ContactExclude,
): Promise<ContactConflict | null> {
  const customer = await findEntityByEmail("customer", customersTable, email, exclude);
  if (customer) return customer;

  const staff = await findEntityByEmail("staff", staffTable, email, exclude);
  if (staff) return staff;

  const user = await findEntityByEmail("user", usersTable, email, exclude);
  return user;
}

async function findEntityByPhone(
  entity: ContactEntityType,
  table: typeof customersTable | typeof staffTable | typeof usersTable,
  phone: string,
  exclude?: ContactExclude,
): Promise<ContactConflict | null> {
  const conditions = [PHONE_MATCH(table.phone, phone)];
  if (exclude?.entity === entity) {
    conditions.push(ne(table.id, exclude.id));
  }

  const [row] = await db
    .select({
      id: table.id,
      name: table.name,
      phone: table.phone,
      email: table.email,
    })
    .from(table)
    .where(and(...conditions))
    .limit(1);

  if (!row) return null;

  return {
    field: "phone",
    entity,
    entityId: row.id,
    entityName: row.name,
    phone: row.phone,
    email: row.email ?? null,
  };
}

async function findEntityByEmail(
  entity: ContactEntityType,
  table: typeof customersTable | typeof staffTable | typeof usersTable,
  email: string,
  exclude?: ContactExclude,
): Promise<ContactConflict | null> {
  const conditions = [
    sql`${table.email} IS NOT NULL`,
    sql`TRIM(${table.email}) <> ''`,
    EMAIL_MATCH(table.email, email),
  ];
  if (exclude?.entity === entity) {
    conditions.push(ne(table.id, exclude.id));
  }

  const [row] = await db
    .select({
      id: table.id,
      name: table.name,
      phone: table.phone,
      email: table.email,
    })
    .from(table)
    .where(and(...conditions))
    .limit(1);

  if (!row) return null;

  return {
    field: "email",
    entity,
    entityId: row.id,
    entityName: row.name,
    phone: row.phone,
    email: row.email ?? null,
  };
}

export function conflictToHttpBody(conflict: ContactConflict) {
  const body: Record<string, unknown> = {
    error: contactConflictMessage(conflict),
    conflict: {
      field: conflict.field,
      entity: conflict.entity,
      entityId: conflict.entityId,
      entityName: conflict.entityName,
    },
  };

  if (conflict.entity === "customer") {
    body.existingCustomerId = conflict.entityId;
    body.existingCustomerName = conflict.entityName;
  } else if (conflict.entity === "staff") {
    body.existingStaffId = conflict.entityId;
    body.existingStaffName = conflict.entityName;
  } else {
    body.existingUserId = conflict.entityId;
    body.existingUserName = conflict.entityName;
  }

  return body;
}

export async function assertContactIdentityAvailable(
  phone: unknown,
  email: unknown,
  exclude?: ContactExclude,
): Promise<
  | { ok: true; identity: ParsedContactIdentity }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const parsed = parseContactIdentity(phone, email);
  if (!parsed.ok) {
    return { ok: false, status: 400, body: { error: parsed.error } };
  }

  const conflicts = await findContactConflicts(parsed.value, exclude);
  if (conflicts.length > 0) {
    return { ok: false, status: 409, body: conflictToHttpBody(conflicts[0]) };
  }

  return { ok: true, identity: parsed.value };
}
