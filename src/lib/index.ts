/**
 * Top-level public surface for `src/lib`.
 *
 * UI code should import from here, not from individual submodules — that
 * way the surface area is intentional and we can refactor internals
 * without rippling through Svelte components.
 *
 * Submodules remain importable directly when you need their full surface
 * (e.g. tests, advanced consumers).
 */

// Aggregation
export {
  type AircraftAggregate,
  aggregateByAircraft,
  aggregateByCabin,
  aggregateByMonth,
  aggregateByYear,
  type CabinAggregate,
  type Calculator,
  type DataQualitySummary,
  type EnrichedFlight,
  type EnrichedQualitySummary,
  type EnrichmentResult,
  enrichFlights,
  type MonthAggregate,
  summarizeDataQuality,
  summarizeEnrichedQuality,
  topNFlights,
  type UnenrichedFlight,
  type YearAggregate,
} from "./aggregation/index.ts";

// Aircraft (mapping, fuel-burn, seat-config)
export {
  type AircraftLookup,
  aircraftToIcao,
  loadAircraftData,
  type SupportLevel,
} from "./aircraft/index.ts";
// Airlines (ICAO→IATA)
export { icaoToIata, loadAirlines } from "./airlines/index.ts";
// Airports
export {
  type Airport,
  getAirport,
  haversineKm,
  loadAirports,
  routeDistanceKm,
} from "./airports/index.ts";
// Comparisons
export {
  type ComparisonSet,
  comparisonsForTotal,
  REFERENCE_BUDGETS,
} from "./comparisons.ts";
// CSV parsing
export {
  type DedupedFlight,
  hashCsv,
  NotFlightyCsvError,
  type ParseResult,
  parseFlightyCsv,
} from "./csv/index.ts";
export { CABIN_CLASSES } from "./csv/schema.ts";
export type { CabinClass, DataQuality, ParsedFlight } from "./csv/schema.ts";
// Emissions calculators
export {
  calculateDefra,
  calculateTim,
  DEFAULT_EMISSION_OPTIONS,
  type EmissionInput,
  type EmissionMethod,
  type EmissionOptions,
  type EmissionResult,
} from "./emissions/index.ts";
// GAIA route adjustment
export { type GaiaAdjustment, type GaiaTier, loadGaia, lookupGaia } from "./gaia/index.ts";

// Single-shot loader
export { type LoadAllUrls, loadAllReferenceData } from "./load.ts";
