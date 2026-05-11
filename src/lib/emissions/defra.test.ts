/**
 * DEFRA 2024 calculator — verify factor application against the published
 * UK Gov spreadsheet values (International to/from non-UK tier, no RF).
 *
 *   Economy:          0.07948
 *   Premium economy:  0.12716
 *   Business:         0.23047
 *   First:            0.31789
 *
 * Source: UK Gov GHG Conversion Factors 2024 v1.1, "Business travel- air".
 */

import { describe, expect, it } from "vitest";
import type { CabinClass } from "../csv/schema.ts";
import { calculateDefra } from "./defra.ts";
import { DEFRA_FACTORS_KG_PER_PKM, defraBucket } from "./factors/defra-2024.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionOptions } from "./types.ts";

const noRfNoUplift: EmissionOptions = {
  ...DEFAULT_EMISSION_OPTIONS,
  nonCo2Multiplier: 1,
  routingUplift: 1,
};

describe("DEFRA 2024 — verified factor application (no RF, no routing uplift)", () => {
  const cases: { distance: number; cabin: CabinClass; expected: number }[] = [
    { distance: 1000, cabin: "economy", expected: 1000 * 0.07948 },
    { distance: 1000, cabin: "premium-economy", expected: 1000 * 0.12716 },
    { distance: 1000, cabin: "business", expected: 1000 * 0.23047 },
    { distance: 1000, cabin: "first", expected: 1000 * 0.31789 },
    { distance: 5000, cabin: "economy", expected: 5000 * 0.07948 },
    { distance: 5000, cabin: "business", expected: 5000 * 0.23047 },
    { distance: 100, cabin: "economy", expected: 100 * 0.07948 },
  ];

  it.each(cases)("$distance km · $cabin → $expected kg CO₂e", ({ distance, cabin, expected }) => {
    const r = calculateDefra(
      { distanceKm: distance, cabinClass: cabin, aircraft: null, aircraftId: null },
      noRfNoUplift,
    );
    expect(r.kgCo2).toBeCloseTo(expected, 4);
  });
});

describe("DEFRA 2024 — RF multiplier toggle", () => {
  it("applies 1.9× when nonCo2Multiplier=1.9", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      { ...noRfNoUplift, nonCo2Multiplier: 1.9 },
    );
    expect(r.kgCo2e).toBeCloseTo(1000 * 0.07948 * 1.9, 4);
  });

  it("applies 1.7× when nonCo2Multiplier=1.7 (DEFRA's internal value)", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      { ...noRfNoUplift, nonCo2Multiplier: 1.7 },
    );
    expect(r.kgCo2e).toBeCloseTo(1000 * 0.07948 * 1.7, 4);
  });

  it("equals kgCo2 when nonCo2Multiplier=1 (RF disabled)", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      noRfNoUplift,
    );
    expect(r.kgCo2e).toBe(r.kgCo2);
  });
});

describe("DEFRA 2024 — routing uplift", () => {
  it("multiplies great-circle distance by routingUplift (1.09 default)", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      { ...noRfNoUplift, routingUplift: 1.09 },
    );
    expect(r.kgCo2).toBeCloseTo(1000 * 1.09 * 0.07948, 4);
    expect(r.distanceKm).toBeCloseTo(1090, 4);
  });

  it("distanceKm in result reflects the uplift", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      { ...noRfNoUplift, routingUplift: 1.5 },
    );
    expect(r.distanceKm).toBe(1500);
  });
});

describe("DEFRA 2024 — cabin fallback", () => {
  it("applies cabinFallback when cabinClass is null", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: null, aircraft: null, aircraftId: null },
      { ...noRfNoUplift, cabinFallback: "business" },
    );
    expect(r.cabinClass).toBe("business");
    expect(r.cabinSource).toBe("fallback");
    expect(r.caveats).toContain("cabin assumed: business");
  });

  it('marks cabinSource = "recorded" when cabin is provided', () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      noRfNoUplift,
    );
    expect(r.cabinSource).toBe("recorded");
    expect(r.caveats).toHaveLength(0);
  });
});

describe("DEFRA 2024 — distance bucket categorization (UI helper only)", () => {
  it("classifies 0 km as domestic", () => expect(defraBucket(0)).toBe("domestic"));
  it("classifies 463 km as domestic (inclusive upper bound)", () =>
    expect(defraBucket(463)).toBe("domestic"));
  it("classifies 464 km as short-haul", () => expect(defraBucket(464)).toBe("short-haul"));
  it("classifies 3700 km as short-haul (inclusive)", () =>
    expect(defraBucket(3700)).toBe("short-haul"));
  it("classifies 3701 km as long-haul", () => expect(defraBucket(3701)).toBe("long-haul"));
  it("classifies very long distances as long-haul", () =>
    expect(defraBucket(15000)).toBe("long-haul"));
});

describe("DEFRA 2024 — result metadata", () => {
  it("records method = DEFRA-2024", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      noRfNoUplift,
    );
    expect(r.method).toBe("DEFRA-2024");
  });

  it("records the factor table version (DEFRA-2024-v1.1)", () => {
    const r = calculateDefra(
      { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
      noRfNoUplift,
    );
    expect(r.factorVersion).toBe("DEFRA-2024-v1.1");
  });
});

describe("DEFRA 2024 — factor table sanity", () => {
  it("has all four cabin classes", () => {
    for (const cabin of ["economy", "premium-economy", "business", "first"] as CabinClass[]) {
      expect(DEFRA_FACTORS_KG_PER_PKM[cabin]).toBeGreaterThan(0);
    }
  });

  it("business > premium-economy > economy (monotonic with luxury)", () => {
    expect(DEFRA_FACTORS_KG_PER_PKM.business).toBeGreaterThan(
      DEFRA_FACTORS_KG_PER_PKM["premium-economy"],
    );
    expect(DEFRA_FACTORS_KG_PER_PKM["premium-economy"]).toBeGreaterThan(
      DEFRA_FACTORS_KG_PER_PKM.economy,
    );
  });

  it("first > business", () => {
    expect(DEFRA_FACTORS_KG_PER_PKM.first).toBeGreaterThan(DEFRA_FACTORS_KG_PER_PKM.business);
  });
});
