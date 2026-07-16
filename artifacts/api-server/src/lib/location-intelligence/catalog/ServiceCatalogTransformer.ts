import type { CoverageResultCore } from "../domain/CoverageResultCore";
import type { CoverageResult, ServiceSummary } from "../../coverage/CoverageTypes";

export type ServiceCatalogView = {
  availableServices: ServiceSummary[];
  comingSoonServices: ServiceSummary[];
  unavailableServices: ServiceSummary[];
};

export class ServiceCatalogTransformer {
  attachCatalog(
    core: CoverageResultCore,
    catalog?: ServiceCatalogView,
  ): CoverageResult {
    const ctx = core.locationContext;
    return {
      success: core.success,
      status: core.status,
      legacyStatus: core.legacyStatus,
      message: core.message,
      coverageStatus: core.coverageStatus,
      correlation: core.correlation,
      pincode: ctx.postalCode ?? undefined,
      city: ctx.city ?? undefined,
      cityId: ctx.city?.id,
      cityName: ctx.city?.name,
      stateName: ctx.state?.name,
      serviceAreaId: ctx.serviceArea?.id,
      serviceArea: ctx.serviceArea?.name,
      serviceAreaName: ctx.serviceArea?.name,
      serviceId: core.serviceAvailability?.serviceId,
      parsedAddress: ctx.address.parsed,
      cityResolutionSource: core.locationContext.metadata.cityResolutionSource as CoverageResult["cityResolutionSource"],
      usedCityFallback: core.locationContext.metadata.usedCityFallback as boolean | undefined,
      availableServices: catalog?.availableServices ?? [],
      comingSoonServices: catalog?.comingSoonServices ?? [],
      unavailableServices: catalog?.unavailableServices ?? [],
      resolvedCityId: core.resolvedCityId,
      locationContext: ctx,
      confidenceScore: core.confidenceScore,
      version: core.version,
    };
  }

  toCheckApiResponse(result: CoverageResult) {
    if (!result.success) {
      return {
        success: false,
        status: result.legacyStatus,
        coverageStatus: result.coverageStatus,
        message: result.message,
        correlation: result.correlation,
        postalCode: result.pincode ?? result.parsedAddress?.postalCode ?? null,
        city: result.city ?? null,
        serviceArea: result.serviceArea ?? result.serviceAreaName ?? null,
        confidenceScore: result.confidenceScore,
        availableServices: result.availableServices ?? [],
        comingSoonServices: result.comingSoonServices ?? [],
        unavailableServices: result.unavailableServices ?? [],
      };
    }

    return {
      success: true,
      coverageStatus: result.coverageStatus,
      correlation: result.correlation,
      confidenceScore: result.confidenceScore,
      city: result.city
        ? { id: result.city.id, name: result.city.name, slug: result.city.slug, stateName: result.city.stateName }
        : null,
      postalCode: result.pincode ?? result.parsedAddress?.postalCode ?? null,
      serviceArea: result.serviceArea ?? result.serviceAreaName ?? null,
      availableServices: result.availableServices ?? [],
      comingSoonServices: result.comingSoonServices ?? [],
      unavailableServices: result.unavailableServices ?? [],
    };
  }
}

export const serviceCatalogTransformer = new ServiceCatalogTransformer();
