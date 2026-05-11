/**
 * Test-only helpers for bootstrapping in-memory data stores from disk.
 *
 * In production the data is fetched lazily via `loadAirports()` etc.
 * In Node-based unit tests we read the JSON synchronously from `public/`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type MappingFile, setAircraftMapping } from "./aircraft/data.ts";
import { type FuelBurnFile, setFuelBurn } from "./aircraft/fuel-burn.ts";
import { type SeatConfigFile, setSeatConfigs } from "./aircraft/seat-config.ts";
import { type AirportTable, setAirports } from "./airports/data.ts";
import { setGaiaAirports, setGaiaCountries } from "./gaia/data.ts";

const REPO = resolve(fileURLToPath(import.meta.url), "../../..");

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(REPO, rel), "utf8")) as T;
}

let bootstrapped = false;

/** Bootstrap all reference-data stores from public/*.json. Idempotent. */
export function bootstrapTestData(): void {
  if (bootstrapped) return;
  setAirports(load<AirportTable>("data/json/airports.json"));
  setAircraftMapping(load<MappingFile>("data/json/aircraft-mapping.json"));
  setFuelBurn(load<FuelBurnFile>("data/json/eea-fuel-burn.json"));
  setSeatConfigs(load<SeatConfigFile>("data/json/seat-configs.json"));
  setGaiaAirports(load<Record<string, [number, number]>>("data/json/gaia-airports.json"));
  setGaiaCountries(load<Record<string, [number, number]>>("data/json/gaia-countries.json"));
  bootstrapped = true;
}

/** Path-resolve a file in the repo root. */
export function repoPath(rel: string): string {
  return resolve(REPO, rel);
}
