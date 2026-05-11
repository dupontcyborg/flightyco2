import type { CabinClass } from "../../csv/schema.ts";

/**
 * DEFRA 2024 GHG conversion factors — passenger flights.
 *
 * Source: UK Government GHG Conversion Factors for Company Reporting, 2024
 * (full set v1.1, "Business travel- air" sheet). Verified against
 * data/uk-gov/ghg-conversion-factors-2024-full.xlsx.
 *
 * Stored values are kg CO₂e per passenger-km **without** the non-CO₂
 * radiative-forcing multiplier. RF is applied externally via
 * `EmissionOptions.nonCo2Multiplier` so the toggle is transparent.
 *
 * DEFRA 2024's published "with RF" values use a 1.7× multiplier on the CO₂
 * component (not the older 1.9× from Lee et al. 2009). The total kgCO₂e
 * with-RF / without-RF ratio is 1.694 because CH₄/N₂O don't get the uplift.
 * Our `nonCo2Multiplier` default remains 1.9 for compatibility with common
 * climate-reporting practice; setting it to 1.7 would match DEFRA exactly.
 *
 * ⚠ STRUCTURAL CAVEAT: DEFRA's real structure is by **country-pair haul
 * classification** (Domestic UK / Short-haul to-from UK / Long-haul to-from
 * UK / International non-UK), not distance buckets. The factors below use
 * "International, to/from non-UK" for ALL flights, which is correct for
 * non-UK users (where origin and destination are both non-UK) but off by
 * 30–50% for UK-involved flights. The full country-pair classification
 * lands in Phase 2 — see TODO.md.
 *
 * For now, distance buckets are kept ONLY as a UI categorization (haul
 * length for monthly stacked chart). The factor lookup ignores the bucket.
 */
export const DEFRA_2024_VERSION = "DEFRA-2024-v1.1";

export const DEFRA_BUCKETS = {
  /** km — upper bound of the domestic bucket (inclusive). UI categorization only. */
  domesticMaxKm: 463,
  /** km — upper bound of the short-haul bucket (inclusive). UI categorization only. */
  shortHaulMaxKm: 3700,
} as const;

export type DefraBucket = "domestic" | "short-haul" | "long-haul";

export function defraBucket(distanceKm: number): DefraBucket {
  if (distanceKm <= DEFRA_BUCKETS.domesticMaxKm) return "domestic";
  if (distanceKm <= DEFRA_BUCKETS.shortHaulMaxKm) return "short-haul";
  return "long-haul";
}

/**
 * Per-passenger-km CO₂e factor, no RF, by cabin class. Currently uses the
 * DEFRA 2024 "International, to/from non-UK" tier for all flights.
 *
 * Values verified 2026-05-10 against the published UK Gov spreadsheet.
 */
export const DEFRA_FACTORS_KG_PER_PKM: Record<CabinClass, number> = {
  economy: 0.07948,
  "premium-economy": 0.12716,
  business: 0.23047,
  first: 0.31789,
};
