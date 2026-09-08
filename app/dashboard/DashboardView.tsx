"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import type { Profile } from "@/lib/profile";
import type { Charge, Station } from "@/lib/types";
import { ChargePanel } from "./ChargePanel";
import { MilestoneToast, type Milestone } from "./MilestoneToast";

const LOYAL_THRESHOLD = 20;
const FREE_CHARGE_INTERVAL = 30;

export function DashboardView({
  initialProfile,
  stations,
  showWelcome,
}: {
  initialProfile: Profile;
  stations: Station[];
  showWelcome: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [milestone, setMilestone] = useState<Milestone | null>(
    showWelcome ? { kind: "welcome" } : null
  );
  const [signingOut, setSigningOut] = useState(false);

  const firstName = useMemo(() => profile.name.split(" ")[0], [profile.name]);

  function handleCharged(next: Profile, result: { becameLoyal: boolean; freeChargeEarned: boolean; charge: Charge }) {
    setProfile(next);
    if (result.becameLoyal) setMilestone({ kind: "loyal" });
    else if (result.freeChargeEarned) setMilestone({ kind: "free-charge" });
    else setMilestone({ kind: "charged", charge: result.charge });
  }

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex-1">
      <MilestoneToast milestone={milestone} onDismiss={() => setMilestone(null)} />

      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-mist-100">{profile.name}</p>
              <p className="text-xs text-mist-600">{profile.email}</p>
            </div>
            <TierBadge tier={profile.tier} />
            <button
              onClick={signOut}
              disabled={signingOut}
              className="btn-ghost !px-3 !py-2"
              aria-label="Sign out"
            >
              {signingOut ? "…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* ---------- Greeting ---------- */}
        <div className="rise">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, <span className="text-gradient">{firstName}</span>
          </h1>
          <p className="mt-2.5 text-mist-500">
            {profile.nextDiscountPercent > 0 ? (
              <>
                Your next charge has{" "}
                <span className="font-medium text-volt-400">
                  {profile.nextDiscountPercent}% off
                </span>{" "}
                automatically applied.
              </>
            ) : profile.chargesUntilLoyal > 0 ? (
              <>
                {profile.chargesUntilLoyal} more charge
                {profile.chargesUntilLoyal === 1 ? "" : "s"} until you unlock 5% off forever.
              </>
            ) : (
              <>You&apos;re all set - start a charging session below.</>
            )}
          </p>
        </div>

        {/* ---------- Find a station ---------- */}
        <Link
          href="/dashboard/map"
          className="glass glass-hover sheen rise mt-8 flex flex-wrap items-center gap-5 rounded-2xl p-6"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-volt-500/12 text-volt-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
                stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-mist-100">Find your nearest station</h2>
            <p className="mt-1 text-sm leading-relaxed text-mist-500">
              Drop a pin on the Karachi map and we&apos;ll compute the shortest route with
              Dijkstra, route around closed stations with BFS, and list alternatives with DFS.
            </p>
          </div>
          <span className="btn-primary shrink-0">
            Open map
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </span>
        </Link>

        {/* ---------- Stats ---------- */}
        <section className="rise mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total charges"
            value={String(profile.totalCharges)}
            hint={
              profile.chargesUntilLoyal > 0
                ? `${profile.chargesUntilLoyal} to Loyal status`
                : "Loyal member"
            }
          />
          <StatCard
            label="Energy delivered"
            value={profile.totalKwh.toFixed(1)}
            unit="kWh"
            hint="Across all sessions"
          />
          <StatCard
            label="Total spent"
            value={money(profile.totalSpent)}
            hint="After discounts"
          />
          <StatCard
            label="Total saved"
            value={money(profile.totalSaved)}
            hint="Thanks to rewards"
            accent
          />
        </section>

        {/* ---------- Rewards progress ---------- */}
        <section className="rise mt-5 grid gap-4 lg:grid-cols-2">
          <ProgressCard
            title="Loyal customer status"
            caption={
              profile.tier === "loyal"
                ? "Unlocked - 5% off every charge"
                : `${profile.chargesUntilLoyal} charge${profile.chargesUntilLoyal === 1 ? "" : "s"} to go`
            }
            current={Math.min(profile.totalCharges, LOYAL_THRESHOLD)}
            total={LOYAL_THRESHOLD}
            percent={profile.loyalProgress}
            done={profile.tier === "loyal"}
          />
          <ProgressCard
            title="Next free charge"
            caption={
              profile.freeChargesAvailable > 0
                ? `${profile.freeChargesAvailable} free charge${profile.freeChargesAvailable === 1 ? "" : "s"} ready to redeem`
                : `${profile.chargesUntilFreeCharge} charge${profile.chargesUntilFreeCharge === 1 ? "" : "s"} to go`
            }
            current={profile.totalCharges % FREE_CHARGE_INTERVAL}
            total={FREE_CHARGE_INTERVAL}
            percent={profile.freeChargeProgress}
            done={profile.freeChargesAvailable > 0}
          />
        </section>

        {/* ---------- Charge + history ---------- */}
        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          <div className="rise lg:col-span-2">
            <ChargePanel profile={profile} stations={stations} onCharged={handleCharged} />
          </div>
          <div className="rise lg:col-span-3">
            <HistoryPanel charges={profile.charges} />
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function TierBadge({ tier }: { tier: Profile["tier"] }) {
  const map = {
    new: { label: "New member", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
    standard: { label: "Member", cls: "border-white/12 bg-white/5 text-mist-300" },
    loyal: { label: "Loyal", cls: "border-volt-500/35 bg-volt-500/12 text-volt-400" },
  }[tier];

  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${map.cls}`}>
      {map.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="glass glass-hover rounded-2xl p-6">
      <p className="text-xs uppercase tracking-wider text-mist-600">{label}</p>
      <p
        className={`tabular mt-3 text-3xl font-semibold tracking-tight ${accent ? "text-volt-400" : "text-mist-100"}`}
      >
        {value}
        {unit && <span className="ml-1 text-base font-normal text-mist-600">{unit}</span>}
      </p>
      <p className="mt-1.5 text-xs text-mist-600">{hint}</p>
    </div>
  );
}

function ProgressCard({
  title,
  caption,
  current,
  total,
  percent,
  done,
}: {
  title: string;
  caption: string;
  current: number;
  total: number;
  percent: number;
  done: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-medium text-mist-100">{title}</h3>
        <span className="tabular shrink-0 text-sm text-mist-500">
          {current} / {total}
        </span>
      </div>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-white/6"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            done
              ? "bg-gradient-to-r from-volt-400 to-volt-600"
              : "bg-gradient-to-r from-volt-500/70 to-volt-400"
          }`}
          style={{ width: `${Math.max(percent, percent > 0 ? 3 : 0)}%` }}
        />
      </div>

      <p className={`mt-3 text-sm ${done ? "text-volt-400" : "text-mist-500"}`}>{caption}</p>
    </div>
  );
}

function HistoryPanel({ charges }: { charges: Charge[] }) {
  return (
    <div className="glass flex h-full flex-col rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-mist-100">Charge history</h2>
        <span className="text-xs text-mist-600">
          {charges.length} session{charges.length === 1 ? "" : "s"}
        </span>
      </div>

      {charges.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-mist-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H10l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12l1-7.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="mt-4 text-sm text-mist-500">No charges yet.</p>
          <p className="mt-1 text-xs text-mist-600">
            Start a session to claim your 10% welcome discount.
          </p>
        </div>
      ) : (
        <ul className="mt-5 max-h-[30rem] space-y-2.5 overflow-y-auto pr-1">
          {charges.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-white/8 bg-white/[0.025] p-4 transition-colors hover:border-white/14"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-mist-100">{c.stationName}</p>
                  <p className="mt-0.5 text-xs text-mist-600">
                    #{c.chargeNumber} · {formatDate(c.date)} · {c.kwh.toFixed(2)} kWh
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-mist-100">
                    {c.netAmount === 0 ? "FREE" : money(c.netAmount)}
                  </p>
                  {c.discountAmount > 0 && (
                    <p className="tabular text-xs text-mist-600 line-through">
                      {money(c.grossAmount)}
                    </p>
                  )}
                </div>
              </div>

              {c.discountPercent > 0 && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-volt-500/25 bg-volt-500/10 px-2.5 py-1 text-[0.7rem] font-medium text-volt-400">
                  {c.freeCharge ? "Free charge reward" : `${c.discountPercent}% off`}
                  <span className="text-volt-400/60">· saved {money(c.discountAmount)}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function money(n: number): string {
  return `PKR ${n.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
