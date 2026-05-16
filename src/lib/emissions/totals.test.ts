/**
 * Lifetime-totals regression test against nicolas's *personal* Flighty
 * fixture. The fixture is gitignored — this suite is skipped on a fresh
 * clone or in CI without the file.
 *
 * The portable end-to-end regression lives in `src/lib/integration.test.ts`
 * using the committed canonical fixture.
 *
 * Current canonical totals (with 1.9× RF, cabin fallback = economy):
 *   DEFRA 2024:   186.68 t CO₂e
 *   TIM 3.0.0:    175.07 t CO₂e
 */

import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { aircraftToIcao } from "../aircraft/data.ts";
import { routeDistanceKm } from "../airports/distance.ts";
import { parseFlightyCsv } from "../csv/parse.ts";
import { bootstrapTestData, repoPath } from "../test-helpers.ts";
import { calculateDefra, calculateTim } from "./index.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionInput, type EmissionOptions } from "./types.ts";

const FIXTURE = repoPath("sample_data/personal-export.csv");
const HAVE_FIXTURE = existsSync(FIXTURE);

// Skip the whole file when the personal fixture isn't present (e.g. fresh
// clone or CI). The portable regression lives in integration.test.ts.
const describeIfFixture = HAVE_FIXTURE ? describe : describe.skip;

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

describeIfFixture("Lifetime totals (cabin fallback = economy, RF = 1.9×)", () => {
  const opts: EmissionOptions = DEFAULT_EMISSION_OPTIONS;
  // Lazy: vitest's describe.skip still executes the body to collect names,
  // so deferring loadFixture() into each it() avoids the read.

  it("DEFRA total locked at ~186.68 t", () => {
    const flights = loadFixture();
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
    const flights = loadFixture();
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
    const flights = loadFixture();
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

describeIfFixture("Aircraft mapping coverage on fixture", () => {
  // Lazy: vitest's describe.skip still executes the body to collect names,
  // so deferring loadFixture() into each it() avoids the read.

  it("hits exact match on ≥85% of flights with aircraft strings", () => {
    const flights = loadFixture();
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
    const flights = loadFixture();
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
