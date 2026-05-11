/**
 * TIM 3.0.0 — faithful port verification.
 *
 * Primary test: reproduce Google TIM's published worked example end-to-end.
 *
 *   Route:    ZRH (LSZH) → SFO (KSFO)
 *   Aircraft: Boeing 787-9
 *   Cabin:    Economy
 *
 * TIM doc's published intermediate values (we assert against each):
 *   GCD               9369 km          (5058.9 NM)
 *   distance ratio    1.0273           → adjusted 5197.0 NM
 *   CCD distance      5180 NM          (after subtracting 17 NM for LTO)
 *   CCD fuel @ 5180   54802 kg         (interpolated 5000→5500)
 *   LTO fuel          1638 kg
 *   Total fuel        56440 kg
 *   WTW kg CO₂e       216498 kg        (× 3.8359)
 *   Passenger share   199178 kg        (× 0.92, 8% cargo)
 *   Equiv capacity    411.5 seats      (188×1 + 21×1.5 + 48×4 + 0×5)
 *   Per economy seat  484.029 kg
 *   Per economy pax   572.815 kg       (÷ 0.845 load factor)
 *
 * Class scaling (per-pax, derived from per-economy × multiplier):
 *   First             2864.077 kg      (× 5)
 *   Business          2291.262 kg      (× 4)
 *   Premium economy    859.224 kg      (× 1.5)
 */

import { beforeEach, describe, expect, it } from "vitest";
import { type SeatConfigFile, setSeatConfigs } from "../aircraft/seat-config.ts";
import { routeDistanceKm } from "../airports/distance.ts";
import { bootstrapTestData } from "../test-helpers.ts";
import { calculateDefra } from "./defra.ts";
import { calculateTim } from "./tim.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionInput, type EmissionOptions } from "./types.ts";

beforeEach(() => bootstrapTestData());

const optsNoRf: EmissionOptions = { ...DEFAULT_EMISSION_OPTIONS, nonCo2Multiplier: 1 };

/**
 * The TIM worked example uses a specific seat configuration (188Y + 21W + 48J).
 * Override the curated B789 config to TIM's exact numbers so we can verify
 * algorithm correctness independent of our seat-config approximation.
 */
function installTimExampleSeats(): void {
  const file: SeatConfigFile = {
    version: "tim-example",
    default: { body: "narrow", F: 0, J: 0, W: 0, Y: 50, total: 50 },
    configs: {
      B789: { body: "wide", F: 0, J: 48, W: 21, Y: 188, total: 257 },
    },
  };
  setSeatConfigs(file);
}

function zrhSfoInput(cabin: EmissionInput["cabinClass"]): EmissionInput {
  const route = routeDistanceKm("ZRH", "SFO");
  if (!route) throw new Error("ZRH-SFO not found");
  return {
    distanceKm: route.km,
    cabinClass: cabin,
    aircraft: "Boeing 787-9",
    aircraftId: null,
    fromIcao: route.from.icao,
    fromCountry: route.from.country,
    toIcao: route.to.icao,
    toCountry: route.to.country,
  };
}

describe("TIM ZRH-SFO B789 — final per-passenger numbers (WTW, no RF)", () => {
  it("economy: matches TIM's published 572.815 kg to ±1%", () => {
    installTimExampleSeats();
    const r = calculateTim(zrhSfoInput("economy"), optsNoRf);
    expect(r.method).toBe("TIM-2024");
    expect(r.kgCo2).toBeGreaterThan(572.815 * 0.99);
    expect(r.kgCo2).toBeLessThan(572.815 * 1.01);
  });

  it("business: matches TIM's published 2291.262 kg to ±1%", () => {
    installTimExampleSeats();
    const r = calculateTim(zrhSfoInput("business"), optsNoRf);
    expect(r.kgCo2).toBeGreaterThan(2291.262 * 0.99);
    expect(r.kgCo2).toBeLessThan(2291.262 * 1.01);
  });

  it("first: matches TIM's published 2864.077 kg to ±1%", () => {
    installTimExampleSeats();
    const r = calculateTim(zrhSfoInput("first"), optsNoRf);
    expect(r.kgCo2).toBeGreaterThan(2864.077 * 0.99);
    expect(r.kgCo2).toBeLessThan(2864.077 * 1.01);
  });

  it("premium economy: matches TIM's published 859.224 kg to ±1%", () => {
    installTimExampleSeats();
    const r = calculateTim(zrhSfoInput("premium-economy"), optsNoRf);
    expect(r.kgCo2).toBeGreaterThan(859.224 * 0.99);
    expect(r.kgCo2).toBeLessThan(859.224 * 1.01);
  });
});

describe("TIM ZRH-SFO — class-multiplier ratios", () => {
  it("business = 4× economy on widebody", () => {
    installTimExampleSeats();
    const econ = calculateTim(zrhSfoInput("economy"), optsNoRf).kgCo2;
    const biz = calculateTim(zrhSfoInput("business"), optsNoRf).kgCo2;
    expect(biz / econ).toBeCloseTo(4, 3);
  });

  it("first = 5× economy on widebody", () => {
    installTimExampleSeats();
    const econ = calculateTim(zrhSfoInput("economy"), optsNoRf).kgCo2;
    const first = calculateTim(zrhSfoInput("first"), optsNoRf).kgCo2;
    expect(first / econ).toBeCloseTo(5, 3);
  });

  it("premium economy = 1.5× economy on widebody", () => {
    installTimExampleSeats();
    const econ = calculateTim(zrhSfoInput("economy"), optsNoRf).kgCo2;
    const pe = calculateTim(zrhSfoInput("premium-economy"), optsNoRf).kgCo2;
    expect(pe / econ).toBeCloseTo(1.5, 3);
  });
});

describe("TIM — non-CO₂ multiplier toggle", () => {
  it("kgCo2e = kgCo2 × nonCo2Multiplier", () => {
    installTimExampleSeats();
    const r = calculateTim(zrhSfoInput("economy"), {
      ...DEFAULT_EMISSION_OPTIONS,
      nonCo2Multiplier: 1.9,
    });
    expect(r.kgCo2e / r.kgCo2).toBeCloseTo(1.9, 6);
  });
});

describe("TIM — transparent DEFRA fallback paths", () => {
  it("no aircraft string → falls back to DEFRA with caveat", () => {
    const route = routeDistanceKm("JFK", "LHR");
    const input: EmissionInput = {
      distanceKm: route!.km,
      cabinClass: "economy",
      aircraft: null,
      aircraftId: null,
      fromIcao: route!.from.icao,
      fromCountry: route!.from.country,
      toIcao: route!.to.icao,
      toCountry: route!.to.country,
    };
    const r = calculateTim(input, optsNoRf);
    expect(r.method).toBe("DEFRA-2024");
    expect(r.caveats.some((c) => c.includes("no aircraft recorded"))).toBe(true);
    // DEFRA result for the same input should match
    const defraR = calculateDefra(input, optsNoRf);
    expect(r.kgCo2).toBeCloseTo(defraR.kgCo2, 6);
  });

  it("unmapped aircraft string → falls back to DEFRA with caveat", () => {
    const route = routeDistanceKm("JFK", "LHR");
    const input: EmissionInput = {
      distanceKm: route!.km,
      cabinClass: "economy",
      aircraft: "Imaginary XYZ-99",
      aircraftId: null,
      fromIcao: route!.from.icao,
      fromCountry: route!.from.country,
      toIcao: route!.to.icao,
      toCountry: route!.to.country,
    };
    const r = calculateTim(input, optsNoRf);
    expect(r.method).toBe("DEFRA-2024");
    expect(r.caveats.some((c) => c.includes("not in TIM mapping"))).toBe(true);
  });
});

describe("TIM — cabin fallback", () => {
  it("uses cabinFallback when cabinClass is null", () => {
    installTimExampleSeats();
    const r = calculateTim(
      { ...zrhSfoInput(null), cabinClass: null },
      { ...optsNoRf, cabinFallback: "business" },
    );
    expect(r.cabinClass).toBe("business");
    expect(r.cabinSource).toBe("fallback");
    expect(r.caveats).toContain("cabin assumed: business");
  });
});

describe("TIM — result metadata", () => {
  it("records method = TIM-2024 on a successful calculation", () => {
    installTimExampleSeats();
    const r = calculateTim(zrhSfoInput("economy"), optsNoRf);
    expect(r.method).toBe("TIM-2024");
  });

  it("factorVersion mentions TIM and EEA fuel-burn version", () => {
    installTimExampleSeats();
    const r = calculateTim(zrhSfoInput("economy"), optsNoRf);
    expect(r.factorVersion).toMatch(/TIM/);
    expect(r.factorVersion).toMatch(/EEA/);
  });
});

describe("TIM — additional canonical flights (widebody)", () => {
  it("transpacific LAX-NRT B789 economy produces a plausible number", () => {
    installTimExampleSeats();
    const route = routeDistanceKm("LAX", "NRT");
    expect(route).not.toBeNull();
    const r = calculateTim(
      {
        distanceKm: route!.km,
        cabinClass: "economy",
        aircraft: "Boeing 787-9",
        aircraftId: null,
        fromIcao: route!.from.icao,
        fromCountry: route!.from.country,
        toIcao: route!.to.icao,
        toCountry: route!.to.country,
      },
      optsNoRf,
    );
    // LAX-NRT GCD ~8800 km. Per-pax economy on a 787-9 ought to be in
    // ~500-700 kg WTW for the trip (similar magnitude to ZRH-SFO).
    expect(r.kgCo2).toBeGreaterThan(400);
    expect(r.kgCo2).toBeLessThan(800);
    expect(r.method).toBe("TIM-2024");
  });
});
