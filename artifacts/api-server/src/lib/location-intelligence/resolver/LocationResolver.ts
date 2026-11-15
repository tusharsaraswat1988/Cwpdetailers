import { db } from "@workspace/db";
import {
  citiesTable,
  residentialSocietiesTable,
  geographicLocalitiesTable,
  locationAliasesTable,
  operationalZonesTable,
  branchZoneMappingsTable,
  branchesTable,
  zoneCoverageRulesTable,
} from "@workspace/db";
import { eq, and, ilike, or, sql } from "drizzle-orm";

export type PropertyLocationType =
  | "GATED_SOCIETY"
  | "APARTMENT"
  | "INDIVIDUAL_HOME"
  | "COMMERCIAL_PROPERTY"
  | "OTHER";

export type ResolutionStatus =
  | "EXACT_MATCH"
  | "CANDIDATE_MATCH"
  | "AMBIGUOUS"
  | "UNRESOLVED";

export interface LocationResolveInput {
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cityId?: number | null;
  citySlug?: string | null;
  cityName?: string | null;
  pincode?: string | null;
  postalCode?: string | null;
  locality?: string | null;
  sector?: string | null;
  societyName?: string | null;
  societyId?: number | null;
  localityId?: number | null;
  propertyType?: PropertyLocationType | string | null;
  formattedAddress?: string | null;
  address?: string | null;
  flatNumber?: string | null;
  houseNumber?: string | null;
  tower?: string | null;
}

export interface LocationResolveOutput {
  status: ResolutionStatus;
  confidence: number;
  cityId: number | null;
  cityName: string | null;
  localityId: number | null;
  localityName: string | null;
  societyId: number | null;
  societyName: string | null;
  propertyType: PropertyLocationType;
  zoneId: number | null;
  zoneName: string | null;
  zoneCode: string | null;
  branchId: number | null;
  branchName: string | null;
  normalizedAddress: string;
  matchedBy: "place_id" | "exact_society" | "alias" | "locality" | "coordinates" | "pincode" | "fallback" | "unresolved";
  candidates?: Array<{ id: number; name: string; type: "society" | "locality"; similarity: number }>;
  message?: string;
}

export function normalizeLocationText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

/** Haversine formula in meters between two lat/lng coordinates */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class LocationResolver {
  async resolve(input: LocationResolveInput): Promise<LocationResolveOutput> {
    const rawAddress = input.formattedAddress || input.address || "";
    const normalizedInput = normalizeLocationText(
      [input.societyName, input.sector, input.locality, rawAddress].filter(Boolean).join(" "),
    );

    let cityId = input.cityId ?? null;
    let cityName = input.cityName ?? null;

    // 1. Resolve City
    if (!cityId && (input.citySlug || input.cityName)) {
      const cityQuery = input.citySlug
        ? eq(citiesTable.slug, input.citySlug.toLowerCase().trim())
        : ilike(citiesTable.name, `%${input.cityName?.trim()}%`);

      const [city] = await db
        .select({ id: citiesTable.id, name: citiesTable.name })
        .from(citiesTable)
        .where(and(cityQuery, eq(citiesTable.isActive, true)))
        .limit(1);

      if (city) {
        cityId = city.id;
        cityName = city.name;
      }
    }

    // Determine normalized property type
    const normalizedPropType: PropertyLocationType = this.normalizePropertyType(
      input.propertyType,
      input.societyName || input.societyId ? "GATED_SOCIETY" : "INDIVIDUAL_HOME",
    );

    let resolvedSociety: { id: number; name: string; code?: string; cityId: number; branchId?: number | null } | null = null;
    let resolvedLocality: { id: number; name: string; slug: string; cityId: number } | null = null;
    let matchedBy: LocationResolveOutput["matchedBy"] = "unresolved";
    let status: ResolutionStatus = "UNRESOLVED";
    let confidence = 0;

    // 2. Exact Match via societyId
    if (input.societyId) {
      const [society] = await db
        .select({
          id: residentialSocietiesTable.id,
          name: residentialSocietiesTable.name,
          code: residentialSocietiesTable.code,
          cityId: residentialSocietiesTable.cityId,
          branchId: residentialSocietiesTable.branchId,
          isActive: residentialSocietiesTable.isActive,
        })
        .from(residentialSocietiesTable)
        .where(eq(residentialSocietiesTable.id, input.societyId))
        .limit(1);

      if (society && society.isActive) {
        resolvedSociety = society;
        if (!cityId) cityId = society.cityId;
        status = "EXACT_MATCH";
        confidence = 100;
        matchedBy = "exact_society";
      }
    }

    // 3. Exact Match via localityId
    if (!resolvedSociety && input.localityId) {
      const [locality] = await db
        .select({
          id: geographicLocalitiesTable.id,
          name: geographicLocalitiesTable.name,
          slug: geographicLocalitiesTable.slug,
          cityId: geographicLocalitiesTable.cityId,
          isActive: geographicLocalitiesTable.isActive,
        })
        .from(geographicLocalitiesTable)
        .where(eq(geographicLocalitiesTable.id, input.localityId))
        .limit(1);

      if (locality && locality.isActive) {
        resolvedLocality = locality;
        if (!cityId) cityId = locality.cityId;
        status = "EXACT_MATCH";
        confidence = 90;
        matchedBy = "locality";
      }
    }

    // 4. Match via Alias / Normalized Name
    if (!resolvedSociety && !resolvedLocality && normalizedInput) {
      const [aliasMatch] = await db
        .select({
          entityType: locationAliasesTable.entityType,
          entityId: locationAliasesTable.entityId,
          normalizedAlias: locationAliasesTable.normalizedAlias,
        })
        .from(locationAliasesTable)
        .where(
          and(
            eq(locationAliasesTable.isActive, true),
            sql`${normalizedInput} ILIKE '%' || ${locationAliasesTable.normalizedAlias} || '%'`,
          ),
        )
        .limit(1);

      if (aliasMatch) {
        if (aliasMatch.entityType === "society") {
          const [soc] = await db
            .select({
              id: residentialSocietiesTable.id,
              name: residentialSocietiesTable.name,
              code: residentialSocietiesTable.code,
              cityId: residentialSocietiesTable.cityId,
              branchId: residentialSocietiesTable.branchId,
            })
            .from(residentialSocietiesTable)
            .where(eq(residentialSocietiesTable.id, aliasMatch.entityId))
            .limit(1);
          if (soc) {
            resolvedSociety = soc;
            if (!cityId) cityId = soc.cityId;
            status = "EXACT_MATCH";
            confidence = 95;
            matchedBy = "alias";
          }
        } else if (aliasMatch.entityType === "locality") {
          const [loc] = await db
            .select({
              id: geographicLocalitiesTable.id,
              name: geographicLocalitiesTable.name,
              slug: geographicLocalitiesTable.slug,
              cityId: geographicLocalitiesTable.cityId,
            })
            .from(geographicLocalitiesTable)
            .where(eq(geographicLocalitiesTable.id, aliasMatch.entityId))
            .limit(1);
          if (loc) {
            resolvedLocality = loc;
            if (!cityId) cityId = loc.cityId;
            status = "CANDIDATE_MATCH";
            confidence = 85;
            matchedBy = "alias";
          }
        }
      }
    }

    // 5. Match Society by text name search if GATED_SOCIETY or societyName given
    if (!resolvedSociety && (input.societyName || normalizedPropType === "GATED_SOCIETY" || normalizedPropType === "APARTMENT")) {
      const queryName = input.societyName?.trim() || "";
      if (queryName.length >= 3) {
        const matchingSocieties = await db
          .select({
            id: residentialSocietiesTable.id,
            name: residentialSocietiesTable.name,
            code: residentialSocietiesTable.code,
            cityId: residentialSocietiesTable.cityId,
            branchId: residentialSocietiesTable.branchId,
            latitude: residentialSocietiesTable.latitude,
            longitude: residentialSocietiesTable.longitude,
          })
          .from(residentialSocietiesTable)
          .where(
            and(
              eq(residentialSocietiesTable.isActive, true),
              cityId ? eq(residentialSocietiesTable.cityId, cityId) : undefined,
              ilike(residentialSocietiesTable.name, `%${queryName}%`),
            ),
          )
          .limit(5);

        if (matchingSocieties.length === 1) {
          resolvedSociety = matchingSocieties[0];
          if (!cityId) cityId = resolvedSociety.cityId;
          status = "EXACT_MATCH";
          confidence = 90;
          matchedBy = "exact_society";
        } else if (matchingSocieties.length > 1) {
          status = "AMBIGUOUS";
          confidence = 60;
          matchedBy = "exact_society";
          return {
            status: "AMBIGUOUS",
            confidence: 60,
            cityId,
            cityName,
            localityId: null,
            localityName: null,
            societyId: null,
            societyName: null,
            propertyType: normalizedPropType,
            zoneId: null,
            zoneName: null,
            zoneCode: null,
            branchId: null,
            branchName: null,
            normalizedAddress: rawAddress,
            matchedBy: "exact_society",
            candidates: matchingSocieties.map(s => ({ id: s.id, name: s.name, type: "society", similarity: 0.8 })),
            message: `Multiple societies found matching '${queryName}'. Please select the specific society.`,
          };
        }
      }
    }

    // 6. Proximity matching using Lat/Lng coordinates
    if (!resolvedSociety && input.latitude != null && input.longitude != null && !Number.isNaN(input.latitude)) {
      // Find societies within 300 meters
      const societiesWithCoords = await db
        .select({
          id: residentialSocietiesTable.id,
          name: residentialSocietiesTable.name,
          code: residentialSocietiesTable.code,
          cityId: residentialSocietiesTable.cityId,
          branchId: residentialSocietiesTable.branchId,
          latitude: residentialSocietiesTable.latitude,
          longitude: residentialSocietiesTable.longitude,
        })
        .from(residentialSocietiesTable)
        .where(
          and(
            eq(residentialSocietiesTable.isActive, true),
            cityId ? eq(residentialSocietiesTable.cityId, cityId) : undefined,
            sql`${residentialSocietiesTable.latitude} IS NOT NULL`,
            sql`${residentialSocietiesTable.longitude} IS NOT NULL`,
          ),
        );

      let closestSociety: typeof societiesWithCoords[0] | null = null;
      let minDistance = Infinity;

      for (const soc of societiesWithCoords) {
        if (soc.latitude != null && soc.longitude != null) {
          const dist = calculateDistanceMeters(input.latitude, input.longitude, soc.latitude, soc.longitude);
          if (dist <= 350 && dist < minDistance) {
            minDistance = dist;
            closestSociety = soc;
          }
        }
      }

      if (closestSociety && (normalizedPropType === "GATED_SOCIETY" || normalizedPropType === "APARTMENT")) {
        resolvedSociety = closestSociety;
        if (!cityId) cityId = closestSociety.cityId;
        status = "CANDIDATE_MATCH";
        confidence = minDistance < 150 ? 90 : 75;
        matchedBy = "coordinates";
      }
    }

    // 7. Match Locality / Sector by text
    if (!resolvedSociety && !resolvedLocality) {
      const sectorOrLocality = input.sector || input.locality;
      if (sectorOrLocality && sectorOrLocality.trim().length >= 2) {
        const [loc] = await db
          .select({
            id: geographicLocalitiesTable.id,
            name: geographicLocalitiesTable.name,
            slug: geographicLocalitiesTable.slug,
            cityId: geographicLocalitiesTable.cityId,
          })
          .from(geographicLocalitiesTable)
          .where(
            and(
              eq(geographicLocalitiesTable.isActive, true),
              cityId ? eq(geographicLocalitiesTable.cityId, cityId) : undefined,
              ilike(geographicLocalitiesTable.name, `%${sectorOrLocality.trim()}%`),
            ),
          )
          .limit(1);

        if (loc) {
          resolvedLocality = loc;
          if (!cityId) cityId = loc.cityId;
          status = "CANDIDATE_MATCH";
          confidence = 80;
          matchedBy = "locality";
        }
      }
    }

    // 8. Resolve Operational Zone and Branch
    let resolvedZone: { id: number; name: string; code: string; branchId: number | null } | null = null;
    let resolvedBranch: { id: number; name: string } | null = null;

    if (cityId) {
      // 8a. Check zone coverage rule for society
      if (resolvedSociety) {
        const [rule] = await db
          .select({
            zoneId: zoneCoverageRulesTable.zoneId,
            branchId: zoneCoverageRulesTable.branchId,
          })
          .from(zoneCoverageRulesTable)
          .where(
            and(
              eq(zoneCoverageRulesTable.societyId, resolvedSociety.id),
              eq(zoneCoverageRulesTable.isActive, true),
            ),
          )
          .orderBy(sql`${zoneCoverageRulesTable.priority} DESC`)
          .limit(1);

        if (rule?.zoneId) {
          const [zone] = await db
            .select({
              id: operationalZonesTable.id,
              name: operationalZonesTable.name,
              code: operationalZonesTable.code,
              branchId: operationalZonesTable.branchId,
            })
            .from(operationalZonesTable)
            .where(eq(operationalZonesTable.id, rule.zoneId))
            .limit(1);

          if (zone) {
            resolvedZone = { ...zone, branchId: rule.branchId ?? zone.branchId };
          }
        }

        // If society has a direct branchId attached
        if (!resolvedZone && resolvedSociety.branchId) {
          const [branch] = await db
            .select({ id: branchesTable.id, name: branchesTable.name })
            .from(branchesTable)
            .where(eq(branchesTable.id, resolvedSociety.branchId))
            .limit(1);
          if (branch) {
            resolvedBranch = branch;
          }
        }
      }

      // 8b. Check zone coverage rule for locality
      if (!resolvedZone && resolvedLocality) {
        const [rule] = await db
          .select({
            zoneId: zoneCoverageRulesTable.zoneId,
            branchId: zoneCoverageRulesTable.branchId,
          })
          .from(zoneCoverageRulesTable)
          .where(
            and(
              eq(zoneCoverageRulesTable.localityId, resolvedLocality.id),
              eq(zoneCoverageRulesTable.isActive, true),
            ),
          )
          .orderBy(sql`${zoneCoverageRulesTable.priority} DESC`)
          .limit(1);

        if (rule?.zoneId) {
          const [zone] = await db
            .select({
              id: operationalZonesTable.id,
              name: operationalZonesTable.name,
              code: operationalZonesTable.code,
              branchId: operationalZonesTable.branchId,
            })
            .from(operationalZonesTable)
            .where(eq(operationalZonesTable.id, rule.zoneId))
            .limit(1);

          if (zone) {
            resolvedZone = { ...zone, branchId: rule.branchId ?? zone.branchId };
          }
        }
      }

      // 8c. Check zone coverage rule for pincode
      const pin = input.pincode || input.postalCode;
      if (!resolvedZone && pin) {
        const [rule] = await db
          .select({
            zoneId: zoneCoverageRulesTable.zoneId,
            branchId: zoneCoverageRulesTable.branchId,
          })
          .from(zoneCoverageRulesTable)
          .where(
            and(
              eq(zoneCoverageRulesTable.pincode, pin.trim()),
              eq(zoneCoverageRulesTable.isActive, true),
            ),
          )
          .orderBy(sql`${zoneCoverageRulesTable.priority} DESC`)
          .limit(1);

        if (rule?.zoneId) {
          const [zone] = await db
            .select({
              id: operationalZonesTable.id,
              name: operationalZonesTable.name,
              code: operationalZonesTable.code,
              branchId: operationalZonesTable.branchId,
            })
            .from(operationalZonesTable)
            .where(eq(operationalZonesTable.id, rule.zoneId))
            .limit(1);

          if (zone) {
            resolvedZone = { ...zone, branchId: rule.branchId ?? zone.branchId };
          }
        }
      }

      // 8d. Fallback: First active zone in the city
      if (!resolvedZone) {
        const [defaultZone] = await db
          .select({
            id: operationalZonesTable.id,
            name: operationalZonesTable.name,
            code: operationalZonesTable.code,
            branchId: operationalZonesTable.branchId,
          })
          .from(operationalZonesTable)
          .where(
            and(
              eq(operationalZonesTable.cityId, cityId),
              eq(operationalZonesTable.isActive, true),
            ),
          )
          .limit(1);

        if (defaultZone) {
          resolvedZone = defaultZone;
          if (status === "UNRESOLVED") {
            status = "CANDIDATE_MATCH";
            confidence = 50;
            matchedBy = "fallback";
          }
        }
      }

      // Resolve branch from zone or city
      if (resolvedZone?.branchId && !resolvedBranch) {
        const [branch] = await db
          .select({ id: branchesTable.id, name: branchesTable.name })
          .from(branchesTable)
          .where(eq(branchesTable.id, resolvedZone.branchId))
          .limit(1);
        if (branch) {
          resolvedBranch = branch;
        }
      }

      if (!resolvedBranch) {
        const [branch] = await db
          .select({ id: branchesTable.id, name: branchesTable.name })
          .from(branchesTable)
          .where(
            and(
              eq(branchesTable.cityId, cityId),
              eq(branchesTable.isActive, true),
            ),
          )
          .limit(1);
        if (branch) {
          resolvedBranch = branch;
        }
      }
    }

    if (!cityName && cityId) {
      const [c] = await db.select({ name: citiesTable.name }).from(citiesTable).where(eq(citiesTable.id, cityId)).limit(1);
      cityName = c?.name ?? null;
    }

    if (resolvedSociety || resolvedLocality || (cityId && resolvedZone)) {
      if (status === "UNRESOLVED") {
        status = "CANDIDATE_MATCH";
        confidence = 50;
      }
    }

    return {
      status,
      confidence,
      cityId,
      cityName,
      localityId: resolvedLocality?.id ?? null,
      localityName: resolvedLocality?.name ?? null,
      societyId: resolvedSociety?.id ?? null,
      societyName: resolvedSociety?.name ?? null,
      propertyType: normalizedPropType,
      zoneId: resolvedZone?.id ?? null,
      zoneName: resolvedZone?.name ?? null,
      zoneCode: resolvedZone?.code ?? null,
      branchId: resolvedBranch?.id ?? null,
      branchName: resolvedBranch?.name ?? null,
      normalizedAddress: rawAddress,
      matchedBy,
      message: status === "UNRESOLVED" ? "Location could not be definitively resolved to a known service area." : undefined,
    };
  }

  private normalizePropertyType(
    raw?: string | null,
    fallback: PropertyLocationType = "OTHER",
  ): PropertyLocationType {
    if (!raw) return fallback;
    const clean = raw.toUpperCase().trim();
    if (clean === "GATED_SOCIETY" || clean === "SOCIETY") return "GATED_SOCIETY";
    if (clean === "APARTMENT" || clean === "FLAT") return "APARTMENT";
    if (clean === "INDIVIDUAL_HOME" || clean === "HOUSE" || clean === "VILLA") return "INDIVIDUAL_HOME";
    if (clean === "COMMERCIAL_PROPERTY" || clean === "OFFICE" || clean === "COMMERCIAL") return "COMMERCIAL_PROPERTY";
    return "OTHER";
  }
}

export const locationResolver = new LocationResolver();
