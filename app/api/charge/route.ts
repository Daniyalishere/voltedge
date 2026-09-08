import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, newId } from "@/lib/auth";
import { withDb } from "@/lib/db";
import {
  FREE_CHARGE_INTERVAL,
  LOYAL_THRESHOLD,
  freeChargesEarnedFor,
  priceCharge,
  round2,
} from "@/lib/loyalty";
import { sendChargeReceiptEmail } from "@/lib/mailer";
import { buildProfile } from "@/lib/profile";
import { getStation } from "@/lib/stations";
import type { Charge } from "@/lib/types";

const schema = z.object({
  stationId: z.string().min(1),
  kwh: z.coerce.number().positive("Energy must be greater than zero.").max(250, "Maximum 250 kWh per session."),
  useFreeCharge: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { stationId, kwh, useFreeCharge } = parsed.data;
  const station = getStation(stationId);

  if (!station) {
    return NextResponse.json({ error: "Unknown station." }, { status: 404 });
  }
  if (station.status === "offline") {
    return NextResponse.json({ error: `${station.name} is currently offline.` }, { status: 409 });
  }

  const result = await withDb((db) => {
    const user = db.users.find((u) => u.id === current.id);
    if (!user) return null;

    const redeeming = useFreeCharge && user.freeChargesAvailable > 0;
    const pricing = priceCharge(user, kwh, station.ratePerKwh, redeeming);

    const wasLoyal = user.totalCharges >= LOYAL_THRESHOLD;

    const charge: Charge = {
      id: newId("chg"),
      date: new Date().toISOString(),
      stationId: station.id,
      stationName: station.name,
      kwh: round2(kwh),
      ratePerKwh: station.ratePerKwh,
      chargeNumber: user.totalCharges + 1,
      ...pricing,
    };

    // Consume whichever reward was applied.
    if (pricing.freeCharge) {
      user.freeChargesAvailable -= 1;
    } else if (user.welcomeDiscountAvailable) {
      user.welcomeDiscountAvailable = false;
    }

    user.charges.push(charge);
    user.totalCharges += 1;
    user.totalKwh = round2(user.totalKwh + charge.kwh);
    user.totalSpent = round2(user.totalSpent + charge.netAmount);
    user.totalSaved = round2(user.totalSaved + charge.discountAmount);

    // Award any free charges the new total has unlocked. Comparing against the
    // count already earned keeps this idempotent.
    const earned = freeChargesEarnedFor(user.totalCharges);
    const newlyEarned = earned - user.freeChargesEarned;
    if (newlyEarned > 0) {
      user.freeChargesEarned = earned;
      user.freeChargesAvailable += newlyEarned;
    }

    const becameLoyal = !wasLoyal && user.totalCharges >= LOYAL_THRESHOLD;

    return {
      charge,
      becameLoyal,
      freeChargeEarned: newlyEarned > 0,
      profile: buildProfile(user),
      email: user.email,
      name: user.name,
    };
  });

  if (!result) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Best-effort receipt; a mail failure must not fail the charge.
  sendChargeReceiptEmail(result.email, result.name, {
    stationName: result.charge.stationName,
    kwh: result.charge.kwh,
    grossAmount: result.charge.grossAmount,
    discountPercent: result.charge.discountPercent,
    discountAmount: result.charge.discountAmount,
    discountReason: result.charge.discountReason,
    netAmount: result.charge.netAmount,
    chargeNumber: result.charge.chargeNumber,
    freeChargeEarned: result.freeChargeEarned,
    becameLoyal: result.becameLoyal,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    charge: result.charge,
    becameLoyal: result.becameLoyal,
    freeChargeEarned: result.freeChargeEarned,
    milestone: result.becameLoyal
      ? "loyal"
      : result.freeChargeEarned
        ? "free-charge"
        : null,
    nextFreeChargeIn: FREE_CHARGE_INTERVAL - (result.profile.totalCharges % FREE_CHARGE_INTERVAL),
    user: result.profile,
  });
}
