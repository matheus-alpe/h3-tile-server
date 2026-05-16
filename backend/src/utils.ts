import h3 from "h3-js";
import { tileToGeoJSON } from "@mapbox/tilebelt";
import type { Polygon } from "geojson";

const EARTH_CIRCUMFERENCE_KM = 40_075.017;
export const TARGET_CELLS_PER_TILE = 300;
const MAX_H3_RES = 12; // res 13+ impractical for any tile zoom

function h3ResForZoom(z: number): number {
  const tileKm = EARTH_CIRCUMFERENCE_KM / 2 ** z;
  const targetAreaKm2 = (tileKm * tileKm) / TARGET_CELLS_PER_TILE;

  // log-scale diff: cell counts span orders of magnitude, linear diff misleads
  let best = 0;
  let bestDiff = Infinity;
  for (let res = 0; res <= MAX_H3_RES; res++) {
    const diff = Math.abs(
      Math.log(h3.getHexagonAreaAvg(res, "km2")) - Math.log(targetAreaKm2),
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = res;
    }
  }
  return best;
}

// Precomputed at module load for zoom 0–24
export const ZOOM_TO_H3_RESOLUTION: Readonly<Record<number, number>> =
  Object.fromEntries(
    Array.from({ length: 25 }, (_, z) => [z, h3ResForZoom(z)]),
  );

export function getH3CellsForTile(
  x: number,
  y: number,
  z: number,
  h3Res: number,
): string[] {
  const { coordinates } = tileToGeoJSON([x, y, z]) as Polygon;
  let cells = h3.polygonToCells(coordinates[0]!, h3Res, true);

  if (cells.length === 0) {
    // Tile smaller than one H3 cell (very high zoom) — find the containing cell
    // from the tile center so we always return something renderable
    const ring = coordinates[0]!;
    const lngs = ring.map((p) => p[0]!);
    const lats = ring.map((p) => p[1]!);
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    cells = [h3.latLngToCell(centerLat, centerLng, h3Res)];
  }

  // Expand by 1 ring so cells straddling tile edges appear in both adjacent
  // tiles — prevents geometry clipping artifacts at tile boundaries
  const expanded = new Set<string>(cells);
  for (const cell of cells) {
    for (const neighbor of h3.gridDisk(cell, 1)) {
      expanded.add(neighbor);
    }
  }
  return [...expanded];
}

export function stableValue(cell: string): number {
  let h = 0;
  for (let i = 0; i < cell.length; i++) {
    h = (Math.imul(31, h) + cell.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 101; // 0–100
}
