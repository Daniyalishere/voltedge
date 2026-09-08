"use client";

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/profile";
import type { Charge, Station } from "@/lib/types";
import { money } from "./DashboardView";

type Phase = "idle" | "charging" | "done";

export function ChargePanel({
  profile,
  stations,
  lockedStationId,
  onCharged,
}: {
  profile: Profile;
  stations: Station[];
  /** When set, the station is fixed (the driver has physically arrived there). */
  lockedStationId?: string;
  onCharged: (
    profile: Profile,
    result: { becameLoyal: boolean; freeChargeEarned: boolean; charge: Charge }
  ) => void;
}) {
  const selectable = useMemo(
    () =>
      lockedStationId
        ? stations.filter((s) => s.id === lockedStationId)
        : stations.filter((s) => s.status !== "offline"),
    [stations, lockedStationId]
  );

  const [stationId, setStationId] = useState(selectable[0]?.id ?? "");
  const [kwh, setKwh] = useState(35);
  const [useFreeCharge, setUseFreeCharge] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const station = selectable.find((s) => s.id === stationId);

  // Live estimate mirroring the server's pricing rules.
  const estimate = useMemo(() => {
    if (!station) return null;
    const gross = kwh * station.ratePerKwh;
    const redeeming = useFreeCharge && profile.freeChargesAvailable > 0;

    if (redeeming) {
      return { gross, percent: 100, discount: gross, net: 0, label: "Free charge reward" };
    }

    const percent = profile.nextDiscountPercent;
    const discount = (gross * percent) / 100;
    return {
      gross,
      percent,
      discount,
      net: gross - discount,
      label: profile.welcomeDiscountAvailable
        ? "10% welcome discount"
        : percent > 0
          ? "5% loyal discount"
          : "No discount",
    };
  }, [station, kwh, useFreeCharge, profile]);

  async function startCharge() {
    if (!station) return;

    setPhase("charging");
    setProgress(0);
    setError(null);

    // Animate a short simulated charging session before committing it.
    const started = Date.now();
    const DURATION = 2200;
    const timer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / DURATION) * 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(timer);
    }, 40);

    try {
      const [res] = await Promise.all([
        fetch("/api/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stationId, kwh, useFreeCharge }),
        }),
        new Promise((r) => setTimeout(r, DURATION)),
      ]);

      clearInterval(timer);
      setProgress(100);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not complete the charge.");
        setPhase("idle");
        return;
      }

      setPhase("done");
      setUseFreeCharge(false);
      onCharged(data.user, {
        becameLoyal: data.becameLoyal,
        freeChargeEarned: data.freeChargeEarned,
        charge: data.charge,
      });

      setTimeout(() => {
        setPhase("idle");
        setProgress(0);
      }, 1800);
    } catch {
      clearInterval(timer);
      setError("Network error. Please try again.");
      setPhase("idle");
    }
  }

  const busy = phase === "charging";

  return (
    <div className="glass sheen flex h-full flex-col rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-mist-100">Start a charge</h2>
        {profile.freeChargesAvailable > 0 && (
          <span className="rounded-full border border-volt-500/30 bg-volt-500/10 px-2.5 py-1 text-[0.7rem] font-medium text-volt-400">
            {profile.freeChargesAvailable} free available
          </span>
        )}
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="station" className="mb-2 block text-sm font-medium text-mist-300">
            Station
          </label>
          <select
            id="station"
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            disabled={busy || Boolean(lockedStationId)}
            className="field appearance-none disabled:opacity-60"
          >
            {selectable.map((s) => (
              <option key={s.id} value={s.id} className="bg-ink-900">
                {s.name} - {s.powerKw} kW - {s.ratePerKwh}/kWh
              </option>
            ))}
          </select>
          {station && (
            <p className="mt-2 text-xs text-mist-600">
              {station.location} &middot; {station.connector}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="kwh" className="text-sm font-medium text-mist-300">
              Energy to deliver
            </label>
            <span className="tabular text-sm font-semibold text-volt-400">{kwh} kWh</span>
          </div>
          <input
            id="kwh"
            type="range"
            min={5}
            max={120}
            step={1}
            value={kwh}
            onChange={(e) => setKwh(Number(e.target.value))}
            disabled={busy}
            className="w-full accent-volt-500 disabled:opacity-60"
          />
          <div className="mt-1 flex justify-between text-[0.7rem] text-mist-600">
            <span>5 kWh</span>
            <span>120 kWh</span>
          </div>
        </div>

        {profile.freeChargesAvailable > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-volt-500/25 bg-volt-500/[0.07] p-4">
            <input
              type="checkbox"
              checked={useFreeCharge}
              onChange={(e) => setUseFreeCharge(e.target.checked)}
              disabled={busy}
              className="mt-0.5 h-4 w-4 shrink-0 accent-volt-500"
            />
            <span>
              <span className="block text-sm font-medium text-mist-100">
                Redeem a free charge
              </span>
              <span className="mt-0.5 block text-xs text-mist-500">
                This session costs you nothing. Your welcome discount is saved for later.
              </span>
            </span>
          </label>
        )}

        {/* Price breakdown */}
        {estimate && (
          <div className="rounded-xl border border-white/8 bg-ink-950/50 p-4">
            <Row label="Subtotal" value={money(estimate.gross)} />
            {estimate.discount > 0 && (
              <Row
                label={estimate.label}
                value={`- ${money(estimate.discount)}`}
                accent
              />
            )}
            <div className="mt-3 flex items-baseline justify-between border-t border-white/8 pt-3">
              <span className="text-sm font-medium text-mist-100">You pay</span>
              <span className="tabular text-xl font-semibold text-mist-100">
                {estimate.net === 0 ? "FREE" : money(estimate.net)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex-1" />

      {/* Charging progress */}
      {phase !== "idle" && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-mist-300">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={phase === "charging" ? "bolt-flow text-volt-400" : "text-volt-400"}
                aria-hidden="true"
              >
                <path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H10l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12l1-7.5Z" />
              </svg>
              {phase === "done" ? "Charge complete" : "Charging in progress"}
            </span>
            <span className="tabular text-mist-500">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-volt-400 to-volt-600 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={startCharge}
        disabled={busy || !station}
        className={`btn-primary w-full ${busy ? "pulse-ring" : ""}`}
      >
        {phase === "charging"
          ? "Charging..."
          : phase === "done"
            ? "Complete"
            : useFreeCharge && profile.freeChargesAvailable > 0
              ? "Start free charge"
              : "Start charging"}
      </button>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={`text-sm ${accent ? "text-volt-400" : "text-mist-500"}`}>{label}</span>
      <span className={`tabular text-sm ${accent ? "font-medium text-volt-400" : "text-mist-300"}`}>
        {value}
      </span>
    </div>
  );
}
