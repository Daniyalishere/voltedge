"use client";

import dynamic from "next/dynamic";

/**
 * Leaflet reaches for `window` as soon as it is imported, so the map is loaded
 * client-side only. The placeholder keeps the layout from shifting.
 */
export const MapCanvas = dynamic(
  () => import("./LeafletMap").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="glass grid h-[640px] place-items-center rounded-2xl">
        <div className="text-center">
          <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-volt-500/25 border-t-volt-400" />
          <p className="mt-4 text-sm text-mist-500">Loading Karachi map...</p>
        </div>
      </div>
    ),
  }
);
