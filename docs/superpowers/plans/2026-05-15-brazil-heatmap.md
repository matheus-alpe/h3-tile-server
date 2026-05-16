# Brazil State Capitals Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the random `stableValue` hash with a distance-based heat function that colors H3 hexagons hot near Brazilian state capitals and cold farther away.

**Architecture:** Add `haversineKm` and `heatValue` to `utils.ts`, replacing `stableValue`. `heatValue` computes the great-circle distance from an H3 cell center to the nearest of 27 hardcoded Brazilian state capitals and applies exponential decay (`100 × e^(-dist/300)`). Client color scale updates to a 10-stop RdYlBu palette.

**Tech Stack:** TypeScript, h3-js, Express (existing); Vitest (new, for backend unit tests)

---

### Task 1: Add Vitest to backend

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`

- [ ] **Step 1: Install Vitest**

```bash
cd backend && npm install --save-dev vitest
```

Expected: vitest appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

In `backend/package.json`, add `"test": "vitest run"` to the `scripts` block:

```json
{
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Create vitest config**

Create `backend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Verify Vitest works**

```bash
cd backend && npm test
```

Expected: `No test files found` (or 0 tests run, no errors).

---

### Task 2: Write failing tests for `haversineKm`

**Files:**
- Create: `backend/src/utils.test.ts`

- [ ] **Step 1: Create test file**

Create `backend/src/utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { haversineKm } from "./utils.js";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(-15.7801, -47.9292, -15.7801, -47.9292)).toBe(0);
  });

  it("returns ~2090 km between Brasília and Porto Alegre", () => {
    const dist = haversineKm(-15.7801, -47.9292, -30.0346, -51.2177);
    expect(dist).toBeGreaterThan(2000);
    expect(dist).toBeLessThan(2200);
  });

  it("returns ~2676 km between Manaus and São Paulo", () => {
    const dist = haversineKm(-3.119, -60.0217, -23.5505, -46.6333);
    expect(dist).toBeGreaterThan(2600);
    expect(dist).toBeLessThan(2800);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && npm test
```

Expected: FAIL — `haversineKm` not exported from `utils.ts`.

---

### Task 3: Implement `haversineKm` and pass tests

**Files:**
- Modify: `backend/src/utils.ts`

- [ ] **Step 1: Add `haversineKm` export to `utils.ts`**

Open `backend/src/utils.ts`. After the imports block, add:

```ts
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
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
cd backend && npm test
```

Expected: 3 tests pass in `utils.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/vitest.config.ts backend/src/utils.ts backend/src/utils.test.ts
git commit -m "feat: add haversineKm + vitest setup"
```

---

### Task 4: Write failing tests for `heatValue`

**Files:**
- Modify: `backend/src/utils.test.ts`

- [ ] **Step 1: Add `heatValue` tests to `utils.test.ts`**

First, update the import at the top of `backend/src/utils.test.ts` to include `heatValue`:

```ts
// Change:
import { haversineKm } from "./utils.js";
// To:
import { haversineKm, heatValue } from "./utils.js";
```

Then append the new describe block at the bottom of the file:

```ts
describe("heatValue", () => {
  it("returns 100 for Brasília cell (at capital)", () => {
    // h3 cell containing Brasília at res 5
    // latLng -> cell -> heatValue should be near 100
    const val = heatValue(-15.7801, -47.9292);
    expect(val).toBe(100);
  });

  it("returns lower value for point far from all capitals", () => {
    // Amazon interior, ~700km from nearest capital (Manaus)
    const val = heatValue(-5.0, -65.0);
    expect(val).toBeLessThan(20);
  });

  it("returns 0–100 range for any point", () => {
    const points: [number, number][] = [
      [-15.7801, -47.9292],
      [-23.5505, -46.6333],
      [-5.0, -65.0],
      [-30.0346, -51.2177],
    ];
    for (const [lat, lng] of points) {
      const val = heatValue(lat, lng);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});
```

Note: `heatValue` will be refactored in Task 5 to accept `(lat, lng)` directly so it can be tested without h3 cell IDs. The call site in `h3.ts` will pass `h3.cellToLatLng(cell)`.

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
cd backend && npm test
```

Expected: 3 new tests FAIL — `heatValue` not exported.

---

### Task 5: Implement `heatValue` and `BRAZIL_CAPITALS`, replace `stableValue`

**Files:**
- Modify: `backend/src/utils.ts`
- Modify: `backend/src/h3.ts`

- [ ] **Step 1: Add `BRAZIL_CAPITALS` and `heatValue` to `utils.ts`**

In `backend/src/utils.ts`, after the `haversineKm` function, add:

```ts
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

export function heatValue(lat: number, lng: number): number {
  let minDist = Infinity;
  for (const capital of BRAZIL_CAPITALS) {
    const d = haversineKm(lat, lng, capital.lat, capital.lng);
    if (d < minDist) minDist = d;
  }
  return Math.round(100 * Math.exp(-minDist / 300));
}
```

- [ ] **Step 2: Remove `stableValue` from `utils.ts`**

Delete the `stableValue` function entirely from `backend/src/utils.ts`:

```ts
// Remove this entire function:
export function stableValue(cell: string): number {
  let h = 0;
  for (let i = 0; i < cell.length; i++) {
    h = (Math.imul(31, h) + cell.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 101;
}
```

- [ ] **Step 3: Update `h3.ts` — swap import and call site**

In `backend/src/h3.ts`:

Replace the import line:
```ts
// Before:
import {
  ZOOM_TO_H3_RESOLUTION,
  getH3CellsForTile,
  stableValue,
} from "./utils.js";

// After:
import {
  ZOOM_TO_H3_RESOLUTION,
  getH3CellsForTile,
  heatValue,
} from "./utils.js";
```

Replace the value property in the feature mapping:
```ts
// Before:
value: stableValue(cell),

// After:
const [lat, lng] = h3.cellToLatLng(cell);
```

And in the `properties` block:
```ts
properties: {
  h3: cell,
  resolution: h3.getResolution(cell),
  value: heatValue(lat, lng),
},
```

The full updated feature mapping block in `h3.ts` should look like:

```ts
const features: Feature[] = cells.map((cell) => {
  const boundary = h3.cellToBoundary(cell, true);
  const [lat, lng] = h3.cellToLatLng(cell);

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [boundary],
    },
    properties: {
      h3: cell,
      resolution: h3.getResolution(cell),
      value: heatValue(lat, lng),
    },
  };
});
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd backend && npm test
```

Expected: all 6 tests pass (3 haversine + 3 heatValue).

- [ ] **Step 5: Type-check**

```bash
cd backend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/utils.ts backend/src/utils.test.ts backend/src/h3.ts
git commit -m "feat: replace stableValue with distance-based heatValue from Brazil capitals"
```

---

### Task 6: Update client color scale

**Files:**
- Modify: `client/src/main.ts`

- [ ] **Step 1: Replace color stops in `main.ts`**

In `client/src/main.ts`, find the `fill-color` paint property and replace it:

```ts
// Before:
"fill-color": [
  "interpolate",
  ["linear"],
  ["get", "value"],
  0,   "#3288bd",
  50,  "#c27866",
  100, "#e6f598",
],

// After:
"fill-color": [
  "interpolate",
  ["linear"],
  ["get", "value"],
  0,   "#313695",
  11,  "#4575b4",
  22,  "#74add1",
  33,  "#abd9e9",
  44,  "#e0f3f8",
  55,  "#fee090",
  66,  "#fdae61",
  77,  "#f46d43",
  88,  "#d73027",
  100, "#a50026",
],
```

- [ ] **Step 2: Type-check client**

```bash
cd client && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/main.ts
git commit -m "feat: update heatmap color scale to 10-stop RdYlBu"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start backend**

```bash
cd backend && npm run dev
```

Expected: `server running on http://localhost:3000`

- [ ] **Step 2: Start client**

In a second terminal:

```bash
cd client && npm run dev
```

Expected: Vite dev server starts, URL shown (typically `http://localhost:5173`).

- [ ] **Step 3: Open browser and verify**

Open the client URL. Pan to Brazil. Verify:
- Major cities (São Paulo, Rio, Brasília, Fortaleza, etc.) show red/orange hexagons
- ~300 km from a capital: yellow/orange
- Amazon interior / far from capitals: blue hexagons
- No visual seams or broken tiles

- [ ] **Step 4: Click a hot cell near a capital**

Expected popup shows `value` close to 100.

- [ ] **Step 5: Click a cold cell far from capitals**

Expected popup shows `value` close to 0.
