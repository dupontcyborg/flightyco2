/**
 * GAIA route distance/fuel adjustment lookup (Teoh et al. 2023).
 *
 * Three-tier fallback:
 *   1. Specific airport pair (ICAO codes)         e.g. "KJFK-EGLL"
 *   2. Country pair (ISO alpha-2 codes)           e.g. "US-GB"
 *   3. Global default ratios from TIM             1.052 / 1.052
 *
 * Tier 3's distance default comes from Teoh et al. global mean (+5.2%).
 * The fuel ratio default is the same — without route-specific data we
 * assume distance overhead translates to roughly proportional fuel.
 */

export type GaiaTier = "airport-pair" | "country-pair" | "default";

export interface GaiaAdjustment {
  /** Actual flown km ÷ great-circle km. Always ≥ 1 in tiers 1+2. */
  distanceRatio: number;
  /** Actual CCD fuel ÷ EEA-predicted CCD fuel. Can be < 1 with tailwinds. */
  fuelRatio: number;
  /** Which tier produced this lookup. Surfaced as a data-quality indicator. */
  tier: GaiaTier;
}

const DEFAULT_DISTANCE_RATIO = 1.052;
const DEFAULT_FUEL_RATIO = 1.052;

type Pair = readonly [number, number];
type Table = Record<string, Pair>;

let airportStore: Table | null = null;
let countryStore: Table | null = null;

export function setGaiaAirports(table: Table): void {
  airportStore = table;
}
export function setGaiaCountries(table: Table): void {
  countryStore = table;
}
export function gaiaLoaded(): boolean {
  return airportStore !== null && countryStore !== null;
}

/**
 * Resolve route adjustment.
 *
 * @param fromIcao  Origin airport ICAO code (e.g. "KJFK"). Empty string OK.
 * @param toIcao    Destination ICAO. Empty string OK.
 * @param fromCountry  Origin ISO alpha-2 country. Empty string OK.
 * @param toCountry    Destination ISO alpha-2 country. Empty string OK.
 */
export function lookupGaia(
  fromIcao: string,
  toIcao: string,
  fromCountry: string,
  toCountry: string,
): GaiaAdjustment {
  if (airportStore && fromIcao && toIcao) {
    const key = `${fromIcao}-${toIcao}`;
    const hit = airportStore[key];
    if (hit) return { distanceRatio: hit[0], fuelRatio: hit[1], tier: "airport-pair" };
  }
  if (countryStore && fromCountry && toCountry) {
    const key = `${fromCountry}-${toCountry}`;
    const hit = countryStore[key];
    if (hit) return { distanceRatio: hit[0], fuelRatio: hit[1], tier: "country-pair" };
  }
  return {
    distanceRatio: DEFAULT_DISTANCE_RATIO,
    fuelRatio: DEFAULT_FUEL_RATIO,
    tier: "default",
  };
}
