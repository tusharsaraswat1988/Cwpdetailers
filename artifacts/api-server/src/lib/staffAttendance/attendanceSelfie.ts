const DAILY_CAR_CLEANER_SLUG = "daily_car_cleaner";

export class AttendanceSelfieError extends Error {
  constructor(
    message: string,
    public code: "SELFIE_REQUIRED" | "INVALID_SELFIE",
  ) {
    super(message);
    this.name = "AttendanceSelfieError";
  }
}

/** Staff whose only operational role is daily car cleaning — no shift check-in. */
export function isDailyCleanOnlyStaff(roleSlugs: readonly string[]): boolean {
  const slugs = [...new Set(roleSlugs.filter(Boolean))];
  return slugs.length > 0 && slugs.every(s => s === DAILY_CAR_CLEANER_SLUG);
}

/** Staff marking their own present/late check-in must send a live selfie. Admin marks stay optional. */
export function isSelfCheckIn(input: {
  actorRole?: string | null;
  actorStaffId?: number | null;
  targetStaffId: number;
  status: string;
}): boolean {
  return input.actorRole === "staff"
    && input.actorStaffId === input.targetStaffId
    && (input.status === "present" || input.status === "late");
}

/** Selfie + GPS required for field staff self check-in, except daily-clean-only staff. */
export function selfCheckInProofRequired(input: {
  actorRole?: string | null;
  actorStaffId?: number | null;
  targetStaffId: number;
  status: string;
  roleSlugs: readonly string[];
}): boolean {
  return isSelfCheckIn(input) && !isDailyCleanOnlyStaff(input.roleSlugs);
}

export function assertSelfCheckInSelfie(imageBase64: unknown): string {
  if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
    throw new AttendanceSelfieError(
      "Selfie photo is required to mark attendance. Use the front camera.",
      "SELFIE_REQUIRED",
    );
  }
  return imageBase64;
}
