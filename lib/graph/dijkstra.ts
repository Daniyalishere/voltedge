import type { AdjacencyList, RoadGraph } from "./network";

/**
 * Dijkstra's shortest-path algorithm.
 *
 * Finds the minimum-distance route from `source` to every reachable node,
 * using a binary min-heap as the priority queue.
 *
 * Complexity: O((V + E) log V) with the heap.
 *
 * `blocked` lets the caller exclude nodes (closed stations) from the search;
 * a blocked node is never settled and never relaxed through.
 */

/** Minimal binary min-heap keyed on distance. */
class MinHeap {
  private heap: Array<{ id: string; dist: number }> = [];

  get size(): number {
    return this.heap.length;
  }

  push(id: string, dist: number): void {
    this.heap.push({ id, dist });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: string; dist: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].dist <= this.heap[i].dist) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;

      if (left < n && this.heap[left].dist < this.heap[smallest].dist) smallest = left;
      if (right < n && this.heap[right].dist < this.heap[smallest].dist) smallest = right;
      if (smallest === i) break;

      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/** One settle event, in the order the algorithm settled nodes. */
export interface DijkstraStep {
  node: string;
  dist: number;
  /** Neighbours whose tentative distance improved when this node was settled. */
  relaxed: string[];
}

export interface DijkstraResult {
  dist: Map<string, number>;
  prev: Map<string, string | null>;
  /** Road used to arrive at each node, for the route breakdown. */
  viaRoad: Map<string, string>;
  /** Settle order - drives the "explored" animation in the UI. */
  steps: DijkstraStep[];
  visitedOrder: string[];
}

export function dijkstra(
  graph: Pick<RoadGraph, "adjacency">,
  source: string,
  blocked: Set<string> = new Set()
): DijkstraResult {
  const adjacency: AdjacencyList = graph.adjacency;

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const viaRoad = new Map<string, string>();
  const settled = new Set<string>();
  const steps: DijkstraStep[] = [];
  const visitedOrder: string[] = [];

  for (const id of adjacency.keys()) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }

  dist.set(source, 0);

  const pq = new MinHeap();
  pq.push(source, 0);

  while (pq.size > 0) {
    const top = pq.pop()!;

    // Stale entry: a shorter distance was already settled for this node.
    if (settled.has(top.id)) continue;
    if (blocked.has(top.id) && top.id !== source) continue;

    settled.add(top.id);
    visitedOrder.push(top.id);

    const relaxed: string[] = [];

    for (const edge of adjacency.get(top.id) ?? []) {
      if (settled.has(edge.to) || blocked.has(edge.to)) continue;

      const candidate = top.dist + edge.weight;
      if (candidate < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, candidate);
        prev.set(edge.to, top.id);
        viaRoad.set(edge.to, edge.road);
        pq.push(edge.to, candidate);
        relaxed.push(edge.to);
      }
    }

    steps.push({ node: top.id, dist: top.dist, relaxed });
  }

  return { dist, prev, viaRoad, steps, visitedOrder };
}

/** Walks the predecessor chain back from `target`. Empty if unreachable. */
export function reconstructPath(
  prev: Map<string, string | null>,
  source: string,
  target: string
): string[] {
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
