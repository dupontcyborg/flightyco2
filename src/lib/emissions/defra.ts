import { DEFRA_2024_VERSION, DEFRA_FACTORS_KG_PER_PKM } from "./factors/defra-2024.ts";
import type { EmissionInput, EmissionOptions, EmissionResult } from "./types.ts";

/**
 * DEFRA 2024 distance-uplift calculation.
 *
 *   distance      = great-circle × routingUplift
 *   factor        = DEFRA[cabin]                  (kg CO₂e per passenger-km, no RF)
 *   kgCo2         = distance × factor
 *   kgCo2e        = kgCo2 × nonCo2Multiplier
 *
 * See `factors/defra-2024.ts` for the structural caveat: DEFRA's real
 * structure uses country-pair haul classification (currently we apply the
 * "International, to/from non-UK" tier uniformly — correct for non-UK
 * users, off by 30–50% for UK-involved flights).
 */
export function calculateDefra(input: EmissionInput, options: EmissionOptions): EmissionResult {
  const cabinSource: "recorded" | "fallback" = input.cabinClass ? "recorded" : "fallback";
  const cabinClass = input.cabinClass ?? options.cabinFallback;

  const effectiveDistanceKm = input.distanceKm * options.routingUplift;
  const factor = DEFRA_FACTORS_KG_PER_PKM[cabinClass];

  const kgCo2 = effectiveDistanceKm * factor;
  const kgCo2e = kgCo2 * options.nonCo2Multiplier;

  const caveats: string[] = [];
  if (cabinSource === "fallback") caveats.push(`cabin assumed: ${cabinClass}`);

  return {
    kgCo2,
    kgCo2e,
    distanceKm: effectiveDistanceKm,
    cabinClass,
    cabinSource,
    method: "DEFRA-2024",
    factorVersion: DEFRA_2024_VERSION,
    caveats,
  };
}
