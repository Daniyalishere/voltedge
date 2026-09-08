/**
 * Karachi road network as an undirected weighted graph.
 *
 * Nodes are either road junctions or EV charging stations, positioned by real
 * latitude/longitude. Edges are road segments; their weight is the great-circle
 * distance in kilometres between the two endpoints, so path costs are real
 * distances rather than invented numbers.
 *
 * This is the data structure every algorithm in this project runs on:
 *   - Dijkstra  -> shortest route to a station        (lib/graph/dijkstra.ts)
 *   - BFS       -> reachability, skipping closed nodes (lib/graph/bfs.ts)
 *   - DFS       -> enumerate alternative routes        (lib/graph/dfs.ts)
 */

export type NodeKind = "junction" | "station";

export interface GraphNode {
  id: string;
  name: string;
  kind: NodeKind;
  lat: number;
  lng: number;
}

export interface EdgeSpec {
  from: string;
  to: string;
  /** Road name, shown in the route breakdown. */
  road: string;
}

/** An adjacency-list entry: a neighbour and the cost to reach it. */
export interface Adjacent {
  to: string;
  weight: number;
  road: string;
}

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

/**
 * Road junctions across Karachi. These give the graph enough structure that
 * shortest-path and alternative-path searches produce meaningfully different
 * answers rather than trivially straight lines.
 */
export const JUNCTIONS: GraphNode[] = [
  { id: "j-tower", name: "Merewether Tower", kind: "junction", lat: 24.8500, lng: 67.0100 },
  { id: "j-ii-chundrigar", name: "I. I. Chundrigar Road", kind: "junction", lat: 24.8562, lng: 67.0093 },
  { id: "j-saddar", name: "Saddar", kind: "junction", lat: 24.8607, lng: 67.0221 },
  { id: "j-clifton-bridge", name: "Clifton Bridge", kind: "junction", lat: 24.8280, lng: 67.0300 },
  { id: "j-teen-talwar", name: "Teen Talwar", kind: "junction", lat: 24.8180, lng: 67.0290 },
  { id: "j-do-talwar", name: "Do Talwar", kind: "junction", lat: 24.8240, lng: 67.0380 },
  { id: "j-shahrah-faisal", name: "Shahrah-e-Faisal", kind: "junction", lat: 24.8700, lng: 67.0700 },
  { id: "j-nursery", name: "Nursery", kind: "junction", lat: 24.8660, lng: 67.0620 },
  { id: "j-fsc", name: "FTC Interchange", kind: "junction", lat: 24.8620, lng: 67.0490 },
  { id: "j-korangi-road", name: "Korangi Road", kind: "junction", lat: 24.8100, lng: 67.0680 },
  { id: "j-dha-phase5", name: "DHA Phase 5", kind: "junction", lat: 24.8020, lng: 67.0480 },
  { id: "j-dha-phase6", name: "DHA Phase 6", kind: "junction", lat: 24.7970, lng: 67.0610 },
  { id: "j-gulshan", name: "Gulshan-e-Iqbal", kind: "junction", lat: 24.9200, lng: 67.0900 },
  { id: "j-nipa", name: "NIPA Chowrangi", kind: "junction", lat: 24.9180, lng: 67.0980 },
  { id: "j-liaquatabad", name: "Liaquatabad", kind: "junction", lat: 24.9050, lng: 67.0400 },
  { id: "j-north-nazimabad", name: "North Nazimabad", kind: "junction", lat: 24.9350, lng: 67.0380 },
  { id: "j-nagan", name: "Nagan Chowrangi", kind: "junction", lat: 24.9560, lng: 67.0630 },
  { id: "j-sohrab-goth", name: "Sohrab Goth", kind: "junction", lat: 24.9480, lng: 67.0880 },
  { id: "j-malir", name: "Malir Halt", kind: "junction", lat: 24.8930, lng: 67.1780 },
  { id: "j-airport", name: "Jinnah Airport", kind: "junction", lat: 24.9060, lng: 67.1610 },
  { id: "j-korangi-ind", name: "Korangi Industrial", kind: "junction", lat: 24.8300, lng: 67.1300 },
  { id: "j-landhi", name: "Landhi", kind: "junction", lat: 24.8500, lng: 67.1900 },
  { id: "j-lyari", name: "Lyari Expressway", kind: "junction", lat: 24.8850, lng: 67.0180 },
  { id: "j-orangi", name: "Orangi Town", kind: "junction", lat: 24.9500, lng: 66.9900 },
  { id: "j-baldia", name: "Baldia Town", kind: "junction", lat: 24.9100, lng: 66.9700 },
  { id: "j-seaview", name: "Sea View", kind: "junction", lat: 24.7950, lng: 67.0330 },
];

/**
 * Charging stations. `status` mirrors real-world availability and is what the
 * BFS filter uses to route around closed sites.
 */
export interface StationNode extends GraphNode {
  kind: "station";
  location: string;
  connector: string;
  powerKw: number;
  ratePerKwh: number;
  status: "available" | "busy" | "offline";
}

export const STATION_NODES: StationNode[] = [
  {
    id: "st-001", name: "Clifton Seaview Hub", kind: "station",
    lat: 24.8090, lng: 67.0290, location: "Clifton Block 4",
    connector: "CCS2", powerKw: 150, ratePerKwh: 42, status: "available",
  },
  {
    id: "st-002", name: "Saddar Downtown Point", kind: "station",
    lat: 24.8640, lng: 67.0290, location: "Saddar",
    connector: "CCS2", powerKw: 120, ratePerKwh: 40, status: "available",
  },
  {
    id: "st-003", name: "DHA Phase 6 Plaza", kind: "station",
    lat: 24.7990, lng: 67.0570, location: "DHA Phase 6",
    connector: "Type 2 AC", powerKw: 22, ratePerKwh: 28, status: "available",
  },
  {
    id: "st-004", name: "Gulshan Mega Charger", kind: "station",
    lat: 24.9230, lng: 67.0940, location: "Gulshan-e-Iqbal",
    connector: "CCS2", powerKw: 180, ratePerKwh: 45, status: "available",
  },
  {
    id: "st-005", name: "North Nazimabad Station", kind: "station",
    lat: 24.9380, lng: 67.0420, location: "North Nazimabad",
    connector: "CHAdeMO", powerKw: 100, ratePerKwh: 38, status: "available",
  },
  {
    id: "st-006", name: "Airport Express Charge", kind: "station",
    lat: 24.9020, lng: 67.1570, location: "Jinnah Airport",
    connector: "CCS2", powerKw: 150, ratePerKwh: 46, status: "available",
  },
  {
    id: "st-007", name: "Korangi Industrial Depot", kind: "station",
    lat: 24.8340, lng: 67.1260, location: "Korangi Industrial Area",
    connector: "CCS2", powerKw: 120, ratePerKwh: 39, status: "offline",
  },
  {
    id: "st-008", name: "Shahrah-e-Faisal Tower", kind: "station",
    lat: 24.8680, lng: 67.0660, location: "Shahrah-e-Faisal",
    connector: "CCS2", powerKw: 150, ratePerKwh: 44, status: "busy",
  },
  {
    id: "st-009", name: "Lyari Expressway Stop", kind: "station",
    lat: 24.8880, lng: 67.0220, location: "Lyari",
    connector: "Type 2 AC", powerKw: 22, ratePerKwh: 26, status: "available",
  },
  {
    id: "st-010", name: "Malir Cantt Charger", kind: "station",
    lat: 24.8960, lng: 67.1730, location: "Malir Cantt",
    connector: "CHAdeMO", powerKw: 100, ratePerKwh: 37, status: "offline",
  },
];

export const ALL_NODES: GraphNode[] = [...JUNCTIONS, ...STATION_NODES];

/* ------------------------------------------------------------------ */
/* Edges                                                               */
/* ------------------------------------------------------------------ */

/**
 * Road segments. Every station attaches to at least two junctions so that
 * alternative routes genuinely exist for DFS to discover.
 */
export const EDGES: EdgeSpec[] = [
  // --- City centre ---
  { from: "j-tower", to: "j-ii-chundrigar", road: "M. A. Jinnah Road" },
  { from: "j-ii-chundrigar", to: "j-saddar", road: "I. I. Chundrigar Road" },
  { from: "j-tower", to: "j-clifton-bridge", road: "Dr Ziauddin Ahmed Road" },
  { from: "j-saddar", to: "st-002", road: "Zaibunnisa Street" },
  { from: "j-saddar", to: "j-fsc", road: "Sharae Faisal" },
  { from: "st-002", to: "j-fsc", road: "Shahrah-e-Quaideen" },

  // --- Clifton / DHA ---
  { from: "j-clifton-bridge", to: "j-teen-talwar", road: "Clifton Road" },
  { from: "j-teen-talwar", to: "j-do-talwar", road: "Khayaban-e-Iqbal" },
  { from: "j-teen-talwar", to: "st-001", road: "Beach Avenue" },
  { from: "j-seaview", to: "st-001", road: "Sea View Road" },
  { from: "j-teen-talwar", to: "j-seaview", road: "Khayaban-e-Saadi" },
  { from: "j-do-talwar", to: "j-dha-phase5", road: "Khayaban-e-Shamsheer" },
  { from: "j-dha-phase5", to: "j-dha-phase6", road: "Khayaban-e-Bukhari" },
  { from: "j-dha-phase6", to: "st-003", road: "Khayaban-e-Ittehad" },
  { from: "j-dha-phase5", to: "st-003", road: "Khayaban-e-Muslim" },
  { from: "j-seaview", to: "j-dha-phase5", road: "Khayaban-e-Hafiz" },

  // --- Shahrah-e-Faisal corridor ---
  { from: "j-fsc", to: "j-nursery", road: "Shahrah-e-Faisal" },
  { from: "j-nursery", to: "j-shahrah-faisal", road: "Shahrah-e-Faisal" },
  { from: "j-shahrah-faisal", to: "st-008", road: "Shahrah-e-Faisal" },
  { from: "j-nursery", to: "st-008", road: "Service Road" },
  { from: "j-shahrah-faisal", to: "j-airport", road: "Shahrah-e-Faisal" },
  { from: "j-fsc", to: "j-korangi-road", road: "Korangi Road" },
  { from: "j-korangi-road", to: "j-dha-phase6", road: "Korangi Road" },
  { from: "j-korangi-road", to: "j-korangi-ind", road: "Korangi Creek Road" },
  { from: "j-korangi-ind", to: "st-007", road: "Mehran Highway" },
  { from: "j-korangi-ind", to: "j-landhi", road: "National Highway" },
  { from: "j-landhi", to: "st-007", road: "Landhi Link Road" },

  // --- Airport / Malir ---
  { from: "j-airport", to: "st-006", road: "Airport Approach Road" },
  { from: "j-airport", to: "j-malir", road: "Shahrah-e-Faisal" },
  { from: "j-malir", to: "st-010", road: "Malir Cantt Road" },
  { from: "j-malir", to: "st-006", road: "Star Gate Road" },
  { from: "j-malir", to: "j-landhi", road: "National Highway" },
  { from: "j-airport", to: "j-sohrab-goth", road: "University Road" },

  // --- Gulshan / NIPA ---
  { from: "j-shahrah-faisal", to: "j-gulshan", road: "University Road" },
  { from: "j-gulshan", to: "j-nipa", road: "University Road" },
  { from: "j-gulshan", to: "st-004", road: "Rashid Minhas Road" },
  { from: "j-nipa", to: "st-004", road: "University Road" },
  { from: "j-nipa", to: "j-sohrab-goth", road: "Rashid Minhas Road" },
  { from: "j-gulshan", to: "j-liaquatabad", road: "Shaheed-e-Millat Road" },

  // --- North Karachi ---
  { from: "j-liaquatabad", to: "j-north-nazimabad", road: "Nazimabad Road" },
  { from: "j-north-nazimabad", to: "st-005", road: "Shahrah-e-Noor Jehan" },
  { from: "j-north-nazimabad", to: "j-nagan", road: "Shahrah-e-Noor Jehan" },
  { from: "j-nagan", to: "st-005", road: "Nagan Link Road" },
  { from: "j-nagan", to: "j-sohrab-goth", road: "Superhighway" },
  { from: "j-nagan", to: "j-orangi", road: "Orangi Link Road" },
  { from: "j-orangi", to: "j-baldia", road: "Manghopir Road" },
  { from: "j-baldia", to: "j-lyari", road: "Mauripur Road" },

  // --- Lyari corridor ---
  { from: "j-lyari", to: "st-009", road: "Lyari Expressway" },
  { from: "j-lyari", to: "j-liaquatabad", road: "Lyari Expressway" },
  { from: "j-lyari", to: "j-ii-chundrigar", road: "Nishtar Road" },
  { from: "st-009", to: "j-liaquatabad", road: "Shahrah-e-Ghalib" },
  { from: "j-liaquatabad", to: "j-saddar", road: "Britto Road" },
];

/* ------------------------------------------------------------------ */
/* Graph construction                                                  */
/* ------------------------------------------------------------------ */

const EARTH_RADIUS_KM = 6371;

/** Great-circle (haversine) distance in kilometres. */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export type AdjacencyList = Map<string, Adjacent[]>;

export interface RoadGraph {
  nodes: Map<string, GraphNode>;
  adjacency: AdjacencyList;
}

/**
 * Builds the adjacency list once. Edges are undirected, so each spec is added
 * in both directions.
 */
export function buildGraph(extraNodes: GraphNode[] = [], extraEdges: EdgeSpec[] = []): RoadGraph {
  const nodes = new Map<string, GraphNode>();
  for (const n of [...ALL_NODES, ...extraNodes]) nodes.set(n.id, n);

  const adjacency: AdjacencyList = new Map();
  for (const id of nodes.keys()) adjacency.set(id, []);

  for (const e of [...EDGES, ...extraEdges]) {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    // Skip malformed edges rather than producing a broken graph.
    if (!a || !b) continue;

    const weight = haversine(a, b);
    adjacency.get(e.from)!.push({ to: e.to, weight, road: e.road });
    adjacency.get(e.to)!.push({ to: e.from, weight, road: e.road });
  }

  return { nodes, adjacency };
}

/** The static graph, with no user node attached. */
export const BASE_GRAPH = buildGraph();

export function isStation(node: GraphNode): node is StationNode {
  return node.kind === "station";
}

export function getStationNode(id: string): StationNode | undefined {
  return STATION_NODES.find((s) => s.id === id);
}
