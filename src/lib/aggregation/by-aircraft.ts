import type { EnrichedFlight } from "./types.ts";

export interface AircraftAggregate {
  /** Free-text aircraft string from Flighty (e.g. "Boeing 787-9"). "(unknown)" if absent. */
  aircraft: string;
  flightCount: number;
  totalKgCo2e: number;
  totalDistanceKm: number;
  /** Fraction of total emissions across all flights in the input set. */
  shareOfTotal: number;
}

/**
 * Group by aircraft name. Returned in descending order by total emissions.
 * `shareOfTotal` lets the UI render percentage stacks without re-summing.
 */
export function aggregateByAircraft(enriched: EnrichedFlight[]): AircraftAggregate[] {
  const map = new Map<string, AircraftAggregate>();
  let total = 0;
  for (const e of enriched) {
    const key = e.flight.aircraft ?? "(unknown)";
    let agg = map.get(key);
    if (!agg) {
      agg = {
        aircraft: key,
        flightCount: 0,
        totalKgCo2e: 0,
        totalDistanceKm: 0,
        shareOfTotal: 0,
      };
      map.set(key, agg);
    }
    agg.flightCount++;
    agg.totalKgCo2e += e.result.kgCo2e;
    agg.totalDistanceKm += e.distanceKm;
    total += e.result.kgCo2e;
  }
  const out = [...map.values()].sort((a, b) => b.totalKgCo2e - a.totalKgCo2e);
  if (total > 0) for (const a of out) a.shareOfTotal = a.totalKgCo2e / total;
  return out;
}
