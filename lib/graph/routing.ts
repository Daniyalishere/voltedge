import { bfs, bfsPath, type BfsLevel } from "./bfs";
import { dijkstra, reconstructPath } from "./dijkstra";
import { findAllPaths, type DfsPath } from "./dfs";
import {
  ALL_NODES,
  buildGraph,
  haversine,
  STATION_NODES,
  type EdgeSpec,
  type GraphNode,
  type StationNode,
} from "./network";

export const USER_NODE_ID = "user-location";

/** How many nearby junctions the dropped pin is wired into. */
const USER_CONNECTIONS = 4;

export interface RouteLeg {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  road: string;
  km: number;
}

export interface StationCandidate {
  station: StationNode;
  /** Shortest road distance in km (Dijkstra). */
  distanceKm: number;
  /** Fewest road segments (BFS). */
  hops: number | null;
  reachable: boolean;
  path: string[];
}

export interface RoutePlan {
  /** Nodes the user's pin was attached to, so the UI can draw them. */
  userNode: GraphNode;

  /** --- Dijkstra --- */
  nearest: StationCandidate | null;
  path: string[];
  legs: RouteLeg[];
  totalKm: number;
  dijkstraVisitedOrder: string[];
  dijkstraSettled: number;

  /** --- BFS --- */
  bfsLevels: BfsLevel[];
  bfsHops: number | null;
  bfsPathNodes: string[];
  closedStations: StationNode[];
  unreachableStations: StationNode[];
  bfsVisitedOrder: string[];

  /** --- DFS --- */
  alternatives: DfsPath[];
  dfsExplored: number;
  dfsTruncated: boolean;

  /** All stations ranked by shortest-path distance. */
  ranked: StationCandidate[];
}

/**
 * Connects a free-form user coordinate into the road graph by joining it to its
 * `USER_CONNECTIONS` nearest junctions, then runs all three algorithms from it.
 *
 * The pin is a real graph node, so Dijkstra/BFS/DFS operate on one uniform
 * structure rather than special-casing the starting point.
 */
export function planRoute(
  userLat: number,
  userLng: number,
  options: { avoidBusy?: boolean } = {}
): RoutePlan {
  const userNode: GraphNode = {
    id: USER_NODE_ID,
    name: "Your location",
    kind: "junction",
    lat: userLat,
    lng: userLng,
  };

  // Attach the pin to the closest junctions (stations excluded, so the user
  // never "starts" inside a charging bay).
  const nearestJunctions = ALL_NODES
    .filter((n) => n.kind === "junction")
    .map((n) => ({ node: n, d: haversine(userNode, n) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, USER_CONNECTIONS);

  const userEdges: EdgeSpec[] = nearestJunctions.map((j) => ({
    from: USER_NODE_ID,
    to: j.node.id,
    road: `Local road to ${j.node.name}`,
  }));

  const graph = buildGraph([userNode], userEdges);

  // Closed stations are excluded from every search; busy ones optionally.
  const closedStations = STATION_NODES.filter((s) => s.status === "offline");
  const busyStations = STATION_NODES.filter((s) => s.status === "busy");

  const blocked = new Set<string>(closedStations.map((s) => s.id));
  if (options.avoidBusy) {
    for (const s of busyStations) blocked.add(s.id);
  }

  /* ---------------- BFS: reachability and hop counts ---------------- */
  const bfsResult = bfs(graph, USER_NODE_ID, blocked);

  /* ---------------- Dijkstra: shortest distances -------------------- */
  const dj = dijkstra(graph, USER_NODE_ID, blocked);

  const openStations = STATION_NODES.filter((s) => !blocked.has(s.id));

  const ranked: StationCandidate[] = openStations
    .map((station) => {
      const distanceKm = dj.dist.get(station.id) ?? Infinity;
      const path = reconstructPath(dj.prev, USER_NODE_ID, station.id);
      return {
        station,
        distanceKm,
        hops: bfsResult.level.get(station.id) ?? null,
        reachable: Number.isFinite(distanceKm) && path.length > 0,
        path,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearest = ranked.find((c) => c.reachable) ?? null;
  const path = nearest?.path ?? [];

  /* ---------------- Route legs for the itinerary -------------------- */
  const legs: RouteLeg[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = graph.nodes.get(path[i])!;
    const to = graph.nodes.get(path[i + 1])!;
    legs.push({
      from: from.id,
      fromName: from.name,
      to: to.id,
      toName: to.name,
      road: dj.viaRoad.get(to.id) ?? "Local road",
      km: haversine(from, to),
    });
  }

  /* ---------------- DFS: alternative routes ------------------------- */
  const dfs = nearest
    ? findAllPaths(graph, USER_NODE_ID, nearest.station.id, {
        maxDepth: 9,
        maxPaths: 6,
        blocked,
      })
    : { paths: [], explored: 0, truncated: false };

  const unreachableStations = ranked.filter((c) => !c.reachable).map((c) => c.station);

  return {
    userNode,

    nearest,
    path,
    legs,
    totalKm: nearest?.distanceKm ?? 0,
    dijkstraVisitedOrder: dj.visitedOrder,
    dijkstraSettled: dj.visitedOrder.length,

    bfsLevels: bfsResult.levels,
    bfsHops: nearest ? (bfsResult.level.get(nearest.station.id) ?? null) : null,
    bfsPathNodes: nearest ? bfsPath(bfsResult.prev, USER_NODE_ID, nearest.station.id) : [],
    closedStations,
    unreachableStations,
    bfsVisitedOrder: bfsResult.visitedOrder,

    alternatives: dfs.paths,
    dfsExplored: dfs.explored,
    dfsTruncated: dfs.truncated,

    ranked,
  };
}
