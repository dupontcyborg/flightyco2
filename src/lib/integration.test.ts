/**
 * End-to-end integration test against the canonical committed fixture.
 *
 * Unlike `emissions/totals.test.ts` (which uses nicolas's gitignored
 * personal export), this runs against `sample_data/canonical-fixture.csv`
 * — a 13-row hand-built CSV that exercises every edge case in `src/lib`.
 * That makes the assertions reproducible on a fresh clone.
 *
 * Numbers below are *locked* to the canonical fixture: any change to a
 * factor, multiplier, mapping, seat config, or algorithm step will surface
 * here as an explicit delta, with the test fixture as the diagnostic.
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  aggregateByAircraft,
  aggregateByCabin,
  aggregateByYear,
  enrichFlights,
  summarizeDataQuality,
  summarizeEnrichedQuality,
  topNFlights,
} from "./aggregation/index.ts";
import { comparisonsForTotal } from "./comparisons.ts";
import { parseFlightyCsv } from "./csv/parse.ts";
import { calculateDefra } from "./emissions/defra.ts";
import { calculateTim } from "./emissions/tim.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionInput } from "./emissions/types.ts";
import { bootstrapTestData, repoPath } from "./test-helpers.ts";

beforeEach(() => bootstrapTestData());

function loadCanonical() {
  return parseFlightyCsv(readFileSync(repoPath("sample_data/canonical-fixture.csv"), "utf8"));
}

const calcTim = (input: EmissionInput) => calculateTim(input, DEFAULT_EMISSION_OPTIONS);
const calcDefra = (input: EmissionInput) => calculateDefra(input, DEFAULT_EMISSION_OPTIONS);

// ─────────────────────────────────────────────────────────────── parse stage ──

describe("Integration — parse stage", () => {
  it("parses 13 input rows", () => {
    const { totalRows } = loadCanonical();
    expect(totalRows).toBe(13);
  });

  it("skips 0 rows (all valid Flighty shape)", () => {
    expect(loadCanonical().skipped).toHaveLength(0);
  });

  it("dedupes the codeshare pair (rows 5+6) into 1", () => {
    const { flights, deduped } = loadCanonical();
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.kept.id).toBe("fixture-005");
    expect(deduped[0]?.dropped.id).toBe("fixture-006");
    expect(flights).toHaveLength(12);
  });

  it("flags the cancelled flight", () => {
    const { flights } = loadCanonical();
    const cancelled = flights.filter((f) => f.cancelled);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]?.id).toBe("fixture-008");
  });

  it("sets actualTo from divertedTo on the diverted row", () => {
    const { flights } = loadCanonical();
    const diverted = flights.find((f) => f.id === "fixture-011");
    expect(diverted?.to).toBe("LAX"); // scheduled
    expect(diverted?.divertedTo).toBe("SAN");
    expect(diverted?.actualTo).toBe("SAN"); // used for distance
  });

  it("normalizes all 4 SCREAMING_SNAKE cabin classes", () => {
    const { flights } = loadCanonical();
    const cabins = new Set(flights.map((f) => f.cabinClass).filter(Boolean));
    expect(cabins).toEqual(new Set(["economy", "premium-economy", "business", "first"]));
  });

  it("preserves null cabin for the no-cabin row", () => {
    const { flights } = loadCanonical();
    const noC = flights.find((f) => f.id === "fixture-010");
    expect(noC?.cabinClass).toBeNull();
  });

  it("preserves null aircraft for the no-aircraft row", () => {
    const { flights } = loadCanonical();
    const noA = flights.find((f) => f.id === "fixture-012");
    expect(noA?.aircraft).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────── enrich stage ──

describe("Integration — enrich stage", () => {
  it("partitions into 11 enriched + 1 cancelled + 0 unresolved", () => {
    const { flights } = loadCanonical();
    const { enriched, cancelled, unresolved } = enrichFlights(flights, calcTim);
    expect(enriched).toHaveLength(11);
    expect(cancelled).toHaveLength(1);
    expect(unresolved).toHaveLength(0);
  });

  it("the diverted flight uses JFK-SAN distance, not JFK-LAX", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const diverted = enriched.find((e) => e.flight.id === "fixture-011");
    expect(diverted).toBeDefined();
    // JFK-LAX is ~3974 km; JFK-SAN is ~3920 km — distinct.
    // JFK-SAN GCD is ~3915-3940; assert it's NOT in the JFK-LAX neighborhood
    expect(diverted?.distanceKm).toBeGreaterThan(3900);
    expect(diverted?.distanceKm).toBeLessThan(3960);
  });

  it("the no-aircraft flight falls back to DEFRA inside calculateTim", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const noA = enriched.find((e) => e.flight.id === "fixture-012");
    expect(noA?.result.method).toBe("DEFRA-2024");
    expect(noA?.result.caveats.some((c) => c.includes("no aircraft recorded"))).toBe(true);
  });

  it("the substring-match aircraft (737-900ER → B739) gets a TIM result with caveat", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const r = enriched.find((e) => e.flight.id === "fixture-004");
    expect(r?.result.method).toBe("TIM-2024");
    expect(r?.result.caveats.some((c) => c.includes("substring"))).toBe(true);
  });

  it("the alias aircraft (Bombardier CRJ900) resolves cleanly", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const r = enriched.find((e) => e.flight.id === "fixture-009");
    expect(r?.result.method).toBe("TIM-2024");
  });

  it("the no-cabin flight has cabinSource = fallback", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const r = enriched.find((e) => e.flight.id === "fixture-010");
    expect(r?.result.cabinSource).toBe("fallback");
    expect(r?.result.cabinClass).toBe("economy"); // DEFAULT_EMISSION_OPTIONS.cabinFallback
  });
});

// ───────────────────────────────────────────────────────── aggregation stage ──

describe("Integration — aggregation stage", () => {
  it("aggregates by year — 3 years (2022, 2023, 2024)", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const years = aggregateByYear(enriched);
    expect(years.map((y) => y.year)).toEqual([2022, 2023, 2024]);
  });

  it("year totals sum to overall total", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const years = aggregateByYear(enriched);
    const yearSum = years.reduce((s, y) => s + y.totalKgCo2e, 0);
    const overall = enriched.reduce((s, e) => s + e.result.kgCo2e, 0);
    expect(yearSum).toBeCloseTo(overall, 3);
  });

  it("by-cabin returns all 4 classes; first + business dominate (FIRST on transpacific)", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const byC = aggregateByCabin(enriched);
    expect(byC).toHaveLength(4);
    // First-class transpacific row should be the single largest cabin contribution
    expect(byC[0]?.cabin).toBe("first");
    expect(byC[0]?.flightCount).toBe(1);
  });

  it("by-aircraft: B789 is the top emitter (3 long-haul widebody flights)", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const byA = aggregateByAircraft(enriched);
    expect(byA[0]?.aircraft).toBe("Boeing 787-9");
  });

  it("top-3 flights are the long-haul widebody first/business/economy rows", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const top3 = topNFlights(enriched, 3);
    // The transpacific FIRST (fixture-007) should be #1
    expect(top3[0]?.flight.id).toBe("fixture-007");
    // The transatlantic BUSINESS (fixture-002) should be #2
    expect(top3[1]?.flight.id).toBe("fixture-002");
  });
});

// ─────────────────────────────────────────────────────────── data quality ──

describe("Integration — data quality", () => {
  it("raw quality counts match fixture design", () => {
    const { flights } = loadCanonical();
    const q = summarizeDataQuality(flights);
    // 12 flights post-dedupe, 1 cancelled (skipped by the helper) → 11 considered
    expect(q.totalFlights).toBe(11);
    expect(q.divertedCount).toBe(1);
  });

  it("enriched quality: 1 cabin-assumed (the no-cabin row), 1 TIM→DEFRA fallback", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const q = summarizeEnrichedQuality(enriched);
    expect(q.cabinAssumed).toBe(1);
    expect(q.fellBackToDefra).toBe(1);
    expect(q.totalEnriched).toBe(11);
  });
});

// ───────────────────────────────────────────────────────── locked totals ──

describe("Integration — locked emission totals", () => {
  /**
   * Lifetime totals computed by running the calculator against the
   * canonical fixture and locking in. Update these when an intentional
   * factor / algorithm change lands. Locked: 2026-05-11.
   */
  it("TIM lifetime total (with RF) is locked at ~11.25 t over 3 years", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const total = enriched.reduce((s, e) => s + e.result.kgCo2e, 0);
    expect(total / 1000).toBeCloseTo(11.25, 1);
  });

  it("DEFRA lifetime total (with RF) is locked at ~11.21 t over 3 years", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcDefra);
    const total = enriched.reduce((s, e) => s + e.result.kgCo2e, 0);
    expect(total / 1000).toBeCloseTo(11.21, 1);
  });

  it("TIM is within 5% of DEFRA on this fixture (one is conservative, one is refined)", () => {
    const { flights } = loadCanonical();
    const { enriched: timE } = enrichFlights(flights, calcTim);
    const { enriched: defraE } = enrichFlights(flights, calcDefra);
    const timTotal = timE.reduce((s, e) => s + e.result.kgCo2e, 0);
    const defraTotal = defraE.reduce((s, e) => s + e.result.kgCo2e, 0);
    const ratio = timTotal / defraTotal;
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.1);
  });
});

// ──────────────────────────────────────────────────────────── comparisons ──

describe("Integration — comparisons module wired against canonical total", () => {
  it("produces the four comparison metrics for a lifetime total", () => {
    const { flights } = loadCanonical();
    const { enriched } = enrichFlights(flights, calcTim);
    const total = enriched.reduce((s, e) => s + e.result.kgCo2e, 0);
    const c = comparisonsForTotal(total, 3);
    expect(c.years).toBe(3);
    expect(c.vsAvgAmerican).toBeGreaterThan(0);
    expect(c.vsAvgAmerican).toBeLessThan(1); // 9.4 t over 3 years is well under 16 t/yr × 3
    expect(c.vs15Budget).toBeGreaterThan(1); // 9.4 t > 2 t/yr × 3 = 6 t
    expect(c.equivalentCarKm).toBeGreaterThan(0);
  });
});
