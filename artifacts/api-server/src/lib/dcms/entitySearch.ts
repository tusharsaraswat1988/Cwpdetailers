import {
  db, customersTable, vehiclesTable, staffTable, dcmsSubscriptionsTable,
  staffRoleMasterTable, staffRoleAssignmentsTable,
  vehicleModelsTable, vehicleCategoriesTable, seatCategoriesTable,
} from "@workspace/db";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { normalizeRegistration } from "./registration";
import { OPERATIONAL_ROLE_SLUGS } from "../staffEcosystem/operationalRoles";

export async function searchCustomers(query: string, limit = 20) {
  const q = query.trim();
  if (q.length < 3) return [];

  const phoneDigits = q.replace(/\D/g, "");
  const conditions = [
    or(
      ilike(customersTable.name, `%${q}%`),
      ilike(customersTable.phone, `%${q}%`),
      phoneDigits.length >= 3 ? ilike(customersTable.phone, `%${phoneDigits}%`) : undefined,
    ),
  ];

  return db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      city: customersTable.city,
      label: sql<string>`${customersTable.name} || ' · ' || ${customersTable.phone}`,
    })
    .from(customersTable)
    .where(and(...conditions.filter(Boolean)))
    .orderBy(customersTable.name)
    .limit(limit);
}

export async function searchVehicles(params: {
  query?: string;
  customerId?: number;
  registration?: string;
  brand?: string;
  model?: string;
  limit?: number;
}) {
  const limit = params.limit ?? 20;
  const conditions = [];

  if (params.customerId) {
    conditions.push(eq(vehiclesTable.customerId, params.customerId));
  }

  if (params.registration) {
    const norm = normalizeRegistration(params.registration);
    conditions.push(
      or(
        sql`${vehiclesTable.registrationNormalized} = ${norm}`,
        sql`upper(regexp_replace(${vehiclesTable.registrationNumber}, '[^a-zA-Z0-9]', '', 'g')) = ${norm}`,
      ),
    );
  }

  if (params.query) {
    const q = params.query.trim();
    const norm = normalizeRegistration(q);
    conditions.push(
      or(
        ilike(vehiclesTable.registrationNumber, `%${q}%`),
        sql`${vehiclesTable.registrationNormalized} = ${norm}`,
        ilike(vehiclesTable.make, `%${q}%`),
        ilike(vehiclesTable.model, `%${q}%`),
      ),
    );
  }

  if (params.brand) {
    conditions.push(ilike(vehiclesTable.make, `%${params.brand.trim()}%`));
  }

  if (params.model) {
    conditions.push(ilike(vehiclesTable.model, `%${params.model.trim()}%`));
  }

  if (conditions.length === 0) return [];

  return db
    .select({
      id: vehiclesTable.id,
      customerId: vehiclesTable.customerId,
      registrationNumber: vehiclesTable.registrationNumber,
      make: vehiclesTable.make,
      model: vehiclesTable.model,
      vehicleModelId: vehiclesTable.vehicleModelId,
      customerName: customersTable.name,
      vehicleCategoryName: vehicleCategoriesTable.name,
      seatCategoryName: seatCategoriesTable.name,
      seatCount: seatCategoriesTable.seatCount,
      label: sql<string>`${vehiclesTable.registrationNumber} || ' · ' || ${vehiclesTable.make} || ' ' || ${vehiclesTable.model}`,
    })
    .from(vehiclesTable)
    .innerJoin(customersTable, eq(vehiclesTable.customerId, customersTable.id))
    .leftJoin(vehicleModelsTable, eq(vehiclesTable.vehicleModelId, vehicleModelsTable.id))
    .leftJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
    .leftJoin(seatCategoriesTable, eq(vehicleModelsTable.seatCategoryId, seatCategoriesTable.id))
    .where(and(...conditions))
    .orderBy(vehiclesTable.registrationNumber)
    .limit(limit);
}

export async function searchStaff(
  query: string,
  options?: { limit?: number; roleSlug?: string },
) {
  const limit = options?.limit ?? 20;
  const roleSlug = options?.roleSlug ?? OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER;
  const q = query.trim();
  if (q.length < 2) return [];

  const phoneDigits = q.replace(/\D/g, "");

  const textMatch = or(
    ilike(staffTable.name, `%${q}%`),
    ilike(staffTable.phone, `%${q}%`),
    phoneDigits.length >= 4 ? ilike(staffTable.phone, `%${phoneDigits}%`) : undefined,
  );

  return db
    .select({
      id: staffTable.id,
      name: staffTable.name,
      phone: staffTable.phone,
      label: sql<string>`${staffTable.name} || ' · ' || coalesce(${staffTable.phone}, '')`,
    })
    .from(staffTable)
    .innerJoin(staffRoleAssignmentsTable, eq(staffRoleAssignmentsTable.staffId, staffTable.id))
    .innerJoin(staffRoleMasterTable, eq(staffRoleAssignmentsTable.roleId, staffRoleMasterTable.id))
    .where(and(
      eq(staffTable.isActive, true),
      sql`${staffTable.verificationStatus} != 'suspended'`,
      eq(staffRoleMasterTable.slug, roleSlug),
      eq(staffRoleMasterTable.isActive, true),
      textMatch,
    ))
    .orderBy(staffTable.name)
    .limit(limit);
}

export async function searchSubscriptions(query: string, limit = 20) {
  const q = query.trim();
  if (q.length < 2) return [];

  const norm = normalizeRegistration(q);

  return db
    .select({
      id: dcmsSubscriptionsTable.id,
      customerName: customersTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      status: dcmsSubscriptionsTable.status,
      label: sql<string>`${customersTable.name} || ' · ' || ${vehiclesTable.registrationNumber}`,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .where(and(
      or(eq(dcmsSubscriptionsTable.status, "active"), eq(dcmsSubscriptionsTable.status, "paused")),
      or(
        ilike(customersTable.name, `%${q}%`),
        ilike(vehiclesTable.registrationNumber, `%${q}%`),
        sql`${vehiclesTable.registrationNormalized} = ${norm}`,
      ),
    ))
    .orderBy(desc(dcmsSubscriptionsTable.createdAt))
    .limit(limit);
}
