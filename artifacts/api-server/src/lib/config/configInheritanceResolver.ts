/**
 * CITY-006: Hierarchical Configuration Inheritance Resolver
 * Branch Override → City Override → Global Default
 * 
 * Enforces CITY-007: Strict Disabled Service Rule
 * If a service or configuration is disabled at City level, it must never become enabled or bookable via fallback defaults.
 */

import {
  db,
  branchesTable,
  citiesTable,
  catalogSettingsTable,
  operatingHoursTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../logger";

export type ConfigSource = "branch" | "city" | "global" | "default";

export type ResolvedConfigValue<T> = {
  key: string;
  value: T;
  source: ConfigSource;
  branchId?: number;
  cityId?: number;
  isCityDisabled: boolean;
  branchOverride?: unknown;
  cityOverride?: unknown;
  globalSetting?: unknown;
};

export type OperatingHoursResolved = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  openTime: string;
  closeTime: string;
  slotStepMinutes: number;
  maxConcurrentSlots: number;
  source: ConfigSource;
  scopeType: string;
  sourceId?: number;
};

export const DEFAULT_OPERATIONAL_CONFIG: Record<string, unknown> = {
  maxCarsPerCleaner: 25,
  dcmsShiftStartTime: "06:00",
  dcmsShiftEndTime: "10:00",
  geofenceToleranceMeters: 250,
  basementToleranceMeters: 500,
  autoAssignmentEnabled: true,
  cancellationWindowHours: 2,
  washLeadTimeHours: 4,
  dailyRouteOptimizationMode: "tower_parking_cluster",
  requireCustomerSignatureOnCompletion: false,
  waterlessWashDefault: true,
  slotIntervalMinutes: 15,
  maxDailyCapacityPerHub: 200,
};

export type ResolveConfigContext = {
  branchId?: number;
  cityId?: number;
  defaultValue?: unknown;
  allowBranchOverrideIfCityDisabled?: boolean;
};

/**
 * Resolves a specific configuration key by traversing:
 * Branch Override -> City Override -> Global Default -> Hardcoded Default
 */
export async function resolveConfigKey<T = unknown>(
  key: string,
  context: ResolveConfigContext = {},
): Promise<ResolvedConfigValue<T>> {
  let { branchId, cityId, defaultValue, allowBranchOverrideIfCityDisabled = false } = context;

  let branchRow: typeof branchesTable.$inferSelect | null = null;
  let cityRow: typeof citiesTable.$inferSelect | null = null;

  // 1. If branchId provided, look up branch and infer cityId if needed
  if (branchId) {
    const [b] = await db
      .select()
      .from(branchesTable)
      .where(eq(branchesTable.id, branchId))
      .limit(1);
    if (b) {
      branchRow = b;
      if (!cityId && b.cityId) {
        cityId = b.cityId;
      }
    }
  }

  // 2. If cityId provided, look up city
  if (cityId) {
    const [c] = await db
      .select()
      .from(citiesTable)
      .where(eq(citiesTable.id, cityId))
      .limit(1);
    if (c) {
      cityRow = c;
    }
  }

  // Check city prohibition / disable rule (CITY-007)
  const citySettings = (cityRow?.operationalSettings as Record<string, unknown>) ?? {};
  const isCityDisabled =
    cityRow?.isActive === false ||
    citySettings[`${key}_disabled`] === true ||
    (typeof citySettings[key] === "object" &&
      citySettings[key] !== null &&
      (citySettings[key] as any).disabled === true) ||
    (typeof citySettings[key] === "object" &&
      citySettings[key] !== null &&
      (citySettings[key] as any).isActive === false);

  const branchSettings = (branchRow?.customSettings as Record<string, unknown>) ?? {};
  const branchVal = branchSettings[key];
  const cityVal = citySettings[key];

  // Hierarchy check:
  // Level 1: Branch override (if exists and city prohibition does not veto it)
  if (branchVal !== undefined) {
    if (isCityDisabled && !allowBranchOverrideIfCityDisabled) {
      logger.warn(
        { key, branchId, cityId },
        `Branch override ignored because configuration ${key} is explicitly disabled at City level (CITY-007)`,
      );
      return {
        key,
        value: (defaultValue ?? DEFAULT_OPERATIONAL_CONFIG[key] ?? null) as T,
        source: "city",
        branchId,
        cityId,
        isCityDisabled: true,
        branchOverride: branchVal,
        cityOverride: cityVal,
      };
    }

    return {
      key,
      value: branchVal as T,
      source: "branch",
      branchId,
      cityId,
      isCityDisabled,
      branchOverride: branchVal,
      cityOverride: cityVal,
    };
  }

  // Level 2: City override
  if (cityVal !== undefined) {
    return {
      key,
      value: cityVal as T,
      source: "city",
      branchId,
      cityId,
      isCityDisabled,
      cityOverride: cityVal,
    };
  }

  // If city is disabled and no override, fail-closed
  if (isCityDisabled) {
    return {
      key,
      value: (defaultValue ?? null) as T,
      source: "city",
      branchId,
      cityId,
      isCityDisabled: true,
    };
  }

  // Level 3: Global catalogSettingsTable
  try {
    const [globalSetting] = await db
      .select()
      .from(catalogSettingsTable)
      .where(eq(catalogSettingsTable.key, key))
      .limit(1);

    if (globalSetting && globalSetting.value !== undefined) {
      return {
        key,
        value: globalSetting.value as T,
        source: "global",
        branchId,
        cityId,
        isCityDisabled: false,
        globalSetting: globalSetting.value,
      };
    }
  } catch (err) {
    // If table doesn't exist or query fails, fall through to default
  }

  // Level 4: Hardcoded system default
  const fallbackVal = (defaultValue !== undefined
    ? defaultValue
    : DEFAULT_OPERATIONAL_CONFIG[key]) as T;

  return {
    key,
    value: fallbackVal,
    source: "default",
    branchId,
    cityId,
    isCityDisabled: false,
  };
}

/**
 * Resolves the full dictionary of operational settings for a branch:
 * Merges System Defaults <- City operationalSettings <- Branch customSettings
 */
export async function resolveBranchOperationalSettings(branchId: number): Promise<{
  branchId: number;
  branchName: string;
  cityId: number | null;
  cityName: string | null;
  settings: Record<string, unknown>;
  sources: Record<string, ConfigSource>;
  disabledKeys: string[];
}> {
  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.id, branchId))
    .limit(1);

  if (!branch) {
    throw new Error(`Branch ${branchId} not found`);
  }

  let cityRow: typeof citiesTable.$inferSelect | null = null;
  if (branch.cityId) {
    const [c] = await db
      .select()
      .from(citiesTable)
      .where(eq(citiesTable.id, branch.cityId))
      .limit(1);
    cityRow = c ?? null;
  }

  const merged: Record<string, unknown> = { ...DEFAULT_OPERATIONAL_CONFIG };
  const sources: Record<string, ConfigSource> = {};
  for (const k of Object.keys(DEFAULT_OPERATIONAL_CONFIG)) {
    sources[k] = "default";
  }

  // Pull global settings if any
  try {
    const globals = await db.select().from(catalogSettingsTable);
    for (const g of globals) {
      merged[g.key] = g.value;
      sources[g.key] = "global";
    }
  } catch {
    // Table read error fallback
  }

  const disabledKeys: string[] = [];

  // Apply City overrides
  if (cityRow && cityRow.operationalSettings) {
    const cityOps = cityRow.operationalSettings as Record<string, unknown>;
    for (const [k, v] of Object.entries(cityOps)) {
      if (k.endsWith("_disabled") && v === true) {
        disabledKeys.push(k.replace(/_disabled$/, ""));
      } else {
        merged[k] = v;
        sources[k] = "city";
      }
    }
  }

  // Apply Branch overrides
  if (branch.customSettings) {
    const branchOps = branch.customSettings as Record<string, unknown>;
    for (const [k, v] of Object.entries(branchOps)) {
      // If city disabled this key, branch override is suppressed per CITY-007
      if (!disabledKeys.includes(k)) {
        merged[k] = v;
        sources[k] = "branch";
      }
    }
  }

  return {
    branchId: branch.id,
    branchName: branch.name,
    cityId: branch.cityId ?? null,
    cityName: cityRow?.name ?? null,
    settings: merged,
    sources,
    disabledKeys,
  };
}

/**
 * Resolves operating hours for a specific day of week (0=Sun, ..., 6=Sat)
 * checking Branch -> City -> Global hierarchy in operatingHoursTable.
 */
export async function resolveOperatingHours(context: {
  branchId?: number;
  cityId?: number;
  dayOfWeek: number;
}): Promise<OperatingHoursResolved> {
  const { branchId, cityId, dayOfWeek } = context;

  // 1. Branch-scoped operating hours
  if (branchId) {
    const [branchHours] = await db
      .select()
      .from(operatingHoursTable)
      .where(
        and(
          eq(operatingHoursTable.scopeType, "branch"),
          eq(operatingHoursTable.branchId, branchId),
          eq(operatingHoursTable.dayOfWeek, dayOfWeek),
        ),
      )
      .limit(1);

    if (branchHours) {
      return {
        dayOfWeek,
        isWorkingDay: branchHours.isWorkingDay,
        openTime: branchHours.openTime,
        closeTime: branchHours.closeTime,
        slotStepMinutes: branchHours.slotStepMinutes,
        maxConcurrentSlots: branchHours.maxConcurrentSlots,
        source: "branch",
        scopeType: "branch",
        sourceId: branchHours.id,
      };
    }
  }

  // 2. City-scoped operating hours
  let effectiveCityId = cityId;
  if (!effectiveCityId && branchId) {
    const [b] = await db
      .select({ cityId: branchesTable.cityId })
      .from(branchesTable)
      .where(eq(branchesTable.id, branchId))
      .limit(1);
    if (b?.cityId) effectiveCityId = b.cityId;
  }

  if (effectiveCityId) {
    const [cityHours] = await db
      .select()
      .from(operatingHoursTable)
      .where(
        and(
          eq(operatingHoursTable.scopeType, "city"),
          eq(operatingHoursTable.cityId, effectiveCityId),
          eq(operatingHoursTable.dayOfWeek, dayOfWeek),
        ),
      )
      .limit(1);

    if (cityHours) {
      return {
        dayOfWeek,
        isWorkingDay: cityHours.isWorkingDay,
        openTime: cityHours.openTime,
        closeTime: cityHours.closeTime,
        slotStepMinutes: cityHours.slotStepMinutes,
        maxConcurrentSlots: cityHours.maxConcurrentSlots,
        source: "city",
        scopeType: "city",
        sourceId: cityHours.id,
      };
    }
  }

  // 3. Global operating hours
  const [globalHours] = await db
    .select()
    .from(operatingHoursTable)
    .where(
      and(
        eq(operatingHoursTable.scopeType, "global"),
        eq(operatingHoursTable.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);

  if (globalHours) {
    return {
      dayOfWeek,
      isWorkingDay: globalHours.isWorkingDay,
      openTime: globalHours.openTime,
      closeTime: globalHours.closeTime,
      slotStepMinutes: globalHours.slotStepMinutes,
      maxConcurrentSlots: globalHours.maxConcurrentSlots,
      source: "global",
      scopeType: "global",
      sourceId: globalHours.id,
    };
  }

  // 4. Default fallback: Open Mon-Sat 08:00 - 18:00, Sun closed
  const isDefaultWorkingDay = dayOfWeek !== 0;
  return {
    dayOfWeek,
    isWorkingDay: isDefaultWorkingDay,
    openTime: "08:00",
    closeTime: "18:00",
    slotStepMinutes: 15,
    maxConcurrentSlots: 8,
    source: "default",
    scopeType: "default",
  };
}
