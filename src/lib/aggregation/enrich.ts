import { routeDistanceKm } from "../airports/distance.ts";
import type { ParsedFlight } from "../csv/schema.ts";
import { defraBucket } from "../emissions/factors/defra-2024.ts";
import type { EmissionInput, EmissionResult } from "../emissions/types.ts";
import type { EnrichedFlight, EnrichmentResult } from "./types.ts";

export type Calculator = (input: EmissionInput) => EmissionResult;

/**
 * Resolve each flight's route + run the emissions calculator. Partitions
 * the input into:
 *   - enriched:  ready for aggregation (non-cancelled, route + emissions resolved)
 *   - cancelled: excluded from emissions, kept for context
 *   - unresolved: had no valid route or unparseable date
 *
 * The caller supplies the calculator (DEFRA or TIM, with its options
 * pre-applied). Airports + aircraft data must already be loaded.
 *
 *   const enriched = enrichFlights(flights, (input) => calculateTim(input, options));
 */
export function enrichFlights(flights: ParsedFlight[], calculate: Calculator): EnrichmentResult {
  const enriched: EnrichedFlight[] = [];
  const cancelled: ParsedFlight[] = [];
  const unresolved: { flight: ParsedFlight; reason: string }[] = [];

  for (const flight of flights) {
    if (flight.cancelled) {
      cancelled.push(flight);
      continue;
    }
    const route = routeDistanceKm(flight.from, flight.actualTo);
    if (!route) {
      unresolved.push({
        flight,
        reason: `unknown airport(s): ${flight.from} or ${flight.actualTo}`,
      });
      continue;
    }
    const date = new Date(flight.date);
    if (!Number.isFinite(date.getTime())) {
      unresolved.push({ flight, reason: `unparseable date: ${flight.date}` });
      continue;
    }

    const input: EmissionInput = {
      distanceKm: route.km,
      cabinClass: flight.cabinClass,
      aircraft: flight.aircraft,
      aircraftId: flight.aircraftId,
      fromIcao: route.from.icao,
      fromCountry: route.from.country,
      toIcao: route.to.icao,
      toCountry: route.to.country,
    };
    const result = calculate(input);

    enriched.push({
      flight,
      result,
      distanceKm: route.km,
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      date,
      haulBucket: defraBucket(route.km),
    });
  }

  return { enriched, cancelled, unresolved };
}
