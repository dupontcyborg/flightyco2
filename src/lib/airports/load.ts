import { ASSETS } from "../asset-manifest.ts";
import { type AirportTable, setAirports } from "./data.ts";

const DEFAULT_URL = ASSETS.airports;

let inflight: Promise<void> | null = null;

/**
 * Fetch and install the airport table. Concurrent callers share the same
 * in-flight promise; the cache is cleared on settle so future calls can
 * re-fetch (with a different URL, after failure, etc.).
 */
export function loadAirports(url: string = DEFAULT_URL): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`loadAirports: ${url} returned ${res.status}`);
      const table = (await res.json()) as AirportTable;
      setAirports(table);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
