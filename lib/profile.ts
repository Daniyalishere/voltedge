import {
  FREE_CHARGE_INTERVAL,
  LOYAL_THRESHOLD,
  chargesUntilFreeCharge,
  chargesUntilLoyal,
  tierOf,
} from "./loyalty";
import type { Charge, Tier, User } from "./types";

export interface Profile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  tier: Tier;
  totalCharges: number;
  totalKwh: number;
  totalSpent: number;
  totalSaved: number;
  freeChargesAvailable: number;
  welcomeDiscountAvailable: boolean;
  /** Discount that will apply to the next paid charge, as a percentage. */
  nextDiscountPercent: number;
  chargesUntilLoyal: number;
  chargesUntilFreeCharge: number;
  loyalProgress: number;
  freeChargeProgress: number;
  charges: Charge[];
}

/**
 * Projects a stored user into the shape the UI consumes, deriving all
 * loyalty-programme figures so the client never recomputes them.
 */
export function buildProfile(user: User): Profile {
  const tier = tierOf(user);

  const nextDiscountPercent = user.welcomeDiscountAvailable
    ? 10
    : user.totalCharges >= LOYAL_THRESHOLD
      ? 5
      : 0;

  const sinceLastReward = user.totalCharges % FREE_CHARGE_INTERVAL;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    loginCount: user.loginCount,
    tier,
    totalCharges: user.totalCharges,
    totalKwh: user.totalKwh,
    totalSpent: user.totalSpent,
    totalSaved: user.totalSaved,
    freeChargesAvailable: user.freeChargesAvailable,
    welcomeDiscountAvailable: user.welcomeDiscountAvailable,
    nextDiscountPercent,
    chargesUntilLoyal: chargesUntilLoyal(user.totalCharges),
    chargesUntilFreeCharge: chargesUntilFreeCharge(user.totalCharges),
    loyalProgress: Math.min(100, (user.totalCharges / LOYAL_THRESHOLD) * 100),
    freeChargeProgress: (sinceLastReward / FREE_CHARGE_INTERVAL) * 100,
    // Newest first for display.
    charges: [...user.charges].sort((a, b) => b.chargeNumber - a.chargeNumber),
  };
}
