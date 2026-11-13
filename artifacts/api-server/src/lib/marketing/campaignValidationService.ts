import { db } from "@workspace/db";
import {
  marketingCampaignsTable,
  marketingEventsTable,
  type MarketingCampaign,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export interface ValidateCouponOptions {
  code: string;
  orderAmount: number;
  cityId?: number | null;
  branchId?: number | null;
  customerId?: number | null;
  serviceId?: number | null;
  packageId?: string | null;
  vehicleCategory?: string | null;
}

export interface CouponValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  campaign?: MarketingCampaign;
  discountAmount: number;
  finalPayable: number;
  discountPercentage?: number;
}

/**
 * Authoritative Backend Coupon & Campaign Discount Validation
 * Rejects client-side tampering, validates usage limits, temporal validity,
 * and service/vehicle applicability.
 */
export async function validateCouponAndCalculateDiscount(
  options: ValidateCouponOptions
): Promise<CouponValidationResult> {
  const {
    code,
    orderAmount,
    cityId,
    branchId,
    customerId,
    serviceId,
    packageId,
    vehicleCategory,
  } = options;

  if (!code || typeof code !== "string" || !code.trim()) {
    return {
      isValid: false,
      errorCode: "INVALID_COUPON_CODE",
      errorMessage: "Coupon code is required",
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  const normalizedCode = code.trim().toUpperCase();

  const [campaign] = await db
    .select()
    .from(marketingCampaignsTable)
    .where(eq(marketingCampaignsTable.code, normalizedCode))
    .limit(1);

  if (!campaign) {
    return {
      isValid: false,
      errorCode: "COUPON_NOT_FOUND",
      errorMessage: `Coupon "${normalizedCode}" is invalid or does not exist`,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  // 1. Check active status
  if (!campaign.isActive || campaign.status !== "active") {
    return {
      isValid: false,
      errorCode: "COUPON_INACTIVE",
      errorMessage: `Coupon "${normalizedCode}" is currently inactive`,
      campaign,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  // 2. Check temporal validity (start/end dates)
  const now = new Date();
  if (campaign.startDate && campaign.startDate > now) {
    return {
      isValid: false,
      errorCode: "COUPON_NOT_YET_VALID",
      errorMessage: `Coupon "${normalizedCode}" is not active yet`,
      campaign,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  if (campaign.endDate && campaign.endDate < now) {
    return {
      isValid: false,
      errorCode: "COUPON_EXPIRED",
      errorMessage: `Coupon "${normalizedCode}" has expired`,
      campaign,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  // 3. Check city scope
  if (campaign.cityId != null && cityId != null && campaign.cityId !== cityId) {
    return {
      isValid: false,
      errorCode: "COUPON_CITY_RESTRICTED",
      errorMessage: `This coupon is not valid in the selected city`,
      campaign,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  // 4. Check branch scope
  if (campaign.branchId != null && branchId != null && campaign.branchId !== branchId) {
    return {
      isValid: false,
      errorCode: "COUPON_BRANCH_RESTRICTED",
      errorMessage: `This coupon is not valid for the selected branch`,
      campaign,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  // 5. Check minimum order amount
  const minOrder = campaign.minOrderAmount ? Number(campaign.minOrderAmount) : 0;
  if (orderAmount < minOrder) {
    return {
      isValid: false,
      errorCode: "MIN_ORDER_AMOUNT_NOT_MET",
      errorMessage: `Minimum order amount of ₹${minOrder} required to apply this coupon`,
      campaign,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  // 6. Check total usage limit
  if (campaign.usageLimit != null && campaign.usedCount >= campaign.usageLimit) {
    return {
      isValid: false,
      errorCode: "COUPON_USAGE_LIMIT_EXCEEDED",
      errorMessage: `Coupon "${normalizedCode}" has reached its maximum redemptions`,
      campaign,
      discountAmount: 0,
      finalPayable: orderAmount,
    };
  }

  // 7. Check service applicability
  const applicableServiceIds = campaign.applicableServiceIds || [];
  if (applicableServiceIds.length > 0) {
    if (!serviceId || !applicableServiceIds.includes(serviceId)) {
      return {
        isValid: false,
        errorCode: "SERVICE_NOT_ELIGIBLE",
        errorMessage: `Coupon "${normalizedCode}" is not applicable for this service`,
        campaign,
        discountAmount: 0,
        finalPayable: orderAmount,
      };
    }
  }

  // 8. Check package applicability
  const applicablePackageIds = campaign.applicablePackageIds || [];
  if (applicablePackageIds.length > 0) {
    if (!packageId || !applicablePackageIds.includes(packageId)) {
      return {
        isValid: false,
        errorCode: "PACKAGE_NOT_ELIGIBLE",
        errorMessage: `Coupon "${normalizedCode}" is not applicable for this package`,
        campaign,
        discountAmount: 0,
        finalPayable: orderAmount,
      };
    }
  }

  // 9. Check vehicle category applicability
  const applicableVehicleCategories = campaign.applicableVehicleCategories || [];
  if (applicableVehicleCategories.length > 0) {
    if (!vehicleCategory || !applicableVehicleCategories.includes(vehicleCategory.toLowerCase())) {
      return {
        isValid: false,
        errorCode: "VEHICLE_CATEGORY_NOT_ELIGIBLE",
        errorMessage: `Coupon "${normalizedCode}" is not applicable for this vehicle category`,
        campaign,
        discountAmount: 0,
        finalPayable: orderAmount,
      };
    }
  }

  // 10. Calculate authoritative discount
  const rawDiscountValue = Number(campaign.discountValue) || 0;
  let calculatedDiscount = 0;
  let discountPercentage: number | undefined;

  if (campaign.offerType === "percentage_discount") {
    discountPercentage = rawDiscountValue;
    calculatedDiscount = (orderAmount * rawDiscountValue) / 100;
  } else if (campaign.offerType === "flat_discount") {
    calculatedDiscount = rawDiscountValue;
  } else if (campaign.offerType === "fixed_price") {
    calculatedDiscount = Math.max(0, orderAmount - rawDiscountValue);
  }

  // Apply max discount cap if specified
  if (campaign.maxDiscountAmount != null) {
    const maxDiscount = Number(campaign.maxDiscountAmount);
    if (calculatedDiscount > maxDiscount) {
      calculatedDiscount = maxDiscount;
    }
  }

  // Cap at orderAmount (discount cannot make order negative)
  calculatedDiscount = Math.min(orderAmount, calculatedDiscount);
  // Round safely to 2 decimal places
  calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;

  const finalPayable = Math.max(0, Math.round((orderAmount - calculatedDiscount) * 100) / 100);

  return {
    isValid: true,
    campaign,
    discountAmount: calculatedDiscount,
    finalPayable,
    discountPercentage,
  };
}

/**
 * Records coupon usage atomically and tracks campaign conversion event
 */
export async function recordCampaignUsage(options: {
  campaignId: number;
  customerId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  orderId?: string | null;
  conversionValue?: number | null;
}) {
  const { campaignId, customerId, cityId, branchId, orderId, conversionValue } = options;

  // Increment usage count on campaign
  await db
    .update(marketingCampaignsTable)
    .set({
      usedCount: sql`${marketingCampaignsTable.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(marketingCampaignsTable.id, campaignId));

  // Log conversion event
  await db.insert(marketingEventsTable).values({
    eventType: "campaign_conversion",
    campaignId,
    customerId: customerId || null,
    cityId: cityId || null,
    branchId: branchId || null,
    orderId: orderId || null,
    conversionValue: conversionValue != null ? String(conversionValue) : null,
  });
}
