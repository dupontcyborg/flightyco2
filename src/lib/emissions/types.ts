import type { CabinClass } from "../csv/schema.ts";

export type EmissionMethod = "DEFRA-2024" | "TIM-2024";

export interface EmissionInput {
  /** Great-circle distance between origin and destination, km. */
  distanceKm: number;
  cabinClass: CabinClass | null;
  /** Free-text aircraft string from the Flighty CSV. Used by TIM. */
  aircraft: string | null;
  aircraftId: string | null;
  /** Origin airport ICAO (e.g. "KJFK"). Optional — TIM uses for GAIA tier-1 lookup. */
  fromIcao?: string;
  /** Origin country ISO alpha-2 (e.g. "US"). Optional — TIM uses for GAIA tier-2 lookup. */
  fromCountry?: string;
  toIcao?: string;
  toCountry?: string;
}

export interface EmissionOptions {
  /** Cabin class assumed for flights with no recorded cabin. */
  cabinFallback: CabinClass;
  /** Non-CO₂ effects multiplier. DEFRA defaults to 1.9. Set 1 to disable. */
  nonCo2Multiplier: number;
  /** Routing uplift over great-circle distance. DEFRA uses 1.09. */
  routingUplift: number;
}

export interface EmissionResult {
  /** kg CO₂e *with* the non-CO₂ multiplier applied. */
  kgCo2e: number;
  /** kg CO₂e *without* the non-CO₂ multiplier (raw CO₂ only). */
  kgCo2: number;
  /** Effective distance used (great-circle × routing uplift). */
  distanceKm: number;
  cabinClass: CabinClass;
  /** Whether the cabin class came from the row or the fallback. */
  cabinSource: "recorded" | "fallback";
  method: EmissionMethod;
  factorVersion: string;
  /** Notes/caveats — populated when fallback chains kick in. */
  caveats: string[];
}

export const DEFAULT_EMISSION_OPTIONS: EmissionOptions = {
  cabinFallback: "economy",
  nonCo2Multiplier: 1.9,
  routingUplift: 1.09,
};
