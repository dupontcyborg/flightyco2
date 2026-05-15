/**
 * Glue between the CSV upload and the dashboard view-model.
 *
 * Loads reference data (once, cached), parses the CSV, runs both
 * calculators with the supplied options, and returns the bundle the UI
 * renders from. Kept out of any Svelte component so it stays testable.
 */

import { ASSETS } from "~/lib/asset-manifest.ts";
import {
  aggregateByAircraft,
  aggregateByCabin,
  aggregateByMonth,
  aggregateByYear,
  aircraftToIcao,
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
    airlines: ASSETS.airlines,
    mapping: ASSETS.aircraftMapping,
    fuelBurn: ASSETS.fuelBurn,
    seatConfigs: ASSETS.seatConfigs,
    gaiaAirports: ASSETS.gaiaAirports,
    gaiaCountries: ASSETS.gaiaCountries,
  });

  const parse = parseFlightyCsv(csvText);
  const enrichment = enrichFlights(parse.flights, (input) => calculateTim(input, options));

  const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> })
    .env;
  if (env?.DEV && env?.PUBLIC_DEBUG_IMPORT) {
    logImportDebug(parse, enrichment);
  }

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

function logImportDebug(parse: ParseResult, enrichment: EnrichmentResult): void {
  const unknownAircraft = new Map<string, number>();
  const unmappedAircraft = new Map<string, number>();
  for (const e of enrichment.enriched) {
    const ac = e.flight.aircraft;
    if (!ac) {
      unknownAircraft.set("(empty)", (unknownAircraft.get("(empty)") ?? 0) + 1);
    } else if (aircraftToIcao(ac) === null) {
      unmappedAircraft.set(ac, (unmappedAircraft.get(ac) ?? 0) + 1);
    }
  }

  const unknownAirports = new Set<string>();
  const otherFailures: { reason: string; count: number }[] = [];
  const reasonCounts = new Map<string, number>();
  for (const u of enrichment.unresolved) {
    const m = /unknown airport\(s\): (\S+) or (\S+)/.exec(u.reason);
    if (m?.[1] && m[2]) {
      unknownAirports.add(m[1]);
      unknownAirports.add(m[2]);
    } else {
      reasonCounts.set(u.reason, (reasonCounts.get(u.reason) ?? 0) + 1);
    }
  }
  for (const [reason, count] of reasonCounts) otherFailures.push({ reason, count });

  console.groupCollapsed(
    `[flightyco2] import debug — ${parse.flights.length} parsed, ${enrichment.enriched.length} enriched, ${enrichment.unresolved.length} unresolved, ${enrichment.cancelled.length} cancelled`,
  );
  console.log("aircraft with empty field (counts):", Object.fromEntries(unknownAircraft));
  console.log("aircraft strings not in mapping (counts):", Object.fromEntries(unmappedAircraft));
  console.log("airport IATA codes not in table:", [...unknownAirports].sort());
  console.log("other enrichment failures:", otherFailures);
  console.log("parse.skipped:", parse.skipped);
  console.groupEnd();
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
