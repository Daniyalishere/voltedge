import type { RoadGraph } from "./network";

/**
 * Breadth-first search.
 *
 * Explores the graph in level order (fewest hops first) from `source`. Here it
 * answers two questions:
 *
 *   1. Which stations are actually reachable once CLOSED (offline) stations are
 *      excluded from the network?
 *   2. How many road segments away is each one?
 *
 * Because BFS visits in non-decreasing hop count, the first time a node is
 * dequeued its `level` is the minimum number of edges from the source - which
 * is the fewest-turns route, distinct from Dijkstra's shortest-distance route.
 *
 * Complexity: O(V + E).
 */

export interface BfsLevel {
  level: number;
  nodes: string[];
}

export interface BfsResult {
  /** Hop count from source; absent when unreachable. */
  level: Map<string, number>;
  prev: Map<string, string | null>;
  /** Nodes grouped by hop distance - drives the ripple animation. */
  levels: BfsLevel[];
  visitedOrder: string[];
  reachable: Set<string>;
  /** Nodes skipped because they were blocked (e.g. closed stations). */
  skipped: string[];
}

export function bfs(
  graph: Pick<RoadGraph, "adjacency">,
  source: string,
  blocked: Set<string> = new Set()
): BfsResult {
  const level = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visitedOrder: string[] = [];
  const reachable = new Set<string>();
  const skippedSet = new Set<string>();

  // Array + head index acts as an O(1) queue without shift()'s O(n) cost.
  const queue: string[] = [source];
  let head = 0;

  level.set(source, 0);
  prev.set(source, null);
  reachable.add(source);

  while (head < queue.length) {
    const current = queue[head++];
    visitedOrder.push(current);

    const currentLevel = level.get(current)!;

    for (const edge of graph.adjacency.get(current) ?? []) {
      if (blocked.has(edge.to)) {
        // Record the detour cause once, then route around it.
        skippedSet.add(edge.to);
        continue;
      }
      if (reachable.has(edge.to)) continue;

      reachable.add(edge.to);
      level.set(edge.to, currentLevel + 1);
      prev.set(edge.to, current);
      queue.push(edge.to);
    }
  }

  // Group by level for the layered visualisation.
  const byLevel = new Map<number, string[]>();
  for (const [node, lvl] of level) {
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(node);
  }

  const levels: BfsLevel[] = [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lvl, nodes]) => ({ level: lvl, nodes }));

  return {
    level,
    prev,
    levels,
    visitedOrder,
    reachable,
    skipped: [...skippedSet],
  };
}

/** Fewest-hop path from BFS predecessors. Empty when unreachable. */
export function bfsPath(
  prev: Map<string, string | null>,
  source: string,
  target: string
): string[] {
  if (!prev.has(target)) return [];

  const path: string[] = [];
  let cur: string | null = target;

  while (cur !== null) {
    path.push(cur);
    if (cur === source) break;
    cur = prev.get(cur) ?? null;
  }

  path.reverse();
  return path[0] === source ? path : [];
}
