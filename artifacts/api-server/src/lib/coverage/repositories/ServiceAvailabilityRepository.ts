import { db } from "@workspace/db";
import {
  serviceCityAvailabilityTable,
  servicesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { cacheKey, coverageCache } from "../CoverageCache";
import type { ServiceSummary } from "../CoverageTypes";

export type CityServiceCatalog = {
  availableServices: ServiceSummary[];
  comingSoonServices: ServiceSummary[];
  unavailableServices: ServiceSummary[];
};

export class ServiceAvailabilityRepository {
  async isServiceAvailableInCity(serviceId: number, cityId: number): Promise<boolean> {
    const catalog = await this.getCityServiceCatalog(cityId);
    return catalog.availableServices.some(s => s.id === serviceId);
  }

  async getCityServiceCatalog(cityId: number): Promise<CityServiceCatalog> {
    const key = cacheKey("services", "city", cityId);
    const cached = coverageCache.get<CityServiceCatalog>(key);
    if (cached) return cached;

    const rows = await db
      .select({
        serviceId: servicesTable.id,
        serviceName: servicesTable.name,
        serviceSlug: servicesTable.slug,
        serviceCategory: servicesTable.category,
        serviceActive: servicesTable.isActive,
        availabilityActive: serviceCityAvailabilityTable.isActive,
        hasAvailabilityRow: serviceCityAvailabilityTable.id,
      })
      .from(servicesTable)
      .leftJoin(
        serviceCityAvailabilityTable,
        and(
          eq(serviceCityAvailabilityTable.serviceId, servicesTable.id),
          eq(serviceCityAvailabilityTable.cityId, cityId),
        ),
      )
      .where(eq(servicesTable.isActive, true));

    const availableServices: ServiceSummary[] = [];
    const unavailableServices: ServiceSummary[] = [];
    const comingSoonServices: ServiceSummary[] = [];

    for (const row of rows) {
      const summary: ServiceSummary = {
        id: row.serviceId,
        name: row.serviceName,
        slug: row.serviceSlug,
        category: row.serviceCategory,
      };

      if (row.hasAvailabilityRow && row.availabilityActive) {
        availableServices.push(summary);
      } else {
        unavailableServices.push(summary);
      }
    }

    const catalog: CityServiceCatalog = {
      availableServices,
      comingSoonServices,
      unavailableServices,
    };

    coverageCache.set(key, catalog);
    return catalog;
  }
}

export const serviceAvailabilityRepository = new ServiceAvailabilityRepository();
