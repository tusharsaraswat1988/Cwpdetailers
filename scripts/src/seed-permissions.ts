import { db, permissionsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

type Role = "customer" | "staff" | "admin" | "superadmin" | "franchisee" | "manager";
type Action = "view" | "create" | "edit" | "delete" | "approve";

const RESOURCES = [
  "customers", "leads", "staff", "bookings", "subscriptions", "invoices",
  "complaints", "branches", "services", "analytics", "notifications",
  "franchisees", "churned", "inventory", "billing", "settings", "permissions",
] as const;

const ALL_ACTIONS: Action[] = ["view", "create", "edit", "delete", "approve"];

const MATRIX: Record<Role, Partial<Record<(typeof RESOURCES)[number], Action[]>>> = {
  // super_admin: everything
  admin: Object.fromEntries(RESOURCES.map(r => [r, ALL_ACTIONS])) as Partial<Record<(typeof RESOURCES)[number], Action[]>>,
  superadmin: Object.fromEntries(RESOURCES.map(r => [r, ALL_ACTIONS])) as Partial<Record<(typeof RESOURCES)[number], Action[]>>,

  // manager: ops without destructive financial / settings
  manager: {
    customers: ["view", "create", "edit"],
    leads: ALL_ACTIONS,
    staff: ["view", "edit"],
    bookings: ALL_ACTIONS,
    subscriptions: ["view", "create", "edit"],
    invoices: ["view", "create", "edit"],
    complaints: ALL_ACTIONS,
    branches: ["view"],
    services: ["view"],
    analytics: ["view"],
    notifications: ["view", "create"],
    franchisees: ["view"],
    churned: ["view", "edit"],
    inventory: ["view", "edit"],
    billing: ["view"],
    settings: ["view"],
  },

  // franchise_admin (mapped to franchisee in DB)
  franchisee: {
    customers: ["view", "create", "edit"],
    leads: ALL_ACTIONS,
    staff: ["view", "create", "edit"],
    bookings: ALL_ACTIONS,
    subscriptions: ["view", "create", "edit"],
    invoices: ["view"],
    complaints: ["view", "edit"],
    branches: ["view"],
    services: ["view"],
    analytics: ["view"],
    notifications: ["view"],
    franchisees: ["view"],
    churned: ["view", "edit"],
    inventory: ["view"],
    billing: ["view"],
  },

  staff: {
    customers: ["view"],
    bookings: ["view", "edit"],
    complaints: ["view", "create"],
    notifications: ["view"],
    services: ["view"],
  },

  customer: {
    bookings: ["view", "create"],
    subscriptions: ["view", "create"],
    invoices: ["view"],
    complaints: ["view", "create"],
    notifications: ["view"],
    services: ["view"],
  },
};

async function main() {
  console.log("Seeding permissions…");
  await db.execute(sql`TRUNCATE TABLE permissions RESTART IDENTITY`);

  const rows: { role: Role; resource: string; action: Action }[] = [];
  for (const [role, resMap] of Object.entries(MATRIX) as [Role, Partial<Record<string, Action[]>>][]) {
    for (const [resource, actions] of Object.entries(resMap)) {
      for (const action of actions ?? []) {
        rows.push({ role, resource, action });
      }
    }
  }
  if (rows.length === 0) {
    console.log("No permissions to insert.");
    return;
  }
  await db.insert(permissionsTable).values(rows.map(r => ({ ...r, allow: true })));
  console.log(`Inserted ${rows.length} permission rows.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
