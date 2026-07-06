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

type ContactExcludeInput = ContactExclude | ContactExclude[];

function normalizeExcludes(exclude?: ContactExcludeInput): ContactExclude[] {
  if (!exclude) return [];
  return Array.isArray(exclude) ? exclude : [exclude];
}

const PHONE_MATCH = (tablePhone: SQL | unknown, normalized: string) =>
  sql`RIGHT(REGEXP_REPLACE(${tablePhone}, '[^0-9]', '', 'g'), 10) = ${normalized}`;

const EMAIL_MATCH = (tableEmail: SQL | unknown, normalized: string) =>
  sql`LOWER(TRIM(${tableEmail})) = ${normalized}`;

export { parseContactIdentity, contactConflictMessage };
export type { ContactConflict, ParsedContactIdentity, ContactEntityType };

export async function findContactConflicts(
  identity: ParsedContactIdentity,
  exclude?: ContactExcludeInput,
): Promise<ContactConflict[]> {
  const excludes = normalizeExcludes(exclude);
  const conflicts: ContactConflict[] = [];

  const phoneConflict = await findPhoneConflict(identity.phone, excludes);
  if (phoneConflict) conflicts.push(phoneConflict);

  if (identity.email) {
    const emailConflict = await findEmailConflict(identity.email, excludes);
    if (emailConflict && !conflicts.some(c => c.entity === emailConflict.entity && c.entityId === emailConflict.entityId)) {
      conflicts.push(emailConflict);
    }
  }

  return conflicts;
}

async function findPhoneConflict(
  phone: string,
  excludes: ContactExclude[],
): Promise<ContactConflict | null> {
  const customer = await findEntityByPhone("customer", customersTable, phone, excludes);
  if (customer) return customer;

  const staff = await findEntityByPhone("staff", staffTable, phone, excludes);
  if (staff) return staff;

  const user = await findEntityByPhone("user", usersTable, phone, excludes);
  return user;
}

async function findEmailConflict(
  email: string,
  excludes: ContactExclude[],
): Promise<ContactConflict | null> {
  const customer = await findEntityByEmail("customer", customersTable, email, excludes);
  if (customer) return customer;

  const staff = await findEntityByEmail("staff", staffTable, email, excludes);
  if (staff) return staff;

  const user = await findEntityByEmail("user", usersTable, email, excludes);
  return user;
}

async function findEntityByPhone(
  entity: ContactEntityType,
  table: typeof customersTable | typeof staffTable | typeof usersTable,
  phone: string,
  excludes: ContactExclude[],
): Promise<ContactConflict | null> {
  const conditions = [PHONE_MATCH(table.phone, phone)];
  for (const ex of excludes) {
    if (ex.entity === entity) conditions.push(ne(table.id, ex.id));
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
  excludes: ContactExclude[],
): Promise<ContactConflict | null> {
  const conditions = [
    sql`${table.email} IS NOT NULL`,
    sql`TRIM(${table.email}) <> ''`,
    EMAIL_MATCH(table.email, email),
  ];
  for (const ex of excludes) {
    if (ex.entity === entity) conditions.push(ne(table.id, ex.id));
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
  exclude?: ContactExcludeInput,
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
