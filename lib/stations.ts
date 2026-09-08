import { STATION_NODES } from "./graph/network";
import type { Station } from "./types";

/**
 * Station catalogue.
 *
 * The graph in `lib/graph/network.ts` is the single source of truth - stations
 * are nodes there, with coordinates - so this projects them into the flat shape
 * the charging UI and pricing code expect.
 */
export const STATIONS: Station[] = STATION_NODES.map((s) => ({
  id: s.id,
  name: s.name,
  location: s.location,
  connector: s.connector,
  powerKw: s.powerKw,
  ratePerKwh: s.ratePerKwh,
  status: s.status,
}));

export function getStation(id: string): Station | undefined {
  return STATIONS.find((s) => s.id === id);
}
