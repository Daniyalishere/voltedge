"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { ALL_NODES, STATION_NODES, type GraphNode } from "@/lib/graph/network";

export type Phase = "placing" | "ready" | "running" | "routed" | "driving" | "arrived";

export interface MapPlan {
  path: string[];
  nearestId: string;
  dijkstraVisited: string[];
  bfsVisited: string[];
  altPaths: string[][];
}

const KARACHI_CENTER: [number, number] = [24.873, 67.065];
const NODE_POS = new Map<string, [number, number]>(
  ALL_NODES.map((n) => [n.id, [n.lat, n.lng] as [number, number]])
);

/* ------------------------------------------------------------------ */
/* Marker icons (inline SVG, so nothing is fetched from a CDN)         */
/* ------------------------------------------------------------------ */

function svgIcon(html: string, size: number, anchor?: [number, number]): L.DivIcon {
  return L.divIcon({
    html,
    className: "voltedge-marker",
    iconSize: [size, size],
    iconAnchor: anchor ?? [size / 2, size / 2],
  });
}

function stationIcon(status: string, isTarget: boolean): L.DivIcon {
  const fill = status === "offline" ? "#4b5563" : status === "busy" ? "#f59e0b" : "#10b981";
  const size = isTarget ? 42 : 30;
  const r = isTarget ? 15 : 11;
  const c = size / 2;

  const pulse = isTarget
    ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#34e5a0" stroke-width="2" opacity="0.6">
         <animate attributeName="r" values="${r};${r + 9};${r}" dur="1.8s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite"/>
       </circle>`
    : "";

  const cross =
    status === "offline"
      ? `<g stroke="#ef4444" stroke-width="2.4" stroke-linecap="round">
           <line x1="${c - 6}" y1="${c - 6}" x2="${c + 6}" y2="${c + 6}"/>
           <line x1="${c + 6}" y1="${c - 6}" x2="${c - 6}" y2="${c + 6}"/>
         </g>`
      : "";

  return svgIcon(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
       ${pulse}
       <circle cx="${c}" cy="${c}" r="${r - 2}" fill="${fill}" stroke="${isTarget ? "#fff" : "rgba(5,7,13,0.85)"}"
               stroke-width="${isTarget ? 2.5 : 2}" opacity="${status === "offline" ? 0.6 : 1}"/>
       <path d="M ${c - 1.4} ${c - 5} L ${c - 4} ${c + 0.6} L ${c - 0.8} ${c + 0.6} L ${c + 1.3} ${c + 5.2} L ${c + 4} ${c - 0.7} L ${c + 0.6} ${c - 0.7} Z"
             fill="#04140d" opacity="${status === "offline" ? 0.45 : 0.9}"/>
       ${cross}
     </svg>`,
    size
  );
}

const userIcon = svgIcon(
  `<svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
     <circle cx="22" cy="22" r="12" fill="rgba(59,130,246,0.25)">
       <animate attributeName="r" values="10;19;10" dur="2.2s" repeatCount="indefinite"/>
       <animate attributeName="opacity" values="0.6;0;0.6" dur="2.2s" repeatCount="indefinite"/>
     </circle>
     <circle cx="22" cy="22" r="8" fill="#3b82f6" stroke="#fff" stroke-width="2.5"/>
   </svg>`,
  44
);

function carIcon(angleDeg: number): L.DivIcon {
  return svgIcon(
    `<svg width="46" height="46" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
       <circle cx="23" cy="23" r="15" fill="rgba(52,229,160,0.22)">
         <animate attributeName="r" values="12;18;12" dur="1.2s" repeatCount="indefinite"/>
       </circle>
       <g transform="rotate(${angleDeg} 23 23)">
         <rect x="11" y="17" width="24" height="12" rx="4" fill="#34e5a0" stroke="#04140d" stroke-width="1.6"/>
         <rect x="17" y="19.5" width="8" height="7" rx="2" fill="#04140d" opacity="0.6"/>
         <circle cx="33" cy="23" r="2" fill="#04140d" opacity="0.75"/>
       </g>
     </svg>`,
    46
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function ClickHandler({
  enabled,
  onPlace,
}: {
  enabled: boolean;
  onPlace: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Keeps the visible area in step with the current phase. */
function ViewController({
  phase,
  routeLatLngs,
  carPos,
}: {
  phase: Phase;
  routeLatLngs: [number, number][];
  carPos: [number, number] | null;
}) {
  const map = useMap();
  const fittedFor = useRef<string>("");

  useEffect(() => {
    if ((phase === "routed" || phase === "running") && routeLatLngs.length > 1) {
      const key = routeLatLngs.map((p) => p.join()).join("|");
      if (fittedFor.current === key) return;
      fittedFor.current = key;
      map.fitBounds(L.latLngBounds(routeLatLngs), {
        padding: [70, 70],
        animate: true,
        duration: 0.9,
      });
    }
  }, [phase, routeLatLngs, map]);

  // Follow the car while it drives.
  useEffect(() => {
    if (phase === "driving" && carPos) {
      map.panTo(carPos, { animate: true, duration: 0.35, easeLinearity: 0.5 });
    }
  }, [phase, carPos, map]);

  useEffect(() => {
    if (phase === "placing") {
      fittedFor.current = "";
      map.setView(KARACHI_CENTER, 12, { animate: true });
    }
  }, [phase, map]);

  return null;
}

function bearing(a: [number, number], b: [number, number]): number {
  // Screen-space angle is what the icon needs, not true geographic bearing.
  return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI * -1;
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

export function LeafletMap({
  phase,
  pin,
  plan,
  activeAlgo,
  highlightAlt,
  onPlace,
  onArrive,
  onProgress,
}: {
  phase: Phase;
  pin: { lat: number; lng: number } | null;
  plan: MapPlan | null;
  activeAlgo: "dijkstra" | "bfs" | "dfs" | null;
  highlightAlt: number | null;
  onPlace: (lat: number, lng: number) => void;
  onArrive: () => void;
  onProgress?: (fraction: number, km: number) => void;
}) {
  const [exploredCount, setExploredCount] = useState(0);
  const [carT, setCarT] = useState(0);

  const posOf = useCallback(
    (id: string): [number, number] | null => {
      if (id === "user-location") return pin ? [pin.lat, pin.lng] : null;
      return NODE_POS.get(id) ?? null;
    },
    [pin]
  );

  /* -------- Route geometry -------- */
  const routeLatLngs = useMemo(() => {
    if (!plan) return [];
    return plan.path
      .map((id) => posOf(id))
      .filter((p): p is [number, number] => Boolean(p));
  }, [plan, posOf]);

  const altLatLngs = useMemo(() => {
    if (highlightAlt === null || !plan?.altPaths[highlightAlt]) return [];
    return plan.altPaths[highlightAlt]
      .map((id) => posOf(id))
      .filter((p): p is [number, number] => Boolean(p));
  }, [highlightAlt, plan, posOf]);

  /* -------- Animate algorithm exploration --------
   * Only a counter lives in state; the visible set is derived from it during
   * render, so no effect has to reset state synchronously. */
  const exploreOrder = useMemo(() => {
    if (phase !== "running" || !plan || !activeAlgo) return [];
    return activeAlgo === "bfs"
      ? plan.bfsVisited
      : activeAlgo === "dijkstra"
        ? plan.dijkstraVisited
        : plan.altPaths.flat();
  }, [phase, plan, activeAlgo]);

  useEffect(() => {
    if (exploreOrder.length === 0) return;

    // Deriving the count from elapsed time means the effect never has to seed
    // state synchronously - the first tick already reflects a fresh run.
    const started = performance.now();
    const id = setInterval(() => {
      const n = Math.floor((performance.now() - started) / 28);
      if (n >= exploreOrder.length) {
        clearInterval(id);
        setExploredCount(exploreOrder.length);
      } else {
        setExploredCount(n);
      }
    }, 28);

    return () => clearInterval(id);
  }, [exploreOrder]);

  const explored = useMemo(
    // Slice defensively: the count belongs to whichever order is current.
    () => new Set(exploreOrder.slice(0, Math.min(exploredCount, exploreOrder.length))),
    [exploreOrder, exploredCount]
  );

  /* -------- Cumulative segment lengths for constant-speed driving -------- */
  const { cum, total } = useMemo(() => {
    const c: number[] = [0];
    for (let i = 0; i < routeLatLngs.length - 1; i++) {
      const a = L.latLng(routeLatLngs[i]);
      const b = L.latLng(routeLatLngs[i + 1]);
      c.push(c[i] + a.distanceTo(b));
    }
    return { cum: c, total: c[c.length - 1] ?? 0 };
  }, [routeLatLngs]);

  /* -------- Drive animation -------- */
  useEffect(() => {
    if (phase !== "driving" || routeLatLngs.length < 2 || total === 0) return;

    // Scale duration with distance, clamped so it never drags or flashes past.
    const duration = Math.min(11000, Math.max(4000, (total / 1000) * 700));
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease in and out so the car accelerates away and eases to a stop.
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setCarT(eased);
      onProgress?.(eased, (total * eased) / 1000);

      if (t < 1) raf = requestAnimationFrame(tick);
      else onArrive();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, routeLatLngs.length, total, onArrive, onProgress]);

  /* -------- Car position along the polyline --------
   * Before the drive starts the car sits at the origin, so the fraction is
   * derived rather than reset through an effect. */
  const effectiveT = phase === "driving" || phase === "arrived" ? carT : 0;

  const car = useMemo((): { pos: [number, number]; angle: number } | null => {
    if (routeLatLngs.length < 2 || total === 0) return null;

    const target = total * effectiveT;
    let seg = 0;
    while (seg < cum.length - 2 && cum[seg + 1] < target) seg++;

    const segStart = cum[seg];
    const segLen = cum[seg + 1] - segStart;
    const local = segLen === 0 ? 0 : Math.max(0, Math.min(1, (target - segStart) / segLen));

    const a = routeLatLngs[seg];
    const b = routeLatLngs[seg + 1];

    return {
      pos: [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local],
      angle: bearing(a, b),
    };
  }, [routeLatLngs, cum, total, effectiveT]);

  /** Portion of the route already covered, drawn brighter behind the car. */
  const travelled = useMemo(() => {
    if (!car || routeLatLngs.length < 2) return [];
    const target = total * effectiveT;
    const pts: [number, number][] = [];
    for (let i = 0; i < routeLatLngs.length; i++) {
      if (cum[i] <= target) pts.push(routeLatLngs[i]);
      else break;
    }
    pts.push(car.pos);
    return pts;
  }, [car, routeLatLngs, cum, total, effectiveT]);

  const pathSet = useMemo(() => new Set(plan?.path ?? []), [plan]);
  const interactive = phase === "placing" || phase === "ready";
  const showRoute = phase === "routed" || phase === "driving" || phase === "arrived";

  return (
    <div className="glass relative overflow-hidden rounded-2xl">
      <MapContainer
        center={KARACHI_CENTER}
        zoom={12}
        scrollWheelZoom
        style={{ height: "640px", width: "100%", background: "#0a0e1a" }}
        className={interactive ? "cursor-crosshair" : ""}
      >
        {/* Standard OpenStreetMap tiles: free, no API key, no watermark.
            They ship light, so `.voltedge-tiles` inverts and tints them in CSS
            to match the dark theme. */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          className="voltedge-tiles"
        />

        <ClickHandler enabled={interactive} onPlace={onPlace} />
        <ViewController
          phase={phase}
          routeLatLngs={routeLatLngs}
          carPos={car?.pos ?? null}
        />

        {/* ---- Explored nodes (algorithm visualisation) ---- */}
        {phase === "running" &&
          [...explored].map((id) => {
            const p = posOf(id);
            if (!p) return null;
            return (
              <CircleMarker
                key={`ex-${id}`}
                center={p}
                radius={7}
                pathOptions={{
                  color: "#34e5a0",
                  weight: 1.5,
                  fillColor: "#34e5a0",
                  fillOpacity: 0.22,
                }}
              />
            );
          })}

        {/* ---- Alternative route (DFS preview) ---- */}
        {altLatLngs.length > 1 && (
          <Polyline
            positions={altLatLngs}
            pathOptions={{
              color: "#f59e0b",
              weight: 5,
              opacity: 0.85,
              dashArray: "10 8",
              lineCap: "round",
            }}
          />
        )}

        {/* ---- Chosen route (Dijkstra) ---- */}
        {showRoute && routeLatLngs.length > 1 && (
          <>
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: "#059669", weight: 12, opacity: 0.25, lineCap: "round" }}
            />
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: "#34e5a0", weight: 5, opacity: 0.55, lineCap: "round" }}
            />
            {/* Covered portion, drawn solid on top */}
            {travelled.length > 1 && (
              <Polyline
                positions={travelled}
                pathOptions={{ color: "#ffffff", weight: 5, opacity: 0.9, lineCap: "round" }}
              />
            )}
          </>
        )}

        {/* ---- Stations ---- */}
        {STATION_NODES.map((s) => {
          const isTarget = plan?.nearestId === s.id;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={stationIcon(s.status, Boolean(isTarget))}
              zIndexOffset={isTarget ? 500 : 0}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                <div className="text-xs">
                  <div className="font-semibold">{s.name}</div>
                  <div className="opacity-70">{s.location}</div>
                  <div className="mt-1 opacity-70">
                    {s.powerKw} kW &middot; {s.connector} &middot; PKR {s.ratePerKwh}/kWh
                  </div>
                  <div
                    className="mt-1 font-medium"
                    style={{
                      color:
                        s.status === "offline"
                          ? "#ef4444"
                          : s.status === "busy"
                            ? "#f59e0b"
                            : "#10b981",
                    }}
                  >
                    {s.status === "offline"
                      ? "CLOSED - skipped by BFS"
                      : s.status === "busy"
                        ? "Busy"
                        : "Available"}
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* ---- Junctions on the chosen route ---- */}
        {ALL_NODES.filter((n) => n.kind === "junction" && pathSet.has(n.id)).map(
          (j: GraphNode) => (
            <CircleMarker
              key={j.id}
              center={[j.lat, j.lng]}
              radius={5}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: "#34e5a0",
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <span className="text-xs">{j.name}</span>
              </Tooltip>
            </CircleMarker>
          )
        )}

        {/* ---- User pin ---- */}
        {pin && (
          <Marker position={[pin.lat, pin.lng]} icon={userIcon} zIndexOffset={400}>
            <Tooltip direction="top" offset={[0, -14]} permanent={phase === "ready"}>
              <span className="text-xs font-semibold">You are here</span>
            </Tooltip>
          </Marker>
        )}

        {/* ---- Car ---- */}
        {car && (phase === "driving" || phase === "arrived") && (
          <Marker position={car.pos} icon={carIcon(car.angle)} zIndexOffset={1000} />
        )}
      </MapContainer>

      {interactive && !pin && (
        <div className="pointer-events-none absolute inset-0 z-[400] grid place-items-center">
          <div className="glass rounded-2xl px-6 py-4 text-center">
            <p className="text-sm font-medium text-mist-100">Click anywhere to drop your pin</p>
            <p className="mt-1 text-xs text-mist-500">
              Or use &ldquo;Random location&rdquo; to be placed automatically
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
