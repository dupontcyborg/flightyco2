/**
 * In-memory ICAO→IATA airline code mapping.
 *
 * Flighty exports airline as 3-letter ICAO (e.g. "DAL"); this table maps to
 * the 2-letter IATA (e.g. "DL") used in public-facing flight numbers.
 * Sourced from OpenFlights' airlines dataset, filtered to active carriers
 * with both codes present. Coverage isn't 100% — call sites should fall
 * back to the original ICAO when no mapping is found.
 */

export type AirlineTable = Record<string, string>;

let store: AirlineTable | null = null;

export function setAirlines(table: AirlineTable): void {
  store = table;
}

export function clearAirlines(): void {
  store = null;
}

export function airlinesLoaded(): boolean {
  return store !== null;
}

export function icaoToIata(icao: string | null | undefined): string | null {
  if (!icao || !store) return null;
  return store[icao.toUpperCase()] ?? null;
}
