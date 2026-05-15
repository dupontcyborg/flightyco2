import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { parseFlightyCsv } from "../csv/parse.ts";
import type { CabinClass, ParsedFlight } from "../csv/schema.ts";
import { calculateTim } from "../emissions/tim.ts";
import {
  DEFAULT_EMISSION_OPTIONS,
  type EmissionInput,
  type EmissionResult,
} from "../emissions/types.ts";
import { bootstrapTestData, repoPath } from "../test-helpers.ts";
import { aggregateByAircraft } from "./by-aircraft.ts";
import { aggregateByCabin } from "./by-cabin.ts";
import { aggregateByMonth } from "./by-month.ts";
import { aggregateByYear } from "./by-year.ts";
import { summarizeDataQuality, summarizeEnrichedQuality } from "./data-quality.ts";
import { enrichFlights } from "./enrich.ts";
import { topNFlights } from "./top-n.ts";
import type { EnrichedFlight } from "./types.ts";

beforeEach(() => bootstrapTestData());

function loadFixture(): ParsedFlight[] {
  return parseFlightyCsv(
    readFileSync(repoPath("sample_data/FlightyExport-2026-05-10 (2).csv"), "utf8"),
  ).flights;
}

const calcTim = (input: EmissionInput): EmissionResult =>
  calculateTim(input, DEFAULT_EMISSION_OPTIONS);

// ──────────────────────────────────────────────────────────────── enrichFlights ──

describe("enrichFlights", () => {
  it("partitions into enriched / cancelled / unresolved", () => {
    const flights = loadFixture();
    const { enriched, cancelled, unresolved } = enrichFlights(flights, calcTim);
    expect(cancelled).toHaveLength(4);
    expect(unresolved).toHaveLength(0);
    expect(enriched).toHaveLength(369);
  });

  it("populates year/month/date/haulBucket on each enriched flight", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    for (const e of enriched.slice(0, 3)) {
      expect(e.year).toBeGreaterThanOrEqual(2008);
      expect(e.year).toBeLessThanOrEqual(2026);
      expect(e.month).toBeGreaterThanOrEqual(1);
      expect(e.month).toBeLessThanOrEqual(12);
      expect(e.distanceKm).toBeGreaterThan(0);
      expect(["domestic", "short-haul", "long-haul"]).toContain(e.haulBucket);
    }
  });

  it("uses actualTo for distance (diverted-aware)", () => {
    // Synthetic: scheduled JFK→LAX, diverted to SFO. Distance should be JFK→SFO.
    const flight: ParsedFlight = {
      id: "test",
      date: "2024-06-01",
      from: "JFK",
      to: "LAX",
      divertedTo: "SFO",
      actualTo: "SFO",
      cancelled: false,
      airline: "AA",
      flightNumber: "100",
      aircraft: "Boeing 787-9",
      aircraftId: null,
      cabinClass: "economy",
      scheduledDeparture: null,
      quality: "high",
    };
    const { enriched } = enrichFlights([flight], calcTim);
    expect(enriched).toHaveLength(1);
    // JFK→SFO is ~4150 km (long-haul), JFK→LAX is ~3970 km
    expect(enriched[0]?.distanceKm).toBeGreaterThan(4000);
  });

  it("flags unknown airports as unresolved", () => {
    const flight: ParsedFlight = {
      id: "test",
      date: "2024-06-01",
      from: "ZZZ",
      to: "QQQ",
      divertedTo: null,
      actualTo: "QQQ",
      cancelled: false,
      airline: null,
      flightNumber: null,
      aircraft: null,
      aircraftId: null,
      cabinClass: null,
      scheduledDeparture: null,
      quality: "low",
    };
    const { enriched, unresolved } = enrichFlights([flight], calcTim);
    expect(enriched).toHaveLength(0);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]?.reason).toMatch(/unknown airport/);
  });
});

// ─────────────────────────────────────────────────────────── by-year aggregation ──

describe("aggregateByYear", () => {
  it("returns years in ascending order", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const years = aggregateByYear(enriched);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]!.year).toBeGreaterThan(years[i - 1]!.year);
    }
  });

  it("year totals sum to overall total", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const years = aggregateByYear(enriched);
    const yearSum = years.reduce((s, y) => s + y.totalKgCo2e, 0);
    const overall = enriched.reduce((s, e) => s + e.result.kgCo2e, 0);
    expect(yearSum).toBeCloseTo(overall, 1);
  });

  it("cabin split sums equal year total", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const years = aggregateByYear(enriched);
    for (const y of years) {
      const cabinSum = Object.values(y.byCabin).reduce((s, v) => s + v, 0);
      expect(cabinSum).toBeCloseTo(y.totalKgCo2e, 3);
    }
  });
});

// ────────────────────────────────────────────────────────── by-month aggregation ──

describe("aggregateByMonth", () => {
  it("orders by year then month", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const months = aggregateByMonth(enriched);
    for (let i = 1; i < months.length; i++) {
      const prev = months[i - 1]!;
      const curr = months[i]!;
      expect(curr.year > prev.year || (curr.year === prev.year && curr.month > prev.month)).toBe(
        true,
      );
    }
  });

  it("filters to a single year when requested", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const months = aggregateByMonth(enriched, 2024);
    for (const m of months) expect(m.year).toBe(2024);
  });

  it("haul split sums to month total", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const months = aggregateByMonth(enriched);
    for (const m of months) {
      const sum = m.byHaul.domestic + m.byHaul["short-haul"] + m.byHaul["long-haul"];
      expect(sum).toBeCloseTo(m.totalKgCo2e, 3);
    }
  });
});

// ───────────────────────────────────────────────────────── by-aircraft aggregation ──

describe("aggregateByAircraft", () => {
  it("returns in descending order by total emissions", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const byA = aggregateByAircraft(enriched);
    for (let i = 1; i < byA.length; i++) {
      expect(byA[i]!.totalKgCo2e).toBeLessThanOrEqual(byA[i - 1]!.totalKgCo2e);
    }
  });

  it("shareOfTotal sums to 1.0", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const byA = aggregateByAircraft(enriched);
    const totalShare = byA.reduce((s, a) => s + a.shareOfTotal, 0);
    expect(totalShare).toBeCloseTo(1.0, 3);
  });

  it("bundles missing aircraft strings as '(unknown)'", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const byA = aggregateByAircraft(enriched);
    const unknown = byA.find((a) => a.aircraft === "(unknown)");
    expect(unknown).toBeDefined();
    expect(unknown?.flightCount).toBe(27);
  });
});

// ─────────────────────────────────────────────────────────── by-cabin aggregation ──

describe("aggregateByCabin", () => {
  it("returns all 4 cabin classes", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const byC = aggregateByCabin(enriched);
    const classes = byC.map((c) => c.cabin).sort();
    expect(classes).toEqual(["business", "economy", "first", "premium-economy"] as CabinClass[]);
  });

  it("shareOfTotal sums to 1.0", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const byC = aggregateByCabin(enriched);
    const totalShare = byC.reduce((s, c) => s + c.shareOfTotal, 0);
    expect(totalShare).toBeCloseTo(1.0, 3);
  });
});

// ──────────────────────────────────────────────────────────────── top-N flights ──

describe("topNFlights", () => {
  it("returns the N highest-emission flights, descending", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const top5 = topNFlights(enriched, 5);
    expect(top5).toHaveLength(5);
    for (let i = 1; i < top5.length; i++) {
      expect(top5[i]!.result.kgCo2e).toBeLessThanOrEqual(top5[i - 1]!.result.kgCo2e);
    }
  });

  it("returns all flights when N > length", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const all = topNFlights(enriched, 100000);
    expect(all).toHaveLength(enriched.length);
  });

  it("does not mutate the input array", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const firstBefore = enriched[0];
    topNFlights(enriched, 5);
    expect(enriched[0]).toBe(firstBefore);
  });
});

// ──────────────────────────────────────────────────────────────── data quality ──

describe("summarizeDataQuality", () => {
  it("counts cancelled flights separately from quality histogram", () => {
    const flights = loadFixture();
    const q = summarizeDataQuality(flights);
    // 373 rows total, 4 cancelled → 369 considered
    expect(q.totalFlights).toBe(369);
    expect(q.byTier.high + q.byTier.medium + q.byTier.low).toBe(369);
  });

  it("counts recordedAircraft and recordedCabin separately", () => {
    const flights = loadFixture();
    const q = summarizeDataQuality(flights);
    // Per earlier exploration: ~342 have aircraft, exactly 4 have cabin
    expect(q.recordedAircraft).toBeGreaterThan(300);
    expect(q.recordedCabin).toBe(4);
  });
});

describe("summarizeEnrichedQuality", () => {
  it("counts TIM-to-DEFRA fallbacks and cabin-assumed flights", () => {
    const flights = loadFixture();
    const { enriched } = enrichFlights(flights, calcTim);
    const q = summarizeEnrichedQuality(enriched);
    // 27 flights with no aircraft → DEFRA fallback under TIM
    expect(q.fellBackToDefra).toBe(27);
    // 365 flights with no cabin → cabin assumed (369 - 4 recorded)
    expect(q.cabinAssumed).toBe(365);
  });
});

// Helper: build a small synthetic EnrichedFlight for edge tests
function makeEnriched(over: Partial<EnrichedFlight>): EnrichedFlight {
  return {
    flight: {
      id: "synthetic",
      date: "2024-06-01",
      from: "JFK",
      to: "LAX",
      divertedTo: null,
      actualTo: "LAX",
      cancelled: false,
      airline: null,
      flightNumber: null,
      aircraft: "Boeing 787-9",
      aircraftId: null,
      cabinClass: "economy",
      scheduledDeparture: null,
      quality: "high",
    },
    result: {
      kgCo2: 100,
      kgCo2e: 190,
      distanceKm: 4000,
      cabinClass: "economy",
      cabinSource: "recorded",
      method: "TIM-2024",
      factorVersion: "test",
      caveats: [],
    },
    distanceKm: 4000,
    year: 2024,
    month: 6,
    date: new Date("2024-06-01"),
    haulBucket: "long-haul",
    ...over,
  };
}

describe("aggregation — empty / single-flight edge cases", () => {
  it("aggregateByYear returns empty for empty input", () => {
    expect(aggregateByYear([])).toEqual([]);
  });
  it("aggregateByMonth returns empty for empty input", () => {
    expect(aggregateByMonth([])).toEqual([]);
  });
  it("aggregateByAircraft returns empty for empty input", () => {
    expect(aggregateByAircraft([])).toEqual([]);
  });
  it("aggregateByCabin returns all 4 cabins with 0 emissions for empty input", () => {
    const byC = aggregateByCabin([]);
    expect(byC).toHaveLength(4);
    expect(byC.every((c) => c.totalKgCo2e === 0)).toBe(true);
    expect(byC.every((c) => c.shareOfTotal === 0)).toBe(true);
  });
  it("topNFlights returns empty for empty input", () => {
    expect(topNFlights([], 5)).toEqual([]);
  });
  it("single flight: year aggregate has one entry", () => {
    const e = makeEnriched({});
    const years = aggregateByYear([e]);
    expect(years).toHaveLength(1);
    expect(years[0]?.year).toBe(2024);
    expect(years[0]?.totalKgCo2e).toBe(190);
  });
});
