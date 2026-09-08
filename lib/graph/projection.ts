/**
 * Maps Karachi latitude/longitude onto the SVG viewport used by the map.
 *
 * A plain equirectangular projection is accurate enough over a single city,
 * with longitude scaled by cos(latitude) so the aspect ratio stays true.
 */

export const MAP_BOUNDS = {
  minLat: 24.780,
  maxLat: 24.970,
  minLng: 66.955,
  maxLng: 67.205,
};

export const VIEW = { width: 1000, height: 760 };

const MID_LAT_RAD = ((MAP_BOUNDS.minLat + MAP_BOUNDS.maxLat) / 2) * (Math.PI / 180);
const LNG_SCALE = Math.cos(MID_LAT_RAD);

export interface Point {
  x: number;
  y: number;
}

export function project(lat: number, lng: number): Point {
  const spanLng = (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng) * LNG_SCALE;
  const spanLat = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;

  const x = (((lng - MAP_BOUNDS.minLng) * LNG_SCALE) / spanLng) * VIEW.width;
  // SVG y grows downward, so north maps to a smaller y.
  const y = VIEW.height - ((lat - MAP_BOUNDS.minLat) / spanLat) * VIEW.height;

  return { x, y };
}

/** Inverse of `project`, for turning a click position back into coordinates. */
export function unproject(x: number, y: number): { lat: number; lng: number } {
  const spanLng = (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng) * LNG_SCALE;
  const spanLat = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;

  const lng = MAP_BOUNDS.minLng + ((x / VIEW.width) * spanLng) / LNG_SCALE;
  const lat = MAP_BOUNDS.minLat + ((VIEW.height - y) / VIEW.height) * spanLat;

  return { lat, lng };
}

export function clampToBounds(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.min(MAP_BOUNDS.maxLat, Math.max(MAP_BOUNDS.minLat, lat)),
    lng: Math.min(MAP_BOUNDS.maxLng, Math.max(MAP_BOUNDS.minLng, lng)),
  };
}

/** A random point inside the mapped area, for the "drop me anywhere" button. */
export function randomPoint(): { lat: number; lng: number } {
  // Inset slightly so the pin never lands flush against the frame.
  const pad = 0.06;
  const lat =
    MAP_BOUNDS.minLat +
    (pad + Math.random() * (1 - 2 * pad)) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  const lng =
    MAP_BOUNDS.minLng +
    (pad + Math.random() * (1 - 2 * pad)) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  return { lat, lng };
}
