import { describe, expect, it } from "vitest";
import { bootstrapTestData } from "../test-helpers.ts";
import { getAirport } from "./data.ts";
import { haversineKm, routeDistanceKm } from "./distance.ts";

bootstrapTestData();

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(40.6398, -73.7789, 40.6398, -73.7789)).toBeCloseTo(0, 1);
  });

  it("matches Wikipedia's JFK-LHR great-circle distance to within 0.1%", () => {
    // JFK 40.6398, -73.7789 → LHR 51.4775, -0.4614, published GCD = 5540 km
    const d = haversineKm(40.6398, -73.7789, 51.4775, -0.4614);
    expect(d).toBeGreaterThan(5535);
    expect(d).toBeLessThan(5545);
  });

  it("is symmetric (A→B = B→A)", () => {
    const ab = haversineKm(40.6398, -73.7789, 51.4775, -0.4614);
    const ba = haversineKm(51.4775, -0.4614, 40.6398, -73.7789);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it("handles antipodal points (~20,000 km)", () => {
    const d = haversineKm(0, 0, 0, 180);
    expect(d).toBeCloseTo(20015, 0);
  });

  it("handles polar coordinates", () => {
    // North pole to equator at 0° lon: a quarter of Earth's circumference
    const d = haversineKm(90, 0, 0, 0);
    expect(d).toBeCloseTo(10007.5, 0);
  });
});

describe("routeDistanceKm (IATA lookup)", () => {
  // Tolerances are generous — airport reference points and OurAirports
  // coordinate rounding can move the canonical published number by ~50 km.
  const knownRoutes: { from: string; to: string; expectedKm: number; tol: number }[] = [
    { from: "JFK", to: "LAX", expectedKm: 3974, tol: 80 },
    { from: "JFK", to: "LHR", expectedKm: 5540, tol: 30 },
    { from: "SFO", to: "NRT", expectedKm: 8270, tol: 50 },
    { from: "CDG", to: "ATL", expectedKm: 7080, tol: 30 },
    { from: "LGA", to: "BOS", expectedKm: 295, tol: 5 },
  ];

  it.each(knownRoutes)("$from → $to ≈ $expectedKm km", ({ from, to, expectedKm, tol }) => {
    const r = routeDistanceKm(from, to);
    expect(r).not.toBeNull();
    expect(r?.km).toBeGreaterThan(expectedKm - tol);
    expect(r?.km).toBeLessThan(expectedKm + tol);
  });

  it("returns null when origin airport unknown", () => {
    expect(routeDistanceKm("ZZZ", "JFK")).toBeNull();
  });

  it("returns null when destination airport unknown", () => {
    expect(routeDistanceKm("JFK", "ZZZ")).toBeNull();
  });

  it("populates ICAO and country on the returned Airport objects", () => {
    const r = routeDistanceKm("JFK", "LHR");
    expect(r?.from.icao).toBe("KJFK");
    expect(r?.from.country).toBe("US");
    expect(r?.to.icao).toBe("EGLL");
    expect(r?.to.country).toBe("GB");
  });

  it("is symmetric", () => {
    const a = routeDistanceKm("JFK", "LHR")?.km;
    const b = routeDistanceKm("LHR", "JFK")?.km;
    expect(a).toBeCloseTo(b!, 3);
  });
});

describe("getAirport", () => {
  it("normalises lowercase IATA codes", () => {
    expect(getAirport("jfk")).not.toBeNull();
    expect(getAirport("jfk")?.iata).toBe("JFK");
  });

  it("returns null for unknown codes", () => {
    expect(getAirport("ZZZ")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getAirport("")).toBeNull();
  });
});
