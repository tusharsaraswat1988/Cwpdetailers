import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { citiesTable, statesTable } from "./city-masters";

export const addressTypeEnum = pgEnum("address_type", [
  "HOME",
  "WORK",
  "OTHER",
  "FAMILY",
  "OFFICE",
  "SITE",
  "WAREHOUSE",
  "FACTORY",
]);

export const addressVerificationStatusEnum = pgEnum("address_verification_status", [
  "UNKNOWN",
  "GOOGLE_VERIFIED",
  "GPS_VERIFIED",
  "USER_ENTERED",
  "ADMIN_VERIFIED",
]);

export const addressSourceEnum = pgEnum("address_source", [
  "GOOGLE",
  "GPS",
  "MANUAL",
  "IMPORTED",
  "ADMIN",
  "API",
]);

export const addressIdentityStatusEnum = pgEnum("address_identity_status", [
  "ACTIVE",
  "MERGED",
  "ARCHIVED",
]);

export const addressSnapshotReasonEnum = pgEnum("address_snapshot_reason", [
  "BOOKING",
  "CONTRACT",
  "MANUAL",
  "MIGRATION",
  "API",
]);

/** Stable physical-location identifier — survives nickname/edits. */
export const addressIdentitiesTable = pgTable(
  "address_identities",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id),
    canonicalPlaceId: text("canonical_place_id"),
    canonicalLatitude: doublePrecision("canonical_latitude"),
    canonicalLongitude: doublePrecision("canonical_longitude"),
    fingerprint: text("fingerprint").notNull(),
    status: addressIdentityStatusEnum("status").notNull().default("ACTIVE"),
    mergedIntoIdentityId: integer("merged_into_identity_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  table => [
    index("address_identities_customer_idx").on(table.customerId),
    index("address_identities_fingerprint_idx").on(table.fingerprint),
    index("address_identities_place_id_idx").on(table.canonicalPlaceId),
  ],
);

/** Current editable address record — one active row per identity. */
export const addressesTable = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    identityId: integer("identity_id")
      .notNull()
      .references(() => addressIdentitiesTable.id),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id),
    version: integer("version").notNull().default(1),
    nickname: text("nickname"),
    addressType: addressTypeEnum("address_type").notNull().default("HOME"),
    houseNumber: text("house_number"),
    buildingName: text("building_name"),
    floor: text("floor"),
    apartment: text("apartment"),
    street: text("street"),
    landmark: text("landmark"),
    area: text("area"),
    locality: text("locality"),
    subLocality: text("sub_locality"),
    cityId: integer("city_id").references(() => citiesTable.id),
    district: text("district"),
    stateId: integer("state_id").references(() => statesTable.id),
    country: text("country").notNull().default("India"),
    postalCode: text("postal_code"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    placeId: text("place_id"),
    formattedAddress: text("formatted_address"),
    plusCode: text("plus_code"),
    addressComponents: jsonb("address_components"),
    instructions: text("instructions"),
    normalizedAddress: text("normalized_address"),
    isDefault: boolean("is_default").notNull().default(false),
    verificationStatus: addressVerificationStatusEnum("verification_status")
      .notNull()
      .default("UNKNOWN"),
    source: addressSourceEnum("source").notNull().default("MANUAL"),
    confidenceScore: integer("confidence_score"),
    locationContextSnapshot: jsonb("location_context_snapshot"),
    isCurrent: boolean("is_current").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
    archivedAt: timestamp("archived_at"),
  },
  table => [
    index("addresses_customer_idx").on(table.customerId),
    index("addresses_identity_idx").on(table.identityId),
    index("addresses_postal_code_idx").on(table.postalCode),
    index("addresses_place_id_idx").on(table.placeId),
    index("addresses_city_id_idx").on(table.cityId),
    index("addresses_is_default_idx").on(table.isDefault),
    index("addresses_verification_idx").on(table.verificationStatus),
    index("addresses_normalized_idx").on(table.normalizedAddress),
  ],
);

/** Previous versions — never overwritten. */
export const addressHistoryTable = pgTable(
  "address_history",
  {
    id: serial("id").primaryKey(),
    identityId: integer("identity_id")
      .notNull()
      .references(() => addressIdentitiesTable.id),
    addressId: integer("address_id").notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changeReason: text("change_reason"),
    supersededAt: timestamp("superseded_at").notNull().defaultNow(),
    supersededByAddressId: integer("superseded_by_address_id"),
  },
  table => [
    index("address_history_identity_idx").on(table.identityId),
    index("address_history_customer_idx").on(table.customerId),
    index("address_history_address_idx").on(table.addressId),
  ],
);

/** Immutable snapshots for bookings and contracts. */
export const addressSnapshotsTable = pgTable(
  "address_snapshots",
  {
    id: serial("id").primaryKey(),
    identityId: integer("identity_id")
      .notNull()
      .references(() => addressIdentitiesTable.id),
    addressId: integer("address_id").notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    locationContext: jsonb("location_context"),
    coverageValidationId: text("coverage_validation_id"),
    snapshotReason: addressSnapshotReasonEnum("snapshot_reason").notNull().default("API"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  table => [
    index("address_snapshots_identity_idx").on(table.identityId),
    index("address_snapshots_customer_idx").on(table.customerId),
    index("address_snapshots_address_idx").on(table.addressId),
  ],
);

/** Maps legacy tables to new Address domain. */
export const addressLegacyLinksTable = pgTable(
  "address_legacy_links",
  {
    id: serial("id").primaryKey(),
    addressId: integer("address_id").references(() => addressesTable.id),
    identityId: integer("identity_id").references(() => addressIdentitiesTable.id),
    legacyTable: text("legacy_table").notNull(),
    legacyId: integer("legacy_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  table => [
    uniqueIndex("address_legacy_links_unique").on(table.legacyTable, table.legacyId),
    index("address_legacy_links_address_idx").on(table.addressId),
  ],
);

export const insertAddressIdentitySchema = createInsertSchema(addressIdentitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressSchema = createInsertSchema(addressesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AddressIdentity = typeof addressIdentitiesTable.$inferSelect;
export type Address = typeof addressesTable.$inferSelect;
export type AddressHistory = typeof addressHistoryTable.$inferSelect;
export type AddressSnapshot = typeof addressSnapshotsTable.$inferSelect;
export type AddressLegacyLink = typeof addressLegacyLinksTable.$inferSelect;

export type InsertAddressIdentity = z.infer<typeof insertAddressIdentitySchema>;
export type InsertAddress = z.infer<typeof insertAddressSchema>;

export type AddressType = (typeof addressTypeEnum.enumValues)[number];
export type AddressVerificationStatus = (typeof addressVerificationStatusEnum.enumValues)[number];
export type AddressSource = (typeof addressSourceEnum.enumValues)[number];
