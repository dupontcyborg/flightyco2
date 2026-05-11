import type { ParsedFlight } from "../csv/schema.ts";
import type { EmissionResult } from "../emissions/types.ts";

/** A flight with route + emissions resolved, ready for aggregation. */
export interface EnrichedFlight {
  flight: ParsedFlight;
  result: EmissionResult;
  /** Effective great-circle distance used (km). Same as route.km. */
  distanceKm: number;
  /** Year of the flight date. */
  year: number;
  /** 1-indexed month (1 = January). */
  month: number;
  /** UTC Date object for the flight date. */
  date: Date;
  /** DEFRA-style bucket for stacking by haul length in charts. */
  haulBucket: "domestic" | "short-haul" | "long-haul";
}

/** A flight that couldn't be enriched (unresolved route, etc.). */
export interface UnenrichedFlight {
  flight: ParsedFlight;
  reason: string;
}

export interface EnrichmentResult {
  enriched: EnrichedFlight[];
  /** Cancelled flights — excluded from emissions, tallied for context. */
  cancelled: ParsedFlight[];
  /** Couldn't compute distance (unknown airport, bad date, etc.). */
  unresolved: UnenrichedFlight[];
}
