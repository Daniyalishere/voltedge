/**
 * Shared domain types for the VoltEdge EV charging platform.
 */

export type Tier = "new" | "standard" | "loyal";

export interface Charge {
  id: string;
  /** ISO timestamp of when the charge completed. */
  date: string;
  stationId: string;
  stationName: string;
  /** Energy delivered, kWh. */
  kwh: number;
  /** Price per kWh at time of charge, in currency units. */
  ratePerKwh: number;
  /** Cost before any discount. */
  grossAmount: number;
  /** Percentage discount applied (0, 5 or 10). */
  discountPercent: number;
  /** Absolute currency amount saved by the discount. */
  discountAmount: number;
  /** What earned the discount, for display in the receipt. */
  discountReason: string;
  /** Final amount charged to the user. */
  netAmount: number;
  /** True when this charge was covered by a free-charge reward. */
  freeCharge: boolean;
  /** Charge sequence number for this user, starting at 1. */
  chargeNumber: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  /** Total completed charges. Drives tier and reward thresholds. */
  totalCharges: number;
  totalKwh: number;
  totalSpent: number;
  totalSaved: number;
  /** Unused free charges available to redeem. */
  freeChargesAvailable: number;
  /** Free charges granted so far, used to avoid granting the same reward twice. */
  freeChargesEarned: number;
  /** True until the welcome 10% discount is consumed by the first charge. */
  welcomeDiscountAvailable: boolean;
  charges: Charge[];
}

export interface LoginCode {
  email: string;
  /** SHA-256 hash of the 6-digit code; the plain code is never stored. */
  codeHash: string;
  expiresAt: string;
  attempts: number;
}

export interface Session {
  token: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface Station {
  id: string;
  name: string;
  location: string;
  connector: string;
  /** Max power in kW. */
  powerKw: number;
  ratePerKwh: number;
  status: "available" | "busy" | "offline";
}

export interface Database {
  users: User[];
  loginCodes: LoginCode[];
  sessions: Session[];
}
