import type { CabinClass } from "../csv/schema.ts";
import type { EnrichedFlight } from "./types.ts";

export interface YearAggregate {
  year: number;
  flightCount: number;
  totalKgCo2e: number;
  totalKgCo2: number;
  totalDistanceKm: number;
  /** Per-cabin emissions split (final cabin used in calculation, post-fallback). */
  byCabin: Record<CabinClass, number>;
  /** kg CO2e per ICAO type that contributed to this year. */
  byAircraft: Record<string, number>;
}

const emptyCabin = (): Record<CabinClass, number> => ({
  economy: 0,
  "premium-economy": 0,
  business: 0,
  first: 0,
});

/** Group enriched flights by calendar year, returning aggregates sorted ascending. */
export function aggregateByYear(enriched: EnrichedFlight[]): YearAggregate[] {
  const byYear = new Map<number, YearAggregate>();
  for (const e of enriched) {
    let agg = byYear.get(e.year);
    if (!agg) {
      agg = {
        year: e.year,
        flightCount: 0,
        totalKgCo2e: 0,
        totalKgCo2: 0,
        totalDistanceKm: 0,
        byCabin: emptyCabin(),
        byAircraft: {},
      };
      byYear.set(e.year, agg);
    }
    agg.flightCount++;
    agg.totalKgCo2e += e.result.kgCo2e;
    agg.totalKgCo2 += e.result.kgCo2;
    agg.totalDistanceKm += e.distanceKm;
    agg.byCabin[e.result.cabinClass] += e.result.kgCo2e;
    const aircraft = e.flight.aircraft ?? "(unknown)";
    agg.byAircraft[aircraft] = (agg.byAircraft[aircraft] ?? 0) + e.result.kgCo2e;
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
