"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import type { Profile } from "@/lib/profile";
import type { Charge, Station } from "@/lib/types";
import { ChargePanel } from "../ChargePanel";
import { MilestoneToast, type Milestone } from "../MilestoneToast";
import { money } from "../DashboardView";

/**
 * Charging screen shown after the driver arrives at a station via the map.
 * The station is pre-selected and locked, since they are physically there.
 */
export function ArrivedCharge({
  profile: initialProfile,
  station,
}: {
  profile: Profile;
  station: Station;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [lastCharge, setLastCharge] = useState<Charge | null>(null);

  function handleCharged(
    next: Profile,
    result: { becameLoyal: boolean; freeChargeEarned: boolean; charge: Charge }
  ) {
    setProfile(next);
    setLastCharge(result.charge);
    if (result.becameLoyal) setMilestone({ kind: "loyal" });
    else if (result.freeChargeEarned) setMilestone({ kind: "free-charge" });
    else setMilestone({ kind: "charged", charge: result.charge });
    router.refresh();
  }

  return (
    <main className="flex-1">
      <MilestoneToast milestone={milestone} onDismiss={() => setMilestone(null)} />

      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" aria-label="VoltEdge dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/map" className="btn-ghost">
              Back to map
            </Link>
            <Link href="/dashboard" className="btn-ghost">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        {/* Arrival banner */}
        <div className="rise glass sheen rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-volt-500/25 bg-volt-500/10 px-3 py-1 text-xs font-medium text-volt-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-volt-400" />
                </span>
                Arrived - connector ready
              </span>

              <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                {station.name}
              </h1>
              <p className="mt-1.5 text-mist-500">{station.location}</p>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <Spec label="Power" value={`${station.powerKw} kW`} />
              <Spec label="Connector" value={station.connector} />
              <Spec label="Rate" value={`PKR ${station.ratePerKwh}`} sub="per kWh" />
            </dl>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          <div className="rise lg:col-span-2">
            <ChargePanel
              profile={profile}
              stations={[station]}
              lockedStationId={station.id}
              onCharged={handleCharged}
            />
          </div>

          <div className="rise lg:col-span-3 space-y-5">
            {lastCharge ? (
              <Receipt charge={lastCharge} />
            ) : (
              <div className="glass flex h-full flex-col justify-center rounded-2xl p-8 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-volt-500/12 text-volt-400">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H10l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12l1-7.5Z" />
                  </svg>
                </span>
                <h2 className="mt-4 font-medium text-mist-100">Ready when you are</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-500">
                  Choose how much energy you need and start the session. Your discount is
                  applied automatically and a receipt is emailed when you finish.
                </p>
              </div>
            )}

            <RewardsSummary profile={profile} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Spec({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-ink-950/50 px-3 py-2.5 text-center">
      <dt className="text-[0.6rem] uppercase tracking-wider text-mist-600">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-mist-100">{value}</dd>
      {sub && <dd className="text-[0.6rem] text-mist-600">{sub}</dd>}
    </div>
  );
}

function Receipt({ charge }: { charge: Charge }) {
  return (
    <div className="glass sheen rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-mist-100">Session receipt</h2>
        <span className="text-xs text-mist-600">Charge #{charge.chargeNumber}</span>
      </div>

      <div className="mt-5 space-y-2">
        <Line k="Energy delivered" v={`${charge.kwh.toFixed(2)} kWh`} />
        <Line k="Rate" v={`PKR ${charge.ratePerKwh.toFixed(2)} / kWh`} />
        <Line k="Subtotal" v={money(charge.grossAmount)} />
        {charge.discountAmount > 0 && (
          <Line k={charge.discountReason} v={`- ${money(charge.discountAmount)}`} accent />
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-white/8 pt-4">
        <span className="font-medium text-mist-100">Total paid</span>
        <span className="tabular text-2xl font-semibold text-mist-100">
          {charge.netAmount === 0 ? "FREE" : money(charge.netAmount)}
        </span>
      </div>

      <p className="mt-4 text-xs text-mist-600">
        A copy of this receipt has been emailed to you.
      </p>
    </div>
  );
}

function Line({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm ${accent ? "text-volt-400" : "text-mist-500"}`}>{k}</span>
      <span className={`tabular text-sm ${accent ? "font-medium text-volt-400" : "text-mist-300"}`}>
        {v}
      </span>
    </div>
  );
}

function RewardsSummary({ profile }: { profile: Profile }) {
  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="font-medium text-mist-100">Your rewards</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell label="Charges" value={String(profile.totalCharges)} />
        <Cell label="Tier" value={profile.tier === "loyal" ? "Loyal" : profile.tier === "new" ? "New" : "Member"} />
        <Cell
          label="Next discount"
          value={profile.nextDiscountPercent > 0 ? `${profile.nextDiscountPercent}%` : "None"}
          accent={profile.nextDiscountPercent > 0}
        />
        <Cell label="Free charges" value={String(profile.freeChargesAvailable)} accent={profile.freeChargesAvailable > 0} />
      </dl>
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-ink-950/50 px-3 py-3 text-center">
      <dt className="text-[0.6rem] uppercase tracking-wider text-mist-600">{label}</dt>
      <dd className={`tabular mt-1 text-lg font-semibold ${accent ? "text-volt-400" : "text-mist-100"}`}>
        {value}
      </dd>
    </div>
  );
}
