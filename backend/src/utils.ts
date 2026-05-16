import h3 from "h3-js";
import { tileToGeoJSON } from "@mapbox/tilebelt";
import type { Polygon } from "geojson";

/** Great-circle distance in km between two lat/lng points using the haversine formula. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

const BRAZIL_CAPITALS: { lat: number; lng: number }[] = [
  { lat: -9.9754,  lng: -67.8249 }, // Rio Branco — AC
  { lat: -9.6498,  lng: -35.7089 }, // Maceió — AL
  { lat: -3.119,   lng: -60.0217 }, // Manaus — AM
  { lat: 0.0349,   lng: -51.0694 }, // Macapá — AP
  { lat: -12.9714, lng: -38.5014 }, // Salvador — BA
  { lat: -3.7172,  lng: -38.5433 }, // Fortaleza — CE
  { lat: -15.7801, lng: -47.9292 }, // Brasília — DF
  { lat: -20.3155, lng: -40.3128 }, // Vitória — ES
  { lat: -16.6869, lng: -49.2648 }, // Goiânia — GO
  { lat: -2.5297,  lng: -44.3028 }, // São Luís — MA
  { lat: -19.9167, lng: -43.9345 }, // Belo Horizonte — MG
  { lat: -20.4697, lng: -54.6201 }, // Campo Grande — MS
  { lat: -15.6014, lng: -56.0979 }, // Cuiabá — MT
  { lat: -1.4558,  lng: -48.5044 }, // Belém — PA
  { lat: -7.1195,  lng: -34.845  }, // João Pessoa — PB
  { lat: -8.0539,  lng: -34.8811 }, // Recife — PE
  { lat: -5.0892,  lng: -42.8019 }, // Teresina — PI
  { lat: -25.4284, lng: -49.2733 }, // Curitiba — PR
  { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro — RJ
  { lat: -5.7945,  lng: -35.211  }, // Natal — RN
  { lat: -8.7612,  lng: -63.9004 }, // Porto Velho — RO
  { lat: 2.8235,   lng: -60.6758 }, // Boa Vista — RR
  { lat: -30.0346, lng: -51.2177 }, // Porto Alegre — RS
  { lat: -27.5954, lng: -48.548  }, // Florianópolis — SC
  { lat: -10.9472, lng: -37.0731 }, // Aracaju — SE
  { lat: -23.5505, lng: -46.6333 }, // São Paulo — SP
  { lat: -10.1689, lng: -48.3317 }, // Palmas — TO
];

/** Regional decay radius (km) at zoom 8 — halves every zoom level above 8 for local variation at high zoom */
const HEAT_DECAY_KM = 300;
const HEAT_DECAY_REF_ZOOM = 8;

/** Compute zoom-aware decay radius: 300km at zoom 8, ~2.4km at zoom 15 */
export function decayKmForZoom(z: number): number {
  return HEAT_DECAY_KM / Math.pow(2, Math.max(0, z - HEAT_DECAY_REF_ZOOM));
}

export function heatValue(lat: number, lng: number, decayKm = HEAT_DECAY_KM): number {
  if (!isFinite(lat) || !isFinite(lng)) {
    throw new Error(`heatValue: invalid coordinates (${lat}, ${lng})`);
  }
  let minDist = Infinity;
  for (const capital of BRAZIL_CAPITALS) {
    const d = haversineKm(lat, lng, capital.lat, capital.lng);
    if (d < minDist) minDist = d;
  }
  return Math.round(100 * Math.exp(-minDist / decayKm));
}
