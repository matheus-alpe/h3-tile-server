# Brazil State Capitals Heatmap — Design Spec

## Overview

Replace the random `stableValue` hash in the H3 tile server with a distance-based heat function
that renders a heatmap centered on all 27 Brazilian state capitals. Capital cells are hottest (100),
heat decays sharply with distance via exponential falloff, remote areas are cold (near 0).

## Backend Changes (`backend/src/utils.ts`)

### Data

Hardcode 27 Brazilian state capitals as `{ lat, lng }` tuples:

- All 26 states + Federal District (Brasília)
- Static array — no external API or DB needed

### New functions

**`haversineKm(lat1, lng1, lat2, lng2): number`**
Standard haversine formula. Returns great-circle distance in kilometers.

**`heatValue(cell: string): number`**
Replaces `stableValue`. Steps:
1. Get cell center via `h3.cellToLatLng(cell)` — returns `[lat, lng]`
2. Compute haversine distance to each of the 27 capitals
3. Take minimum distance (`minDistKm`)
4. Return `Math.round(100 * Math.exp(-minDistKm / 300))`

Remove `stableValue` entirely.

### Decay math

| distKm | value |
|--------|-------|
| 0      | 100   |
| 150    | 61    |
| 300    | 37    |
| 600    | 14    |
| 900    | 5     |
| 1200   | 2     |

Decay radius constant: **300 km**. Cities cluster along the coast and SE Brazil;
interior regions will read cold unless adjacent to a capital.

### `backend/src/h3.ts`

Single change: `value: stableValue(cell)` → `value: heatValue(cell)`

## Client Changes (`client/src/main.ts`)

Replace 3-stop color scale with 10-stop RdYlBu (reversed) palette:

| stop | hex       | label          |
|------|-----------|----------------|
| 0    | `#313695` | deep cold blue |
| 11   | `#4575b4` | blue           |
| 22   | `#74add1` | sky blue       |
| 33   | `#abd9e9` | pale cyan      |
| 44   | `#e0f3f8` | ice            |
| 55   | `#fee090` | warm yellow    |
| 66   | `#fdae61` | golden orange  |
| 77   | `#f46d43` | orange         |
| 88   | `#d73027` | red            |
| 100  | `#a50026` | deep hot red   |

Fill opacity unchanged at 0.35.

## Error Handling

No new failure modes. `h3.cellToLatLng` on invalid cells is already guarded by the
existing `try/catch` in `h3TileRender`.

## Out of Scope

- Caching (YAGNI — 27 haversine calls per cell is negligible)
- Dynamic capital data from external source
- Multiple capital influence blending (approach C, rejected)
- Opacity variations by heat value
