/**
 * Lifetime-totals regression test against the user's Flighty fixture.
 *
 * Locks in the canonical numbers so future changes (factor updates, mapping
 * tweaks, calculator refactors) surface as explicit deltas to inspect.
 *
 * Current canonical totals (with 1.9× RF, cabin fallback = economy):
 *   DEFRA 2024:   186.68 t CO₂e
 *   TIM 3.0.0:    175.07 t CO₂e
 *
 * When intentionally changing factors, update these expected values along
 * with the change.
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { aircraftToIcao } from "../aircraft/data.ts";
import { routeDistanceKm } from "../airports/distance.ts";
import { parseFlightyCsv } from "../csv/parse.ts";
import { bootstrapTestData, repoPath } from "../test-helpers.ts";
import { calculateDefra, calculateTim } from "./index.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionInput, type EmissionOptions } from "./types.ts";

const FIXTURE = repoPath("sample_data/FlightyExport-2026-05-10 (2).csv");

beforeEach(() => bootstrapTestData());

function loadFixture() {
  return parseFlightyCsv(readFileSync(FIXTURE, "utf8")).flights;
}

function buildInput(f: ReturnType<typeof loadFixture>[number]): EmissionInput | null {
  const route = routeDistanceKm(f.from, f.to);
  if (!route) return null;
  return {
    distanceKm: route.km,
    cabinClass: f.cabinClass,
    aircraft: f.aircraft,
    aircraftId: f.aircraftId,
    fromIcao: route.from.icao,
    fromCountry: route.from.country,
    toIcao: route.to.icao,
    toCountry: route.to.country,
  };
}

describe("Lifetime totals (cabin fallback = economy, RF = 1.9×)", () => {
  const opts: EmissionOptions = DEFAULT_EMISSION_OPTIONS;
  const flights = loadFixture();

  it("DEFRA total locked at ~186.68 t", () => {
    let total = 0;
    let count = 0;
    for (const f of flights) {
      if (f.cancelled) continue;
      const input = buildInput(f);
      if (!input) continue;
      total += calculateDefra(input, opts).kgCo2e;
      count++;
    }
    expect(count).toBe(369);
    expect(total / 1000).toBeCloseTo(186.68, 1);
  });

  it("TIM total locked at ~175.07 t", () => {
    let total = 0;
    let count = 0;
    let fellBack = 0;
    for (const f of flights) {
      if (f.cancelled) continue;
      const input = buildInput(f);
      if (!input) continue;
      const r = calculateTim(input, opts);
      total += r.kgCo2e;
      count++;
      if (r.method === "DEFRA-2024") fellBack++;
    }
    expect(count).toBe(369);
    expect(fellBack).toBe(27); // exactly the rows with no aircraft string
    expect(total / 1000).toBeCloseTo(175.07, 1);
  });

  it("TIM is 5-7% lower than DEFRA (TIM is more refined; DEFRA is conservative)", () => {
    let defraTotal = 0;
    let timTotal = 0;
    for (const f of flights) {
      if (f.cancelled) continue;
      const input = buildInput(f);
      if (!input) continue;
      defraTotal += calculateDefra(input, opts).kgCo2e;
      timTotal += calculateTim(input, opts).kgCo2e;
    }
    const ratio = timTotal / defraTotal;
    expect(ratio).toBeGreaterThan(0.92);
    expect(ratio).toBeLessThan(0.96);
  });
});

describe("Aircraft mapping coverage on fixture", () => {
  const flights = loadFixture();

  it("hits exact match on ≥85% of flights with aircraft strings", () => {
    let exact = 0;
    let withAircraft = 0;
    for (const f of flights) {
      if (f.cancelled) continue;
      if (!f.aircraft) continue;
      withAircraft++;
      const l = aircraftToIcao(f.aircraft);
      if (l?.matchType === "exact") exact++;
    }
    expect(exact / withAircraft).toBeGreaterThan(0.85);
  });

  it("100% of flights with aircraft strings resolve (exact or substring)", () => {
    let unmapped = 0;
    let withAircraft = 0;
    for (const f of flights) {
      if (f.cancelled) continue;
      if (!f.aircraft) continue;
      withAircraft++;
      if (aircraftToIcao(f.aircraft) === null) unmapped++;
    }
    expect(unmapped).toBe(0);
    expect(withAircraft).toBeGreaterThan(330);
  });
});
