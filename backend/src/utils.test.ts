import { describe, it, expect } from "vitest";
import { haversineKm, heatValue, decayKmForZoom } from "./utils.js";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(-15.7801, -47.9292, -15.7801, -47.9292)).toBe(0);
  });

  it("returns ~1626 km between Brasília and Porto Alegre", () => {
    const dist = haversineKm(-15.7801, -47.9292, -30.0346, -51.2177);
    expect(dist).toBeGreaterThan(1500);
    expect(dist).toBeLessThan(1800);
  });

  it("returns ~2676 km between Manaus and São Paulo", () => {
    const dist = haversineKm(-3.119, -60.0217, -23.5505, -46.6333);
    expect(dist).toBeGreaterThan(2600);
    expect(dist).toBeLessThan(2800);
  });
});

describe("heatValue", () => {
  it("returns 100 for Brasília cell (at capital)", () => {
    // h3 cell containing Brasília at res 5
    // latLng -> cell -> heatValue should be near 100
    const val = heatValue(-15.7801, -47.9292);
    expect(val).toBe(100);
  });

  it("returns lower value for point far from all capitals", () => {
    // Deep Amazon interior (~750km from Porto Velho, nearest capital)
    const val = heatValue(-7.0, -72.0);
    expect(val).toBeLessThan(20);
  });

  it("uses smaller decay radius at high zoom — 1km away colder at zoom 15 than zoom 5", () => {
    const lat = -15.7801 + 0.009; // ~1km north of Brasília
    const lng = -47.9292;
    const hiZoom = heatValue(lat, lng, decayKmForZoom(15));
    const loZoom = heatValue(lat, lng, decayKmForZoom(5));
    expect(hiZoom).toBeLessThan(loZoom);
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
