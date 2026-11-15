import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  geographicLocalitiesTable,
  locationAliasesTable,
  citiesTable,
} from "@workspace/db";
import { eq, and, asc, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { locationResolver, normalizeLocationText } from "../lib/location-intelligence/resolver/LocationResolver";
import { serviceabilityEngine } from "../lib/location-intelligence/serviceability/ServiceabilityEngine";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Resolve Location & Evaluate Serviceability (Public)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/location/resolve", async (req: Request, res: Response) => {
  try {
    const {
      placeId,
      latitude,
      longitude,
      locationLat,
      locationLng,
      cityId,
      citySlug,
      cityName,
      pincode,
      postalCode,
      locality,
      sector,
      societyName,
      societyId,
      localityId,
      propertyType,
      formattedAddress,
      address,
      serviceId,
      scheduledDate,
    } = req.body;

    // Run Location Resolver
    const resolved = await locationResolver.resolve({
      placeId: placeId || undefined,
      latitude: latitude != null ? parseFloat(latitude) : locationLat != null ? parseFloat(locationLat) : undefined,
      longitude: longitude != null ? parseFloat(longitude) : locationLng != null ? parseFloat(locationLng) : undefined,
      cityId: cityId ? parseInt(cityId, 10) : undefined,
      citySlug: citySlug || undefined,
      cityName: cityName || undefined,
      pincode: pincode || postalCode || undefined,
      postalCode: postalCode || pincode || undefined,
      locality: locality || undefined,
      sector: sector || undefined,
      societyName: societyName || undefined,
      societyId: societyId ? parseInt(societyId, 10) : undefined,
      localityId: localityId ? parseInt(localityId, 10) : undefined,
      propertyType: propertyType || undefined,
      formattedAddress: formattedAddress || address || undefined,
      address: address || formattedAddress || undefined,
    });

    // Run Serviceability Engine
    const serviceability = await serviceabilityEngine.evaluate({
      cityId: resolved.cityId,
      branchId: resolved.branchId,
      zoneId: resolved.zoneId,
      societyId: resolved.societyId,
      localityId: resolved.localityId,
      pincode: pincode || postalCode,
      propertyType: resolved.propertyType,
      serviceId: serviceId ? parseInt(serviceId, 10) : undefined,
      scheduledDate: scheduledDate || undefined,
      resolvedLocation: resolved,
    });

    // Structured Observability Logging
    if (!serviceability.isServiceable) {
      req.log.warn({
        event: "LOCATION_UNSERVICEABLE",
        cityId: resolved.cityId,
        zoneId: resolved.zoneId,
        propertyType: resolved.propertyType,
        resolutionStatus: resolved.status,
        serviceabilityStatus: serviceability.status,
        rejectionReason: serviceability.rejectionReason,
      }, "Location resolved to non-serviceable status");
    } else {
      req.log.info({
        event: "LOCATION_RESOLVED_SERVICEABLE",
        cityId: resolved.cityId,
        branchId: resolved.branchId,
        zoneId: resolved.zoneId,
        societyId: resolved.societyId,
        propertyType: resolved.propertyType,
        confidence: resolved.confidence,
        matchedBy: resolved.matchedBy,
      }, "Location successfully resolved to serviceable area");
    }

    return res.json({
      success: true,
      resolution: resolved,
      serviceability,
    });
  } catch (err) {
    req.log.error({ err }, "Error resolving location");
    return res.status(500).json({ error: "Failed to resolve location" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Geographic Localities / Sectors CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get("/location/localities", async (req: Request, res: Response) => {
  try {
    const { cityId, citySlug, search, includeInactive } = req.query as Record<string, string>;
    const conditions = [];

    if (includeInactive !== "true") {
      conditions.push(eq(geographicLocalitiesTable.isActive, true));
    }

    if (cityId) {
      conditions.push(eq(geographicLocalitiesTable.cityId, parseInt(cityId, 10)));
    } else if (citySlug) {
      const [city] = await db.select({ id: citiesTable.id }).from(citiesTable).where(eq(citiesTable.slug, citySlug.toLowerCase().trim())).limit(1);
      if (city) {
        conditions.push(eq(geographicLocalitiesTable.cityId, city.id));
      }
    }

    if (search?.trim()) {
      conditions.push(ilike(geographicLocalitiesTable.name, `%${search.trim()}%`));
    }

    const localities = await db
      .select({
        id: geographicLocalitiesTable.id,
        cityId: geographicLocalitiesTable.cityId,
        serviceAreaId: geographicLocalitiesTable.serviceAreaId,
        name: geographicLocalitiesTable.name,
        slug: geographicLocalitiesTable.slug,
        code: geographicLocalitiesTable.code,
        pincode: geographicLocalitiesTable.pincode,
        latitude: geographicLocalitiesTable.latitude,
        longitude: geographicLocalitiesTable.longitude,
        boundaryGeoJson: geographicLocalitiesTable.boundaryGeoJson,
        isActive: geographicLocalitiesTable.isActive,
      })
      .from(geographicLocalitiesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(geographicLocalitiesTable.name));

    return res.json(localities);
  } catch (err) {
    req.log.error({ err }, "Error listing geographic localities");
    return res.status(500).json({ error: "Failed to list localities" });
  }
});

router.post("/location/localities", requireAuth, async (req: Request, res: Response) => {
  try {
    const { cityId, serviceAreaId, name, slug, code, pincode, latitude, longitude, boundaryGeoJson } = req.body;
    if (!cityId || !name) {
      return res.status(400).json({ error: "cityId and name are required" });
    }

    const generatedSlug = slug?.trim() || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const [locality] = await db
      .insert(geographicLocalitiesTable)
      .values({
        cityId: parseInt(cityId, 10),
        serviceAreaId: serviceAreaId ? parseInt(serviceAreaId, 10) : null,
        name: name.trim(),
        slug: generatedSlug,
        code: code?.trim() || null,
        pincode: pincode?.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        boundaryGeoJson: boundaryGeoJson || null,
        isActive: true,
      })
      .returning();

    return res.status(201).json(locality);
  } catch (err) {
    req.log.error({ err }, "Error creating geographic locality");
    return res.status(500).json({ error: "Failed to create locality" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Location Aliases
// ─────────────────────────────────────────────────────────────────────────────
router.get("/location/aliases", async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.query as Record<string, string>;
    const conditions = [eq(locationAliasesTable.isActive, true)];

    if (entityType) conditions.push(eq(locationAliasesTable.entityType, entityType));
    if (entityId) conditions.push(eq(locationAliasesTable.entityId, parseInt(entityId, 10)));

    const aliases = await db
      .select()
      .from(locationAliasesTable)
      .where(and(...conditions))
      .orderBy(asc(locationAliasesTable.alias));

    return res.json(aliases);
  } catch (err) {
    req.log.error({ err }, "Error listing location aliases");
    return res.status(500).json({ error: "Failed to list aliases" });
  }
});

router.post("/location/aliases", requireAuth, async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, alias, locale } = req.body;
    if (!entityType || !entityId || !alias) {
      return res.status(400).json({ error: "entityType, entityId, and alias are required" });
    }

    const normalized = normalizeLocationText(alias);

    const [row] = await db
      .insert(locationAliasesTable)
      .values({
        entityType,
        entityId: parseInt(entityId, 10),
        alias: alias.trim(),
        normalizedAlias: normalized,
        locale: locale || "en",
        isActive: true,
      })
      .returning();

    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Error creating location alias");
    return res.status(500).json({ error: "Failed to create alias" });
  }
});

export default router;
