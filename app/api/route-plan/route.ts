import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { MAP_BOUNDS } from "@/lib/graph/projection";
import { planRoute } from "@/lib/graph/routing";

const schema = z.object({
  lat: z.coerce.number().min(MAP_BOUNDS.minLat - 0.01).max(MAP_BOUNDS.maxLat + 0.01),
  lng: z.coerce.number().min(MAP_BOUNDS.minLng - 0.01).max(MAP_BOUNDS.maxLng + 0.01),
  avoidBusy: z.boolean().optional().default(false),
});

/**
 * Runs Dijkstra, BFS and DFS from the user's dropped pin and returns the full
 * plan, including each algorithm's exploration trace for the animation.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
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
      { error: parsed.error.issues[0]?.message ?? "Drop your pin inside Karachi." },
      { status: 400 }
    );
  }

  const { lat, lng, avoidBusy } = parsed.data;

  const started = performance.now();
  const plan = planRoute(lat, lng, { avoidBusy });
  const elapsedMs = performance.now() - started;

  if (!plan.nearest) {
    return NextResponse.json(
      { error: "No open charging station is reachable from that point." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    computeMs: Number(elapsedMs.toFixed(2)),
    userNode: plan.userNode,
    nearest: {
      station: plan.nearest.station,
      distanceKm: Number(plan.nearest.distanceKm.toFixed(3)),
      hops: plan.nearest.hops,
    },
    path: plan.path,
    legs: plan.legs.map((l) => ({ ...l, km: Number(l.km.toFixed(3)) })),
    totalKm: Number(plan.totalKm.toFixed(3)),
    dijkstra: {
      visitedOrder: plan.dijkstraVisitedOrder,
      settled: plan.dijkstraSettled,
    },
    bfs: {
      levels: plan.bfsLevels,
      hops: plan.bfsHops,
      path: plan.bfsPathNodes,
      visitedOrder: plan.bfsVisitedOrder,
      closedStations: plan.closedStations,
      unreachableStations: plan.unreachableStations,
    },
    dfs: {
      alternatives: plan.alternatives.map((a) => ({
        ...a,
        distance: Number(a.distance.toFixed(3)),
      })),
      explored: plan.dfsExplored,
      truncated: plan.dfsTruncated,
    },
    ranked: plan.ranked.map((r) => ({
      stationId: r.station.id,
      name: r.station.name,
      status: r.station.status,
      distanceKm: Number.isFinite(r.distanceKm) ? Number(r.distanceKm.toFixed(3)) : null,
      hops: r.hops,
      reachable: r.reachable,
    })),
  });
}
