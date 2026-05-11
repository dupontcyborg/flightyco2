export { type AircraftAggregate, aggregateByAircraft } from "./by-aircraft.ts";
export { aggregateByCabin, type CabinAggregate } from "./by-cabin.ts";
export { aggregateByMonth, type MonthAggregate } from "./by-month.ts";
export { aggregateByYear, type YearAggregate } from "./by-year.ts";
export {
  type DataQualitySummary,
  type EnrichedQualitySummary,
  summarizeDataQuality,
  summarizeEnrichedQuality,
} from "./data-quality.ts";
export { type Calculator, enrichFlights } from "./enrich.ts";
export { topNFlights } from "./top-n.ts";
export type { EnrichedFlight, EnrichmentResult, UnenrichedFlight } from "./types.ts";
