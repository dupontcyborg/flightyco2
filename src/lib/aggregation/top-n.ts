import type { EnrichedFlight } from "./types.ts";

/** Return the N highest-emission flights, descending. */
export function topNFlights(enriched: EnrichedFlight[], n: number): EnrichedFlight[] {
  // Sort a copy — never mutate caller's array
  return [...enriched].sort((a, b) => b.result.kgCo2e - a.result.kgCo2e).slice(0, n);
}
