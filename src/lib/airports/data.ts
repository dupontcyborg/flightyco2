/**
 * In-memory airport reference data.
 *
 * The actual data is fetched at runtime from the content-hashed URL in
 * `src/lib/asset-manifest.ts` (generated from `data/json/airports.json`).
 * Tests can populate the store directly via `setAirports()` to avoid a
 * network round-trip.
 */

export interface Airport {
  iata: string;
  lat: number;
  lon: number;
  icao: string;
  country: string;
}

export type AirportRecord = readonly [lat: number, lon: number, icao: string, country: string];
export type AirportTable = Record<string, AirportRecord>;

let store: AirportTable | null = null;

export function setAirports(table: AirportTable): void {
  store = table;
}

export function clearAirports(): void {
  store = null;
}

export function airportsLoaded(): boolean {
  return store !== null;
}

export function getAirport(iata: string): Airport | null {
  if (!store) throw new Error("airports not loaded — call loadAirports() first");
  const code = iata.toUpperCase();
  const row = store[code];
  if (!row) return null;
  return { iata: code, lat: row[0], lon: row[1], icao: row[2], country: row[3] };
}
