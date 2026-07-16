import { db } from "@workspace/db";
import {
  customersTable,
  savedLocationsTable,
  serviceLocationsTable,
  customerLocationLinksTable,
  vehiclesTable,
  solarSitesTable,
} from "@workspace/db";
import { eq, isNotNull, or } from "drizzle-orm";
import { addressService } from "../AddressService";
import { addressLegacyLinkRepository } from "../repositories/AddressLegacyLinkRepository";

export type LegacyMigrationReport = {
  customers: { migrated: number; skipped: number; errors: number };
  savedLocations: { migrated: number; skipped: number; errors: number };
  serviceLocations: { migrated: number; skipped: number; errors: number };
  vehicles: { migrated: number; skipped: number; errors: number };
  solarSites: { migrated: number; skipped: number; errors: number };
};

function bump(report: LegacyMigrationReport, table: keyof LegacyMigrationReport, field: "migrated" | "skipped" | "errors") {
  report[table][field] += 1;
}

export class LegacyAddressMigrator {
  async migrateAll(): Promise<LegacyMigrationReport> {
    const report: LegacyMigrationReport = {
      customers: { migrated: 0, skipped: 0, errors: 0 },
      savedLocations: { migrated: 0, skipped: 0, errors: 0 },
      serviceLocations: { migrated: 0, skipped: 0, errors: 0 },
      vehicles: { migrated: 0, skipped: 0, errors: 0 },
      solarSites: { migrated: 0, skipped: 0, errors: 0 },
    };

    await this.migrateCustomers(report);
    await this.migrateSavedLocations(report);
    await this.migrateServiceLocations(report);
    await this.migrateVehicles(report);
    await this.migrateSolarSites(report);

    return report;
  }

  private async migrateCustomers(report: LegacyMigrationReport) {
    const rows = await db
      .select()
      .from(customersTable)
      .where(or(isNotNull(customersTable.address), isNotNull(customersTable.city)));

    for (const row of rows) {
      try {
        const existing = await addressLegacyLinkRepository.findByLegacy("customers", row.id);
        if (existing) {
          bump(report, "customers", "skipped");
          continue;
        }
        if (!row.address?.trim()) {
          bump(report, "customers", "skipped");
          continue;
        }

        const entity = await addressService.create({
          customerId: row.id,
          nickname: "Primary",
          addressType: "HOME",
          formattedAddress: row.address,
          locality: row.city ?? undefined,
          source: "IMPORTED",
          isDefault: true,
          allowDuplicate: true,
          validateCoverage: false,
        }, { isLegacyMigrated: true });

        await addressLegacyLinkRepository.upsert({
          addressId: entity.address.id,
          identityId: entity.identity.id,
          legacyTable: "customers",
          legacyId: row.id,
        });
        bump(report, "customers", "migrated");
      } catch {
        bump(report, "customers", "errors");
      }
    }
  }

  private async migrateSavedLocations(report: LegacyMigrationReport) {
    const rows = await db.select().from(savedLocationsTable);

    for (const row of rows) {
      try {
        const existing = await addressLegacyLinkRepository.findByLegacy("saved_locations", row.id);
        if (existing) {
          bump(report, "savedLocations", "skipped");
          continue;
        }

        const entity = await addressService.create({
          customerId: row.customerId,
          nickname: row.label,
          addressType: "OTHER",
          formattedAddress: row.address,
          latitude: row.latitude,
          longitude: row.longitude,
          placeId: row.placeId,
          source: "IMPORTED",
          isDefault: row.isDefault,
          allowDuplicate: true,
          validateCoverage: false,
        }, { isLegacyMigrated: true });

        await addressLegacyLinkRepository.upsert({
          addressId: entity.address.id,
          identityId: entity.identity.id,
          legacyTable: "saved_locations",
          legacyId: row.id,
        });
        bump(report, "savedLocations", "migrated");
      } catch {
        bump(report, "savedLocations", "errors");
      }
    }
  }

  private async migrateServiceLocations(report: LegacyMigrationReport) {
    const rows = await db.select().from(serviceLocationsTable);

    for (const row of rows) {
      try {
        const existing = await addressLegacyLinkRepository.findByLegacy("service_locations", row.id);
        if (existing) {
          bump(report, "serviceLocations", "skipped");
          continue;
        }

        const [link] = await db
          .select({ customerId: customerLocationLinksTable.customerId })
          .from(customerLocationLinksTable)
          .where(eq(customerLocationLinksTable.serviceLocationId, row.id))
          .limit(1);

        const customerId = link?.customerId;
        if (!customerId) {
          bump(report, "serviceLocations", "skipped");
          continue;
        }

        const entity = await addressService.create({
          customerId,
          nickname: row.label,
          addressType: row.locationType === "factory" ? "FACTORY" : row.locationType === "office" ? "OFFICE" : "SITE",
          formattedAddress: row.address ?? row.label,
          locality: row.city ?? undefined,
          latitude: row.latitude,
          longitude: row.longitude,
          placeId: row.placeId,
          source: "IMPORTED",
          allowDuplicate: true,
          validateCoverage: false,
        }, { isLegacyMigrated: true });

        await addressLegacyLinkRepository.upsert({
          addressId: entity.address.id,
          identityId: entity.identity.id,
          legacyTable: "service_locations",
          legacyId: row.id,
        });
        bump(report, "serviceLocations", "migrated");
      } catch {
        bump(report, "serviceLocations", "errors");
      }
    }
  }

  private async migrateVehicles(report: LegacyMigrationReport) {
    const rows = await db
      .select()
      .from(vehiclesTable)
      .where(isNotNull(vehiclesTable.serviceAddress));

    for (const row of rows) {
      try {
        const existing = await addressLegacyLinkRepository.findByLegacy("vehicles", row.id);
        if (existing) {
          bump(report, "vehicles", "skipped");
          continue;
        }

        const entity = await addressService.create({
          customerId: row.customerId,
          nickname: row.locationLabel ?? `Vehicle ${row.id}`,
          addressType: "OTHER",
          formattedAddress: row.serviceAddress ?? undefined,
          latitude: row.serviceLat,
          longitude: row.serviceLng,
          placeId: row.placeId,
          source: "IMPORTED",
          allowDuplicate: true,
          validateCoverage: false,
        }, { isLegacyMigrated: true });

        await addressLegacyLinkRepository.upsert({
          addressId: entity.address.id,
          identityId: entity.identity.id,
          legacyTable: "vehicles",
          legacyId: row.id,
        });
        bump(report, "vehicles", "migrated");
      } catch {
        bump(report, "vehicles", "errors");
      }
    }
  }

  private async migrateSolarSites(report: LegacyMigrationReport) {
    const rows = await db
      .select()
      .from(solarSitesTable)
      .where(isNotNull(solarSitesTable.address));

    for (const row of rows) {
      try {
        const existing = await addressLegacyLinkRepository.findByLegacy("solar_sites", row.id);
        if (existing) {
          bump(report, "solarSites", "skipped");
          continue;
        }

        const entity = await addressService.create({
          customerId: row.customerId,
          nickname: row.locationLabel ?? row.siteName ?? `Solar ${row.id}`,
          addressType: "SITE",
          formattedAddress: row.address,
          locality: row.city ?? undefined,
          latitude: row.serviceLat,
          longitude: row.serviceLng,
          placeId: row.placeId,
          source: "IMPORTED",
          allowDuplicate: true,
          validateCoverage: false,
        }, { isLegacyMigrated: true });

        await addressLegacyLinkRepository.upsert({
          addressId: entity.address.id,
          identityId: entity.identity.id,
          legacyTable: "solar_sites",
          legacyId: row.id,
        });
        bump(report, "solarSites", "migrated");
      } catch {
        bump(report, "solarSites", "errors");
      }
    }
  }
}

export const legacyAddressMigrator = new LegacyAddressMigrator();
