/**
 * Faithful Google Travel Impact Model (TIM 3.0.0) port.
 *
 * Algorithm (per https://github.com/google/travel-impact-model):
 *
 *   1.  great_circle_nm = great_circle_km × 0.5399568
 *   2.  adjusted_nm     = great_circle_nm × gaia.distanceRatio
 *   3.  ccd_nm          = adjusted_nm − 17     (EEA: LTO consumes 17 NM)
 *   4.  ccd_fuel_kg     = interpolate(EEA[icao].ccd, ccd_nm) × gaia.fuelRatio
 *   5.  total_fuel_kg   = EEA[icao].lto_kg + ccd_fuel_kg
 *   6.  wtw_co2e_kg     = total_fuel_kg × 3.8359   (well-to-wake, CORSIA)
 *   7.  pax_co2e_kg     = wtw_co2e_kg × (1 − cargo_mass_fraction)
 *   8.  equiv_seats     = sum(seats × multiplier)  (body-specific multipliers)
 *   9.  per_econ_seat   = pax_co2e_kg / equiv_seats
 *   10. per_seat_class  = per_econ_seat × multiplier[cabin]
 *   11. per_passenger   = per_seat_class / load_factor
 *   12. final_kg_co2e   = per_passenger × non_co2_multiplier (default 1.9)
 *
 * Class multipliers from IATA RP 1726 (verified against TIM doc):
 *   Narrow:  F=1.5  J=1.5  W=1.0  Y=1.0
 *   Wide:    F=5.0  J=4.0  W=1.5  Y=1.0
 *
 * Falls back to DEFRA when:
 *   - the aircraft string cannot be mapped to an ICAO code
 *   - the ICAO has no EEA fuel-burn entry
 *
 * Fallbacks are transparent — `EmissionResult.method` records the actual
 * calculation used, with a caveat explaining why.
 */

import { aircraftToIcao, type SupportLevel } from "../aircraft/data.ts";
import {
  type AircraftFuelBurn,
  fuelBurnVersion,
  getFuelBurnEntry,
  interpolateCcdFuel,
} from "../aircraft/fuel-burn.ts";
import { type AircraftBody, getSeatConfig, type SeatConfig } from "../aircraft/seat-config.ts";
import type { CabinClass } from "../csv/schema.ts";
import { lookupGaia } from "../gaia/data.ts";
import { calculateDefra } from "./defra.ts";
import type { EmissionInput, EmissionOptions, EmissionResult } from "./types.ts";

// ──────────────────────────────────────────────────────────────────── constants ──

const NM_PER_KM = 0.5399568;
const KM_PER_NM = 1 / NM_PER_KM;

/** CORSIA well-to-wake conversion: 89 gCO₂e/MJ × 43.1 MJ/kg jet fuel. */
const WTW_KG_CO2E_PER_KG_FUEL = 3.8359;

/** EEA: LTO cycle covers ~17 NM of total distance. Subtract from adjusted dist for CCD. */
const LTO_NM = 17;

/** Global default passenger load factor (US Fed Reserve historical, 2019). */
const DEFAULT_LOAD_FACTOR = 0.845;

/**
 * Cargo mass fraction. TIM's full implementation uses route-specific tiered
 * data (BTS T-100); we use a coarser body-type heuristic for v1.1.
 * Wide-body flights carry more belly cargo. Numbers tuned to TIM's docs.
 */
const CARGO_MASS_FRACTION: Record<AircraftBody, number> = {
  narrow: 0.03, // narrow-body cargo capacity is small
  wide: 0.08, // matches TIM ZRH-SFO B789 worked example
};

/**
 * IATA RP 1726 seating-class floor-area weights.
 * Used both to compute equivalent seat capacity and to scale per-passenger
 * emissions by class.
 */
const CLASS_MULTIPLIERS: Record<AircraftBody, Record<CabinClass, number>> = {
  narrow: { economy: 1.0, "premium-economy": 1.0, business: 1.5, first: 1.5 },
  wide: { economy: 1.0, "premium-economy": 1.5, business: 4.0, first: 5.0 },
};

const TIM_VERSION = "TIM-3.0.0";

// ─────────────────────────────────────────────────────────────────── calculation ──

function equivalentCapacity(cfg: SeatConfig, body: AircraftBody): number {
  const m = CLASS_MULTIPLIERS[body];
  return cfg.Y * m.economy + cfg.W * m["premium-economy"] + cfg.J * m.business + cfg.F * m.first;
}

interface DefraFallbackArgs {
  input: EmissionInput;
  options: EmissionOptions;
  caveat: string;
}
function defraFallback({ input, options, caveat }: DefraFallbackArgs): EmissionResult {
  const result = calculateDefra(input, options);
  result.caveats.push(caveat);
  return result;
}

export function calculateTim(input: EmissionInput, options: EmissionOptions): EmissionResult {
  // 1. Aircraft → ICAO
  const lookup = aircraftToIcao(input.aircraft);
  if (!lookup) {
    return defraFallback({
      input,
      options,
      caveat: input.aircraft
        ? `aircraft "${input.aircraft}" not in TIM mapping — fell back to DEFRA`
        : "no aircraft recorded — fell back to DEFRA",
    });
  }

  // 2. ICAO → EEA fuel-burn entry
  const entry: AircraftFuelBurn | null = getFuelBurnEntry(lookup.icao);
  if (!entry) {
    return defraFallback({
      input,
      options,
      caveat: `ICAO "${lookup.icao}" not in EEA fuel-burn table — fell back to DEFRA`,
    });
  }

  // 3. Seat config (always returns — default fallback for unlisted)
  const seats = getSeatConfig(lookup.icao);
  const equiv = equivalentCapacity(seats.config, seats.config.body);
  if (equiv <= 0) {
    return defraFallback({
      input,
      options,
      caveat: `seat config has zero equivalent capacity for ${lookup.icao}`,
    });
  }

  // 4. GAIA route adjustment
  const gaia = lookupGaia(
    input.fromIcao ?? "",
    input.toIcao ?? "",
    input.fromCountry ?? "",
    input.toCountry ?? "",
  );

  // 5. Distance: GCD → NM → adjusted → CCD distance
  const gcdNm = input.distanceKm * NM_PER_KM;
  const adjustedNm = gcdNm * gaia.distanceRatio;
  const ccdNm = Math.max(0, adjustedNm - LTO_NM);

  // 6. Fuel: LTO + interpolated CCD at adjusted distance.
  //    Per TIM 3.0.0: only the distance ratio is applied. GAIA's fuel ratio
  //    is informational (captures wind/weight effects not modelled by EEA)
  //    but is not used in TIM's per-passenger calculation.
  const ccdFuelKg = interpolateCcdFuel(entry, ccdNm);
  if (ccdFuelKg === null) {
    return defraFallback({
      input,
      options,
      caveat: `no CCD fuel data for ${lookup.icao} — fell back to DEFRA`,
    });
  }
  const totalFuelKg = entry.lto_kg + ccdFuelKg;

  // 7. WTW CO₂e for the whole flight, then apportion to passengers
  const wtwKgCo2e = totalFuelKg * WTW_KG_CO2E_PER_KG_FUEL;
  const cargoFraction = CARGO_MASS_FRACTION[seats.config.body];
  const passengerKgCo2e = wtwKgCo2e * (1 - cargoFraction);

  // 8. Per-economy-seat → per-class seat → per-occupied-passenger
  const perEconomySeat = passengerKgCo2e / equiv;
  const cabinClass: CabinClass = input.cabinClass ?? options.cabinFallback;
  const cabinSource: "recorded" | "fallback" = input.cabinClass ? "recorded" : "fallback";
  const classMult = CLASS_MULTIPLIERS[seats.config.body][cabinClass];
  const perSeat = perEconomySeat * classMult;
  const perPassenger = perSeat / DEFAULT_LOAD_FACTOR;

  // 9. Non-CO₂ multiplier (applied on top of WTW)
  const kgCo2 = perPassenger; // already WTW (TTW + WTT); the molecule + upstream
  const kgCo2e = kgCo2 * options.nonCo2Multiplier;

  // Build caveats — surface data-quality info the UI can show
  const caveats: string[] = [];
  if (cabinSource === "fallback") caveats.push(`cabin assumed: ${cabinClass}`);
  if (lookup.matchType === "substring")
    caveats.push(`aircraft matched by substring to "${lookup.matchedName}"`);
  if (lookup.support !== "direct") caveats.push(`EEA support: ${supportNote(lookup.support)}`);
  if (seats.source === "default") caveats.push("seat config: default 50-seat fallback used");
  if (gaia.tier !== "airport-pair") caveats.push(`GAIA: ${gaia.tier} fallback`);

  return {
    kgCo2,
    kgCo2e,
    distanceKm: adjustedNm * KM_PER_NM,
    cabinClass,
    cabinSource,
    method: "TIM-2024",
    factorVersion: `${TIM_VERSION} (${fuelBurnVersion() ?? "EEA"} fuel, GAIA-2023 routing)`,
    caveats,
  };
}

function supportNote(s: SupportLevel): string {
  switch (s) {
    case "winglet":
      return "winglet/sharklet correction (-3%)";
    case "previous-gen":
      return "mapped to previous-generation aircraft";
    case "least-in-family":
      return "umbrella code mapped to least-efficient in family";
    case "similar":
      return "mapped to similar aircraft";
    case "unknown":
      return "support status unclassified";
    case "direct":
      return "direct";
  }
}
