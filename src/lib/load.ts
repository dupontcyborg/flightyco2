/**
 * Single async entry-point for loading all runtime reference data.
 *
 * The UI calls `loadAllReferenceData()` once on uploader mount; everything
 * else (`getAirport()`, `aircraftToIcao()`, `lookupGaia()`, etc.) becomes
 * synchronous after this resolves.
 *
 * All fetches happen in parallel. The total wire transfer is ~310 KB
 * brotli, fetched once per visit, then cached aggressively by the browser
 * and by the in-memory store. Subsequent calls are no-op once data is
 * loaded.
 */

import { loadAircraftData } from "./aircraft/load.ts";
import { loadAirlines } from "./airlines/load.ts";
import { loadAirports } from "./airports/load.ts";
import { loadGaia } from "./gaia/load.ts";

export interface LoadAllUrls {
  airports?: string;
  airlines?: string;
  mapping?: string;
  fuelBurn?: string;
  seatConfigs?: string;
  gaiaAirports?: string;
  gaiaCountries?: string;
}

let cached: Promise<void> | null = null;

export function loadAllReferenceData(urls: LoadAllUrls = {}): Promise<void> {
  if (cached) return cached;
  cached = (async () => {
    try {
      await Promise.all([
        loadAirports(urls.airports),
        loadAirlines(urls.airlines),
        loadAircraftData({
          mapping: urls.mapping,
          fuelBurn: urls.fuelBurn,
          seatConfigs: urls.seatConfigs,
        }),
        loadGaia(urls.gaiaAirports, urls.gaiaCountries),
      ]);
    } catch (err) {
      cached = null;
      throw err;
    }
  })();
  return cached;
}
