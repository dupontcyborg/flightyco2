import type { ParsedFlight } from "../csv/schema.ts";
import type { EnrichedFlight } from "./types.ts";

export interface DataQualitySummary {
  /** Total non-cancelled flights considered. */
  totalFlights: number;
  /** How many fall into each Flighty-row quality tier. */
  byTier: { high: number; medium: number; low: number };
  /** "94% had recorded aircraft data" / "61% had recorded cabin class" etc. */
  recordedAircraft: number;
  recordedCabin: number;
  divertedCount: number;
  /** Fraction in [0, 1] of flights with both aircraft + cabin recorded. */
  completenessRatio: number;
}

export function summarizeDataQuality(flights: ParsedFlight[]): DataQualitySummary {
  let total = 0;
  const byTier = { high: 0, medium: 0, low: 0 };
  let recordedAircraft = 0;
  let recordedCabin = 0;
  let diverted = 0;
  for (const f of flights) {
    if (f.cancelled) continue;
    total++;
    byTier[f.quality]++;
    if (f.aircraft) recordedAircraft++;
    if (f.cabinClass) recordedCabin++;
    if (f.divertedTo) diverted++;
  }
  return {
    totalFlights: total,
    byTier,
    recordedAircraft,
    recordedCabin,
    divertedCount: diverted,
    completenessRatio: total > 0 ? byTier.high / total : 0,
  };
}

/** Quick metadata on enriched flights — fallback methods, caveat tallies. */
export interface EnrichedQualitySummary {
  /** Flights where TIM fell back to DEFRA. */
  fellBackToDefra: number;
  /** Flights where the cabin class was assumed (not recorded). */
  cabinAssumed: number;
  /** Total flights considered (= enriched.length). */
  totalEnriched: number;
}

export function summarizeEnrichedQuality(enriched: EnrichedFlight[]): EnrichedQualitySummary {
  let fellBack = 0;
  let assumed = 0;
  for (const e of enriched) {
    if (e.result.method === "DEFRA-2024" && e.result.caveats.some((c) => c.includes("fell back")))
      fellBack++;
    if (e.result.cabinSource === "fallback") assumed++;
  }
  return { fellBackToDefra: fellBack, cabinAssumed: assumed, totalEnriched: enriched.length };
}
