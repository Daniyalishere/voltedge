"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Logo } from "@/components/Logo";
import { randomPoint } from "@/lib/graph/projection";
import type { Profile } from "@/lib/profile";
import type { MapPlan, Phase } from "./LeafletMap";
import { MapCanvas } from "./MapCanvas";

type Algo = "dijkstra" | "bfs" | "dfs";

interface PlanResponse {
  computeMs: number;
  userNode: { id: string; name: string; lat: number; lng: number; kind: "junction" };
  nearest: {
    station: {
      id: string; name: string; location: string; connector: string;
      powerKw: number; ratePerKwh: number; status: string;
    };
    distanceKm: number;
    hops: number | null;
  };
  path: string[];
  legs: { from: string; fromName: string; to: string; toName: string; road: string; km: number }[];
  totalKm: number;
  dijkstra: { visitedOrder: string[]; settled: number };
  bfs: {
    levels: { level: number; nodes: string[] }[];
    hops: number | null;
    path: string[];
    visitedOrder: string[];
    closedStations: { id: string; name: string }[];
    unreachableStations: { id: string; name: string }[];
  };
  dfs: {
    alternatives: { nodes: string[]; distance: number; roads: string[]; hops: number }[];
    explored: number;
    truncated: boolean;
  };
  ranked: {
    stationId: string; name: string; status: string;
    distanceKm: number | null; hops: number | null; reachable: boolean;
  }[];
}

export function RoutePlanner({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("placing");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [activeAlgo, setActiveAlgo] = useState<Algo | null>(null);
  const [tab, setTab] = useState<Algo>("dijkstra");
  const [highlightAlt, setHighlightAlt] = useState<number | null>(null);
  const [avoidBusy, setAvoidBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveFraction, setDriveFraction] = useState(0);
  const [driveKm, setDriveKm] = useState(0);

  const handleProgress = useCallback((fraction: number, km: number) => {
    setDriveFraction(fraction);
    setDriveKm(km);
  }, []);

  function placePin(lat: number, lng: number) {
    setPin({ lat, lng });
    setPlan(null);
    setPhase("ready");
    setError(null);
    setHighlightAlt(null);
    setDriveFraction(0);
    setDriveKm(0);
  }

  async function runAlgorithms() {
    if (!pin) return;

    setPhase("running");
    setError(null);
    setActiveAlgo("bfs");

    try {
      const res = await fetch("/api/route-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pin.lat, lng: pin.lng, avoidBusy }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not compute a route.");
        setPhase("ready");
        setActiveAlgo(null);
        return;
      }

      // Play the three searches in sequence so each is visible.
      setPlan(data);
      await wait(1100);
      setActiveAlgo("dijkstra");
      await wait(1400);
      setActiveAlgo(null);
      setPhase("routed");
    } catch {
      setError("Network error. Please try again.");
      setPhase("ready");
      setActiveAlgo(null);
    }
  }

  function startDriving() {
    setHighlightAlt(null);
    setDriveFraction(0);
    setDriveKm(0);
    setPhase("driving");
  }

  const handleArrive = useCallback(() => {
    setPhase("arrived");
  }, []);

  function reset() {
    setPin(null);
    setPlan(null);
    setPhase("placing");
    setActiveAlgo(null);
    setHighlightAlt(null);
    setError(null);
  }

  const mapPlan: MapPlan | null = plan
    ? {
        path: plan.path,
        nearestId: plan.nearest.station.id,
        dijkstraVisited: plan.dijkstra.visitedOrder,
        bfsVisited: plan.bfs.visitedOrder,
        altPaths: plan.dfs.alternatives.map((a) => a.nodes),
      }
    : null;

  return (
    <main className="flex-1">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" aria-label="VoltEdge dashboard">
            <Logo />
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="rise">
          <h1 className="text-3xl font-semibold tracking-tight">
            Find your <span className="text-gradient">nearest station</span>
          </h1>
          <p className="mt-2.5 max-w-2xl text-mist-500">
            Drop a pin anywhere in Karachi. We run{" "}
            <span className="text-mist-300">Dijkstra</span> for the shortest route,{" "}
            <span className="text-mist-300">BFS</span> to skip closed stations, and{" "}
            <span className="text-mist-300">DFS</span> to list every alternative path.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-5">
          {/* ---------------- Map ---------------- */}
          <div className="lg:col-span-3">
            <div className="relative">
              <MapCanvas
                phase={phase}
                pin={pin}
                plan={mapPlan}
                activeAlgo={activeAlgo}
                highlightAlt={highlightAlt}
                onPlace={placePin}
                onArrive={handleArrive}
                onProgress={handleProgress}
              />

              {/* Live drive HUD */}
              {(phase === "driving" || phase === "arrived") && plan && (
                <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[500]">
                  <div className="glass rounded-2xl px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <svg
                          width="17" height="17" viewBox="0 0 24 24" fill="currentColor"
                          className={`text-volt-400 ${phase === "driving" ? "bolt-flow" : ""}`}
                          aria-hidden="true"
                        >
                          <path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H10l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12l1-7.5Z" />
                        </svg>
                        <span className="text-sm font-medium text-mist-100">
                          {phase === "arrived"
                            ? `Arrived at ${plan.nearest.station.name}`
                            : `En route to ${plan.nearest.station.name}`}
                        </span>
                      </div>
                      <span className="tabular shrink-0 text-sm text-mist-300">
                        {driveKm.toFixed(1)} / {plan.totalKm.toFixed(1)} km
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-volt-400 to-volt-600"
                        style={{ width: `${driveFraction * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  const p = randomPoint();
                  placePin(p.lat, p.lng);
                }}
                disabled={phase === "running" || phase === "driving"}
                className="btn-ghost"
              >
                Random location
              </button>

              {(phase === "ready" || phase === "routed" || phase === "arrived") && (
                <button onClick={reset} className="btn-ghost">
                  Clear pin
                </button>
              )}

              <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-mist-500">
                <input
                  type="checkbox"
                  checked={avoidBusy}
                  onChange={(e) => setAvoidBusy(e.target.checked)}
                  disabled={phase === "running" || phase === "driving"}
                  className="h-4 w-4 accent-volt-500"
                />
                Also avoid busy stations
              </label>
            </div>

            <Legend />
          </div>

          {/* ---------------- Side panel ---------------- */}
          <div className="lg:col-span-2">
            <div className="glass sheen rounded-2xl p-6">
              {phase === "placing" && <PlacingState />}

              {phase === "ready" && pin && (
                <ReadyState pin={pin} onRun={runAlgorithms} error={error} />
              )}

              {phase === "running" && <RunningState activeAlgo={activeAlgo} />}

              {(phase === "routed" || phase === "driving" || phase === "arrived") && plan && (
                <ResultState
                  plan={plan}
                  phase={phase}
                  tab={tab}
                  setTab={setTab}
                  highlightAlt={highlightAlt}
                  setHighlightAlt={setHighlightAlt}
                  onDrive={startDriving}
                  onCharge={() =>
                    router.push(`/dashboard/charge?station=${plan.nearest.station.id}`)
                  }
                />
              )}
            </div>

            {profile.freeChargesAvailable > 0 && (
              <p className="mt-4 rounded-xl border border-volt-500/25 bg-volt-500/10 px-4 py-3 text-sm text-volt-400">
                You have {profile.freeChargesAvailable} free charge
                {profile.freeChargesAvailable === 1 ? "" : "s"} to redeem.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Panel states                                                        */
/* ------------------------------------------------------------------ */

function PlacingState() {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
            stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
          />
          <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </span>
      <h2 className="mt-4 font-medium text-mist-100">Set your location</h2>
      <p className="mt-2 text-sm leading-relaxed text-mist-500">
        Click anywhere on the map to place yourself, or press{" "}
        <span className="text-mist-300">Random location</span>. Your pin becomes a node in
        the road graph, wired to its four nearest junctions.
      </p>
    </div>
  );
}

function ReadyState({
  pin,
  onRun,
  error,
}: {
  pin: { lat: number; lng: number };
  onRun: () => void;
  error: string | null;
}) {
  return (
    <div>
      <h2 className="font-medium text-mist-100">Location set</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/8 bg-ink-950/50 p-3">
          <dt className="text-[0.65rem] uppercase tracking-wider text-mist-600">Latitude</dt>
          <dd className="tabular mt-1 text-sm text-mist-100">{pin.lat.toFixed(5)}</dd>
        </div>
        <div className="rounded-xl border border-white/8 bg-ink-950/50 p-3">
          <dt className="text-[0.65rem] uppercase tracking-wider text-mist-600">Longitude</dt>
          <dd className="tabular mt-1 text-sm text-mist-100">{pin.lng.toFixed(5)}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button onClick={onRun} className="btn-primary mt-5 w-full">
        Find nearest station
      </button>
      <p className="mt-3 text-center text-xs text-mist-600">
        Runs BFS, then Dijkstra, then DFS
      </p>
    </div>
  );
}

function RunningState({ activeAlgo }: { activeAlgo: Algo | null }) {
  const steps: { key: Algo; label: string; detail: string }[] = [
    { key: "bfs", label: "BFS", detail: "Checking reachability, skipping closed stations" },
    { key: "dijkstra", label: "Dijkstra", detail: "Relaxing edges for the shortest route" },
    { key: "dfs", label: "DFS", detail: "Enumerating alternative paths" },
  ];

  const activeIndex = activeAlgo ? steps.findIndex((s) => s.key === activeAlgo) : -1;

  return (
    <div>
      <h2 className="font-medium text-mist-100">Computing route</h2>
      <ul className="mt-5 space-y-3">
        {steps.map((s, i) => {
          const done = activeIndex > i;
          const active = activeIndex === i;
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold ${
                  done
                    ? "bg-volt-500 text-ink-950"
                    : active
                      ? "bg-volt-500/20 text-volt-400 pulse-ring"
                      : "bg-white/6 text-mist-600"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${active || done ? "text-mist-100" : "text-mist-600"}`}>
                  {s.label}
                </p>
                <p className="text-xs text-mist-600">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultState({
  plan,
  phase,
  tab,
  setTab,
  highlightAlt,
  setHighlightAlt,
  onDrive,
  onCharge,
}: {
  plan: PlanResponse;
  phase: Phase;
  tab: Algo;
  setTab: (a: Algo) => void;
  highlightAlt: number | null;
  setHighlightAlt: (i: number | null) => void;
  onDrive: () => void;
  onCharge: () => void;
}) {
  const st = plan.nearest.station;

  return (
    <div>
      {/* Result header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-volt-400">Nearest station</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-mist-100">{st.name}</h2>
          <p className="mt-0.5 truncate text-sm text-mist-600">{st.location}</p>
        </div>
        <span className="tabular shrink-0 rounded-xl border border-volt-500/25 bg-volt-500/10 px-3 py-2 text-center">
          <span className="block text-lg font-semibold text-volt-400">
            {plan.totalKm.toFixed(1)}
          </span>
          <span className="block text-[0.65rem] text-volt-400/70">km</span>
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="Power" value={`${st.powerKw} kW`} />
        <Mini label="Plug" value={st.connector} />
        <Mini label="Rate" value={`${st.ratePerKwh}/kWh`} />
      </dl>

      {/* Algorithm tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-white/8 bg-ink-950/50 p-1">
        {(["dijkstra", "bfs", "dfs"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              if (k !== "dfs") setHighlightAlt(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              tab === k ? "bg-volt-500/15 text-volt-400" : "text-mist-600 hover:text-mist-300"
            }`}
          >
            {k === "dijkstra" ? "Dijkstra" : k.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto pr-1">
        {tab === "dijkstra" && <DijkstraTab plan={plan} />}
        {tab === "bfs" && <BfsTab plan={plan} />}
        {tab === "dfs" && (
          <DfsTab plan={plan} highlight={highlightAlt} setHighlight={setHighlightAlt} />
        )}
      </div>

      {/* Action */}
      <div className="mt-6">
        {phase === "routed" && (
          <button onClick={onDrive} className="btn-primary w-full">
            Drive to this station
          </button>
        )}
        {phase === "driving" && (
          <button disabled className="btn-primary w-full">
            On the way...
          </button>
        )}
        {phase === "arrived" && (
          <>
            <p className="mb-3 rounded-xl border border-volt-500/25 bg-volt-500/10 px-4 py-3 text-center text-sm text-volt-400">
              You have arrived at {st.name}
            </p>
            <button onClick={onCharge} className="btn-primary w-full">
              Start charging here
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DijkstraTab({ plan }: { plan: PlanResponse }) {
  return (
    <div>
      <Stat
        items={[
          { k: "Shortest distance", v: `${plan.totalKm.toFixed(2)} km` },
          { k: "Nodes settled", v: String(plan.dijkstra.settled) },
          { k: "Compute time", v: `${plan.computeMs} ms` },
        ]}
      />
      <p className="mt-4 mb-2 text-xs uppercase tracking-wider text-mist-600">Turn by turn</p>
      <ol className="space-y-1.5">
        {plan.legs.map((l, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
            <span className="tabular mt-0.5 text-[0.65rem] text-mist-600">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-mist-300">{l.road}</p>
              <p className="truncate text-[0.68rem] text-mist-600">to {l.toName}</p>
            </div>
            <span className="tabular shrink-0 text-[0.68rem] text-mist-500">
              {l.km.toFixed(2)} km
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BfsTab({ plan }: { plan: PlanResponse }) {
  return (
    <div>
      <Stat
        items={[
          { k: "Fewest road segments", v: plan.bfs.hops !== null ? String(plan.bfs.hops) : "n/a" },
          { k: "Levels explored", v: String(plan.bfs.levels.length) },
          { k: "Nodes visited", v: String(plan.bfs.visitedOrder.length) },
        ]}
      />

      {plan.bfs.closedStations.length > 0 && (
        <>
          <p className="mt-4 mb-2 text-xs uppercase tracking-wider text-mist-600">
            Closed stations skipped
          </p>
          <ul className="space-y-1.5">
            {plan.bfs.closedStations.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-300"
              >
                <span className="text-red-400">✕</span>
                {s.name}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-mist-600">
            BFS excludes these from the search, so no route is ever planned through a
            station that is out of service.
          </p>
        </>
      )}

      <p className="mt-4 mb-2 text-xs uppercase tracking-wider text-mist-600">
        Exploration by level
      </p>
      <div className="space-y-1.5">
        {plan.bfs.levels.slice(0, 8).map((l) => (
          <div key={l.level} className="flex items-center gap-3">
            <span className="tabular w-10 shrink-0 text-[0.68rem] text-mist-600">
              L{l.level}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-volt-500/60"
                style={{ width: `${Math.min(100, (l.nodes.length / 8) * 100)}%` }}
              />
            </div>
            <span className="tabular w-6 shrink-0 text-right text-[0.68rem] text-mist-500">
              {l.nodes.length}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DfsTab({
  plan,
  highlight,
  setHighlight,
}: {
  plan: PlanResponse;
  highlight: number | null;
  setHighlight: (i: number | null) => void;
}) {
  return (
    <div>
      <Stat
        items={[
          { k: "Alternative routes", v: String(plan.dfs.alternatives.length) },
          { k: "Recursive calls", v: String(plan.dfs.explored) },
        ]}
      />
      <p className="mt-4 mb-2 text-xs uppercase tracking-wider text-mist-600">
        Tap a route to preview it
      </p>
      <ul className="space-y-1.5">
        {plan.dfs.alternatives.map((a, i) => {
          const active = highlight === i;
          return (
            <li key={i}>
              <button
                onClick={() => setHighlight(active ? null : i)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-white/6 bg-white/[0.02] hover:border-white/14"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs font-medium ${active ? "text-amber-300" : "text-mist-300"}`}>
                    {i === 0 ? "Shortest route" : `Alternative ${i}`}
                  </span>
                  <span className="tabular shrink-0 text-[0.68rem] text-mist-500">
                    {a.distance.toFixed(2)} km &middot; {a.hops} hops
                  </span>
                </div>
                <p className="mt-1 truncate text-[0.68rem] text-mist-600">
                  {a.roads.slice(0, 3).join(" -> ")}
                  {a.roads.length > 3 ? " ..." : ""}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      {plan.dfs.truncated && (
        <p className="mt-3 text-[0.68rem] leading-relaxed text-mist-600">
          Search was bounded - DFS is exponential, so it stops after 6 routes or 9 hops.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-ink-950/50 px-2.5 py-2 text-center">
      <p className="text-[0.6rem] uppercase tracking-wider text-mist-600">{label}</p>
      <p className="mt-0.5 truncate text-xs font-medium text-mist-100">{value}</p>
    </div>
  );
}

function Stat({ items }: { items: { k: string; v: string }[] }) {
  return (
    <dl className="space-y-1.5">
      {items.map((it) => (
        <div key={it.k} className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-mist-600">{it.k}</dt>
          <dd className="tabular text-xs font-medium text-mist-100">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Legend() {
  const items = [
    { color: "#10b981", label: "Available" },
    { color: "#f59e0b", label: "Busy" },
    { color: "#4b5563", label: "Closed" },
    { color: "#3b82f6", label: "You" },
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2 text-xs text-mist-600">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
