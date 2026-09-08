import type { RoadGraph } from "./network";

/**
 * Depth-first search for ALL simple paths between two nodes.
 *
 * Unlike Dijkstra (one shortest route) or BFS (fewest hops), this enumerates
 * every distinct route that never repeats a node, so the driver can compare
 * alternatives - a scenic route, a route avoiding a busy district, and so on.
 *
 * The search is exponential in the worst case, so it is bounded on three axes:
 *   - maxDepth   - longest path in edges
 *   - maxPaths   - stop once this many complete routes are found
 *   - visited    - the on-stack set, which is what makes paths *simple*
 *
 * Backtracking is the key step: after recursing into a neighbour the node is
 * removed from `visited` again, so it stays available to other branches.
 */

export interface DfsPath {
  nodes: string[];
  /** Total distance in km along this route. */
  distance: number;
  /** Roads taken, in order, deduplicated for readability. */
  roads: string[];
  hops: number;
}

export interface DfsResult {
  paths: DfsPath[];
  /** Total recursive calls - shown to illustrate the cost of exhaustive search. */
  explored: number;
  /** True when a bound cut the search short. */
  truncated: boolean;
}

export function findAllPaths(
  graph: Pick<RoadGraph, "adjacency">,
  source: string,
  target: string,
  options: { maxDepth?: number; maxPaths?: number; blocked?: Set<string> } = {}
): DfsResult {
  const { maxDepth = 12, maxPaths = 8, blocked = new Set<string>() } = options;

  const paths: DfsPath[] = [];
  const visited = new Set<string>([source]);
  const stack: string[] = [source];
  const roadStack: string[] = [];

  let explored = 0;
  let truncated = false;

  function recurse(current: string, distance: number): void {
    explored++;

    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }

    if (current === target) {
      paths.push({
        nodes: [...stack],
        distance,
        roads: dedupeConsecutive(roadStack),
        hops: stack.length - 1,
      });
      return;
    }

    if (stack.length - 1 >= maxDepth) {
      truncated = true;
      return;
    }

    for (const edge of graph.adjacency.get(current) ?? []) {
      if (visited.has(edge.to) || blocked.has(edge.to)) continue;

      visited.add(edge.to);
      stack.push(edge.to);
      roadStack.push(edge.road);

      recurse(edge.to, distance + edge.weight);

      // Backtrack: undo this choice so other branches can use the node.
      roadStack.pop();
      stack.pop();
      visited.delete(edge.to);
    }
  }

  recurse(source, 0);

  // Shortest first, so the UI lists the best alternatives at the top.
  paths.sort((a, b) => a.distance - b.distance);

  return { paths, explored, truncated };
}

function dedupeConsecutive(roads: string[]): string[] {
  return roads.filter((r, i) => i === 0 || r !== roads[i - 1]);
}
