import { ASSETS } from "../asset-manifest.ts";
import { type AirlineTable, setAirlines } from "./data.ts";

const DEFAULT_URL = ASSETS.airlines;

let inflight: Promise<void> | null = null;

export function loadAirlines(url: string = DEFAULT_URL): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`loadAirlines: ${url} returned ${res.status}`);
      const table = (await res.json()) as AirlineTable;
      setAirlines(table);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
