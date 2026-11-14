import { db } from "@workspace/db";
import {
  uxExperimentsTable,
  uxExperimentExposuresTable,
  type UxExperiment,
  type InsertUxExperiment,
} from "@workspace/db";
import { eq, and, or, isNull, sql, desc, inArray } from "drizzle-orm";

export interface VariantDefinition {
  id: string; // 'control', 'variant_b', etc.
  name: string;
  weight: number; // e.g. 50
  config: Record<string, unknown>;
}

/**
 * Fast, deterministic 32-bit hash function (DJB2 variant).
 * Ensures identical session + key always yields the exact same variant.
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Resolves which variant a session should receive for an experiment.
 */
export function resolveVariantForSession(
  experiment: UxExperiment,
  sessionId: string,
): { variantId: string; variantName: string; config: Record<string, unknown>; inExperiment: boolean } {
  const variants = (experiment.variants as VariantDefinition[]) || [];
  if (!variants.length) {
    return {
      variantId: "control",
      variantName: "Control",
      config: {},
      inExperiment: false,
    };
  }

  // 1. Check traffic allocation (0 - 100)
  const trafficHash = hashString(`${experiment.key}:traffic:${sessionId}`) % 100;
  if (trafficHash >= experiment.trafficAllocation) {
    // Falls outside allocated traffic -> assign control
    const control = variants.find((v) => v.id === "control") || variants[0];
    return {
      variantId: control.id,
      variantName: control.name,
      config: control.config || {},
      inExperiment: false,
    };
  }

  // 2. Deterministically assign variant according to relative weights
  const totalWeight = variants.reduce((acc, v) => acc + (v.weight || 0), 0);
  if (totalWeight <= 0) {
    const fallback = variants[0];
    return {
      variantId: fallback.id,
      variantName: fallback.name,
      config: fallback.config || {},
      inExperiment: true,
    };
  }

  const variantHash = (hashString(`${experiment.key}:variant:${sessionId}`) % totalWeight);
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight || 0;
    if (variantHash < cumulative) {
      return {
        variantId: variant.id,
        variantName: variant.name,
        config: variant.config || {},
        inExperiment: true,
      };
    }
  }

  const defaultVariant = variants[0];
  return {
    variantId: defaultVariant.id,
    variantName: defaultVariant.name,
    config: defaultVariant.config || {},
    inExperiment: true,
  };
}

export interface GetActiveExperimentsOptions {
  targetScreen?: string;
  cityId?: number | null;
  branchId?: number | null;
  sessionId: string;
  customerId?: number | null;
}

/**
 * Returns active experiments matching the screen, city, and branch scope,
 * with deterministic variant assignments for the session.
 */
export async function getActiveExperimentsForScreen(options: GetActiveExperimentsOptions) {
  const { targetScreen, cityId, branchId, sessionId, customerId } = options;

  const conditions = [eq(uxExperimentsTable.status, "active")];

  if (targetScreen) {
    conditions.push(eq(uxExperimentsTable.targetScreen, targetScreen));
  }

  // City scope: null (global) or matches cityId
  if (cityId) {
    conditions.push(
      or(isNull(uxExperimentsTable.cityId), eq(uxExperimentsTable.cityId, cityId))!
    );
  } else {
    conditions.push(isNull(uxExperimentsTable.cityId));
  }

  // Branch scope: null (global/citywide) or matches branchId
  if (branchId) {
    conditions.push(
      or(isNull(uxExperimentsTable.branchId), eq(uxExperimentsTable.branchId, branchId))!
    );
  } else {
    conditions.push(isNull(uxExperimentsTable.branchId));
  }

  const activeExperiments = await db
    .select()
    .from(uxExperimentsTable)
    .where(and(...conditions));

  return activeExperiments.map((exp) => {
    const resolved = resolveVariantForSession(exp, sessionId);
    return {
      experimentId: exp.id,
      key: exp.key,
      name: exp.name,
      targetScreen: exp.targetScreen,
      primaryMetric: exp.primaryMetric,
      variant: resolved,
    };
  });
}

export interface LogExposureOptions {
  experimentId: number;
  variantId: string;
  sessionId: string;
  customerId?: number | null;
  cityId?: number | null;
  deviceType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records user exposure to a specific variant.
 * Deduplicated via unique index on (experiment_id, session_id).
 */
export async function logExperimentExposure(options: LogExposureOptions) {
  const { experimentId, variantId, sessionId, customerId, cityId, deviceType = "mobile", metadata = {} } = options;

  try {
    const [exposure] = await db
      .insert(uxExperimentExposuresTable)
      .values({
        experimentId,
        variantId,
        sessionId,
        customerId: customerId || null,
        cityId: cityId || null,
        deviceType,
        metadata,
      })
      .onConflictDoNothing()
      .returning();

    return exposure || null;
  } catch (err) {
    // Non-blocking log failure
    return null;
  }
}

export interface RecordConversionOptions {
  sessionId: string;
  customerId?: number | null;
  eventName: string;
  conversionValue?: number | null;
}

/**
 * Flags conversions for all experiments where the session was exposed
 * and the event matches the experiment's primary metric or general conversion.
 */
export async function recordExperimentConversion(options: RecordConversionOptions) {
  const { sessionId, customerId, eventName, conversionValue } = options;

  try {
    const matchingExposures = await db
      .select({
        exposureId: uxExperimentExposuresTable.id,
        experimentId: uxExperimentExposuresTable.experimentId,
      })
      .from(uxExperimentExposuresTable)
      .where(
        and(
          eq(uxExperimentExposuresTable.sessionId, sessionId),
          eq(uxExperimentExposuresTable.converted, false)
        )
      );

    if (!matchingExposures.length) return [];

    const updated = [];
    for (const exp of matchingExposures) {
      const [updatedRow] = await db
        .update(uxExperimentExposuresTable)
        .set({
          converted: true,
          conversionEvent: eventName,
          convertedAt: new Date(),
          conversionValue: conversionValue != null ? String(conversionValue) : null,
          customerId: customerId || undefined,
        })
        .where(eq(uxExperimentExposuresTable.id, exp.exposureId))
        .returning();

      if (updatedRow) updated.push(updatedRow);
    }

    return updated;
  } catch (err) {
    return [];
  }
}

/**
 * Computes analytics and statistical significance for an experiment.
 */
export async function getExperimentAnalytics(experimentId: number) {
  const [experiment] = await db
    .select()
    .from(uxExperimentsTable)
    .where(eq(uxExperimentsTable.id, experimentId))
    .limit(1);

  if (!experiment) return null;

  // Aggregate exposures and conversions by variantId
  const metrics = await db
    .select({
      variantId: uxExperimentExposuresTable.variantId,
      totalExposures: sql<number>`count(*)::int`,
      conversions: sql<number>`count(case when ${uxExperimentExposuresTable.converted} then 1 end)::int`,
      totalValue: sql<string>`coalesce(sum(${uxExperimentExposuresTable.conversionValue}), 0)::text`,
    })
    .from(uxExperimentExposuresTable)
    .where(eq(uxExperimentExposuresTable.experimentId, experimentId))
    .groupBy(uxExperimentExposuresTable.variantId);

  const metricsMap = new Map<string, { exposures: number; conversions: number; value: number }>();
  metrics.forEach((m) => {
    metricsMap.set(m.variantId, {
      exposures: m.totalExposures,
      conversions: m.conversions,
      value: parseFloat(m.totalValue) || 0,
    });
  });

  const variants = (experiment.variants as VariantDefinition[]) || [];
  const controlMetrics = metricsMap.get("control") || { exposures: 0, conversions: 0, value: 0 };
  const controlRate = controlMetrics.exposures > 0
    ? controlMetrics.conversions / controlMetrics.exposures
    : 0;

  const variantResults = variants.map((v) => {
    const data = metricsMap.get(v.id) || { exposures: 0, conversions: 0, value: 0 };
    const rate = data.exposures > 0 ? data.conversions / data.exposures : 0;
    const ratePercent = Number((rate * 100).toFixed(2));

    let upliftPercent = 0;
    let isSignificant = false;
    let confidence = 0;

    if (v.id !== "control" && controlRate > 0 && data.exposures > 30 && controlMetrics.exposures > 30) {
      upliftPercent = Number((((rate - controlRate) / controlRate) * 100).toFixed(2));

      // Two-proportion Z-test
      const pPool = (controlMetrics.conversions + data.conversions) / (controlMetrics.exposures + data.exposures);
      const sePool = Math.sqrt(pPool * (1 - pPool) * (1 / controlMetrics.exposures + 1 / data.exposures));
      if (sePool > 0) {
        const zScore = Math.abs((rate - controlRate) / sePool);
        if (zScore >= 1.96) {
          isSignificant = true;
          confidence = 95;
        } else if (zScore >= 1.645) {
          confidence = 90;
        }
      }
    }

    return {
      variantId: v.id,
      name: v.name,
      weight: v.weight,
      config: v.config,
      exposures: data.exposures,
      conversions: data.conversions,
      conversionRatePercent: ratePercent,
      revenue: data.value,
      upliftPercent,
      isSignificant,
      confidence,
    };
  });

  const totalExposures = variantResults.reduce((acc, v) => acc + v.exposures, 0);
  const totalConversions = variantResults.reduce((acc, v) => acc + v.conversions, 0);

  return {
    experiment,
    summary: {
      totalExposures,
      totalConversions,
      overallConversionRate: totalExposures > 0 ? Number(((totalConversions / totalExposures) * 100).toFixed(2)) : 0,
    },
    variants: variantResults,
  };
}
