import { db } from "@workspace/db";
import { residentialSocietiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { CoverageValidator } from "./types";
import { cont, halt } from "./types";

export const societyValidator: CoverageValidator = {
  name: "SocietyValidator",

  async validate(state) {
    const societyId = state.request.societyId;
    if (!societyId) {
      return cont(state);
    }

    const [society] = await db
      .select({
        id: residentialSocietiesTable.id,
        name: residentialSocietiesTable.name,
        cityId: residentialSocietiesTable.cityId,
        serviceAreaId: residentialSocietiesTable.serviceAreaId,
        isActive: residentialSocietiesTable.isActive,
      })
      .from(residentialSocietiesTable)
      .where(eq(residentialSocietiesTable.id, societyId))
      .limit(1);

    if (!society) {
      return halt(
        "SOCIETY_NOT_SERVICEABLE",
        "We could not find the specified residential society. Please verify your selection.",
      );
    }

    if (!society.isActive) {
      return halt(
        "SOCIETY_NOT_SERVICEABLE",
        `We do not currently service ${society.name}. Join the waitlist for your society.`,
      );
    }

    // If city is already resolved on state and conflicts with society's city
    if (state.city?.id && state.city.id !== society.cityId) {
      return halt(
        "SOCIETY_NOT_SERVICEABLE",
        `Society ${society.name} is located outside the selected service city.`,
      );
    }

    return cont({
      ...state,
      // If city wasn't resolved yet, request has society's cityId
      request: {
        ...state.request,
        cityId: state.request.cityId ?? society.cityId,
      },
    });
  },
};
