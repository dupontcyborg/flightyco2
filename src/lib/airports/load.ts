import { type AirportTable, setAirports } from "./data.ts";

const DEFAULT_URL = "/airports.json";

let inflight: Promise<void> | null = null;

/**
 * Fetch and install the airport table. Idempotent — concurrent callers share
 * the same in-flight promise; subsequent calls after success are a no-op.
 */
export function loadAirports(url: string = DEFAULT_URL): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`loadAirports: ${url} returned ${res.status}`);
    const table = (await res.json()) as AirportTable;
    setAirports(table);
  })();
  return inflight;
}
