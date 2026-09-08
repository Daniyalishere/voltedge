import type { Tier, User } from "./types";

/**
 * Loyalty programme rules
 * ------------------------------------------------------------------
 *  - A brand-new user gets 10% off, applied to their first charge.
 *  - From charge 21 onward (i.e. once 20 charges are complete) the user is
 *    "loyal" and gets 5% off every charge.
 *  - Every 30 completed charges grants 1 free charge, which the user can
 *    redeem on a later session.
 * ------------------------------------------------------------------
 */
export const LOYAL_THRESHOLD = 20;
export const FREE_CHARGE_INTERVAL = 30;
export const WELCOME_DISCOUNT = 10;
export const LOYAL_DISCOUNT = 5;

export function tierOf(user: Pick<User, "totalCharges" | "welcomeDiscountAvailable">): Tier {
  if (user.totalCharges >= LOYAL_THRESHOLD) return "loyal";
  if (user.welcomeDiscountAvailable) return "new";
  return "standard";
}

export interface Pricing {
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
  discountReason: string;
  netAmount: number;
  freeCharge: boolean;
}

/**
 * Computes what a charge of `kwh` at `ratePerKwh` costs this user right now.
 *
 * `useFreeCharge` redeems a banked free charge, which zeroes the bill and
 * takes precedence over percentage discounts (the welcome 10% is preserved
 * for a later charge rather than being burned on a free one).
 */
export function priceCharge(
  user: Pick<User, "totalCharges" | "welcomeDiscountAvailable" | "freeChargesAvailable">,
  kwh: number,
  ratePerKwh: number,
  useFreeCharge: boolean
): Pricing {
  const grossAmount = round2(kwh * ratePerKwh);

  if (useFreeCharge && user.freeChargesAvailable > 0) {
    return {
      grossAmount,
      discountPercent: 100,
      discountAmount: grossAmount,
      discountReason: "Free charge reward redeemed",
      netAmount: 0,
      freeCharge: true,
    };
  }

  // The welcome discount is the larger of the two, so it wins when both apply.
  let discountPercent = 0;
  let discountReason = "No discount applied";

  if (user.welcomeDiscountAvailable) {
    discountPercent = WELCOME_DISCOUNT;
    discountReason = "10% welcome discount - first charge";
  } else if (user.totalCharges >= LOYAL_THRESHOLD) {
    discountPercent = LOYAL_DISCOUNT;
    discountReason = "5% loyal customer discount";
  }

  const discountAmount = round2((grossAmount * discountPercent) / 100);

  return {
    grossAmount,
    discountPercent,
    discountAmount,
    discountReason,
    netAmount: round2(grossAmount - discountAmount),
    freeCharge: false,
  };
}

/**
 * How many free charges a user with `totalCharges` completed charges should
 * have been granted in total. Used to award rewards idempotently.
 */
export function freeChargesEarnedFor(totalCharges: number): number {
  return Math.floor(totalCharges / FREE_CHARGE_INTERVAL);
}

export function chargesUntilLoyal(totalCharges: number): number {
  return Math.max(0, LOYAL_THRESHOLD - totalCharges);
}

export function chargesUntilFreeCharge(totalCharges: number): number {
  const next = (Math.floor(totalCharges / FREE_CHARGE_INTERVAL) + 1) * FREE_CHARGE_INTERVAL;
  return next - totalCharges;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
