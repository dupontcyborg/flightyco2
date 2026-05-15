/**
 * EEA Master Emissions Calculator fuel-burn lookup.
 *
 * Each aircraft has:
 *   - lto_kg: fixed Landing/Take-Off fuel burn (~17 NM equivalent)
 *   - ccd: array of [distance_nm, fuel_kg] tuples, sorted ascending
 *
 * Fuel at a given CCD distance is computed by linear interpolation between
 * the bracketing data points. Distances outside the table are extrapolated
 * linearly from the nearest endpoint segment (per TIM methodology).
 */

export interface AircraftFuelBurn {
  lto_kg: number;
  lto2_kg: number | null;
  ccd: [number, number][];
}

export interface FuelBurnFile {
  version: string;
  source?: string;
  distance_unit?: string;
  fuel_unit?: string;
  aircraft: Record<string, AircraftFuelBurn>;
}

let store: FuelBurnFile | null = null;

export function setFuelBurn(table: FuelBurnFile): void {
  store = table;
}
export function fuelBurnLoaded(): boolean {
  return store !== null;
}

export function getFuelBurnEntry(icao: string): AircraftFuelBurn | null {
  if (!store) throw new Error("fuel burn not loaded — call loadFuelBurn() first");
  return store.aircraft[icao.toUpperCase()] ?? null;
}

export function fuelBurnVersion(): string | null {
  return store?.version ?? null;
}

/**
 * Linear interpolation/extrapolation of CCD fuel burn at the given NM.
 * Returns null if the aircraft has no CCD data.
 */
export function interpolateCcdFuel(entry: AircraftFuelBurn, ccdNm: number): number | null {
  const pts = entry.ccd;
  if (pts.length === 0) return null;
  // biome-ignore-start lint/style/noNonNullAssertion: every index access below is
  // bounded by the length guards above (length≥1 after the first return, length≥2
  // inside the loop and extrapolation blocks).
  if (pts.length === 1) return pts[0]![1];

  // Find bracketing points
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    if (ccdNm >= x0 && ccdNm <= x1) {
      return y0 + ((ccdNm - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  // Outside the range — extrapolate from the nearest endpoint segment
  if (ccdNm < pts[0]![0]) {
    const [x0, y0] = pts[0]!;
    const [x1, y1] = pts[1]!;
    return y0 + ((ccdNm - x0) * (y1 - y0)) / (x1 - x0);
  }
  const [x0, y0] = pts[pts.length - 2]!;
  const [x1, y1] = pts[pts.length - 1]!;
  return y0 + ((ccdNm - x0) * (y1 - y0)) / (x1 - x0);
  // biome-ignore-end lint/style/noNonNullAssertion: see start
}
