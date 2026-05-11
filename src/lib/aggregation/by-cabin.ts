import type { CabinClass } from "../csv/schema.ts";
import type { EnrichedFlight } from "./types.ts";

export interface CabinAggregate {
  cabin: CabinClass;
  flightCount: number;
  totalKgCo2e: number;
  shareOfTotal: number;
}

/**
 * Group by **final cabin class** (post-fallback). Returned in descending
 * order by emissions. Empty cabin classes are included for completeness
 * so UI can render a stable four-bar chart.
 */
export function aggregateByCabin(enriched: EnrichedFlight[]): CabinAggregate[] {
  const all: CabinClass[] = ["economy", "premium-economy", "business", "first"];
  const out: CabinAggregate[] = all.map((cabin) => ({
    cabin,
    flightCount: 0,
    totalKgCo2e: 0,
    shareOfTotal: 0,
  }));
  let total = 0;
  for (const e of enriched) {
    const agg = out.find((c) => c.cabin === e.result.cabinClass);
    if (!agg) continue;
    agg.flightCount++;
    agg.totalKgCo2e += e.result.kgCo2e;
    total += e.result.kgCo2e;
  }
  if (total > 0) for (const c of out) c.shareOfTotal = c.totalKgCo2e / total;
  return out.sort((a, b) => b.totalKgCo2e - a.totalKgCo2e);
}
