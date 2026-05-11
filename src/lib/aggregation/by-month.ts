import type { EnrichedFlight } from "./types.ts";

export interface MonthAggregate {
  year: number;
  month: number; // 1-12
  flightCount: number;
  totalKgCo2e: number;
  /** Per-haul-bucket emissions split — drives the stacked bar chart. */
  byHaul: { domestic: number; "short-haul": number; "long-haul": number };
}

const emptyHaul = (): MonthAggregate["byHaul"] => ({
  domestic: 0,
  "short-haul": 0,
  "long-haul": 0,
});

/**
 * Group enriched flights into year-month buckets with per-haul emissions.
 * Optionally filter to a single year. Returns ascending order.
 */
export function aggregateByMonth(enriched: EnrichedFlight[], year?: number): MonthAggregate[] {
  const map = new Map<string, MonthAggregate>();
  for (const e of enriched) {
    if (year !== undefined && e.year !== year) continue;
    const key = `${e.year}-${String(e.month).padStart(2, "0")}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        year: e.year,
        month: e.month,
        flightCount: 0,
        totalKgCo2e: 0,
        byHaul: emptyHaul(),
      };
      map.set(key, agg);
    }
    agg.flightCount++;
    agg.totalKgCo2e += e.result.kgCo2e;
    agg.byHaul[e.haulBucket] += e.result.kgCo2e;
  }
  return [...map.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}
