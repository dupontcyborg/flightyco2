/**
 * Glue between the CSV upload and the dashboard view-model.
 *
 * Loads reference data (once, cached), parses the CSV, runs both
 * calculators with the supplied options, and returns the bundle the UI
 * renders from. Kept out of any Svelte component so it stays testable.
 */

import {
  aggregateByAircraft,
  aggregateByCabin,
  aggregateByMonth,
  aggregateByYear,
  calculateTim,
  DEFAULT_EMISSION_OPTIONS,
  type EmissionOptions,
  type EnrichedFlight,
  type EnrichmentResult,
  enrichFlights,
  loadAllReferenceData,
  type ParseResult,
  parseFlightyCsv,
  summarizeDataQuality,
  summarizeEnrichedQuality,
  topNFlights,
} from "~/lib/index.ts";
import { ASSETS } from "~/lib/asset-manifest.ts";

export interface ProcessedBundle {
  parse: ParseResult;
  enrichment: EnrichmentResult;
  options: EmissionOptions;
  /** Data-quality summary over parsed flights (pre-enrichment). */
  rawQuality: ReturnType<typeof summarizeDataQuality>;
  /** Enrichment-time summary: fallback counts, cabin-assumed counts. */
  enrichedQuality: ReturnType<typeof summarizeEnrichedQuality>;
  /** Sorted ascending. */
  yearAggregates: ReturnType<typeof aggregateByYear>;
  /** Sorted descending by year. */
  years: number[];
}

export async function processCsv(
  csvText: string,
  options: EmissionOptions = DEFAULT_EMISSION_OPTIONS,
): Promise<ProcessedBundle> {
  await loadAllReferenceData({
    airports: ASSETS.airports,
    mapping: ASSETS.aircraftMapping,
    fuelBurn: ASSETS.fuelBurn,
    seatConfigs: ASSETS.seatConfigs,
    gaiaAirports: ASSETS.gaiaAirports,
    gaiaCountries: ASSETS.gaiaCountries,
  });

  const parse = parseFlightyCsv(csvText);
  const enrichment = enrichFlights(parse.flights, (input) => calculateTim(input, options));

  return {
    parse,
    enrichment,
    options,
    rawQuality: summarizeDataQuality(parse.flights),
    enrichedQuality: summarizeEnrichedQuality(enrichment.enriched),
    yearAggregates: aggregateByYear(enrichment.enriched),
    years: [...new Set(enrichment.enriched.map((e) => e.year))].sort((a, b) => b - a),
  };
}

/** Selection key for the dashboard scope. `null` = lifetime (all years). */
export type ScopeKey = number | null;

export interface ScopeView {
  /** `null` for lifetime. */
  year: number | null;
  /** Years this view spans (for per-year-budget math etc.). */
  yearSpan: number;
  flights: EnrichedFlight[];
  /** 12-bucket month aggregate. Only meaningful for a single year. */
  monthly: ReturnType<typeof aggregateByMonth>;
  byAircraft: ReturnType<typeof aggregateByAircraft>;
  byCabin: ReturnType<typeof aggregateByCabin>;
  top: EnrichedFlight[];
  totalKgCo2e: number;
  totalKgCo2: number;
  totalDistanceKm: number;
}

/** Slice the bundle to a single year, or all years if `year` is null. */
export function buildScopeView(bundle: ProcessedBundle, year: ScopeKey): ScopeView {
  const flights =
    year === null
      ? bundle.enrichment.enriched
      : bundle.enrichment.enriched.filter((e) => e.year === year);

  let totalKgCo2e = 0;
  let totalKgCo2 = 0;
  let totalDistanceKm = 0;
  for (const f of flights) {
    totalKgCo2e += f.result.kgCo2e;
    totalKgCo2 += f.result.kgCo2;
    totalDistanceKm += f.distanceKm;
  }

  const yearSpan = year === null ? Math.max(1, bundle.years.length) : 1;

  return {
    year,
    yearSpan,
    flights,
    monthly: year === null ? [] : aggregateByMonth(flights, year),
    byAircraft: aggregateByAircraft(flights),
    byCabin: aggregateByCabin(flights),
    top: topNFlights(flights, 5),
    totalKgCo2e,
    totalKgCo2,
    totalDistanceKm,
  };
}
