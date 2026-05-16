import { ASSETS } from "../asset-manifest.ts";
import { type MappingFile, setAircraftMapping } from "./data.ts";
import { type FuelBurnFile, setFuelBurn } from "./fuel-burn.ts";
import { type SeatConfigFile, setSeatConfigs } from "./seat-config.ts";

interface AircraftLoadUrls {
  mapping?: string;
  fuelBurn?: string;
  seatConfigs?: string;
}

const DEFAULTS = {
  mapping: ASSETS.aircraftMapping,
  fuelBurn: ASSETS.fuelBurn,
  seatConfigs: ASSETS.seatConfigs,
};

let inflight: Promise<void> | null = null;

/**
 * Load all three aircraft reference assets in parallel:
 *   - IATA→ICAO mapping (Appendix A + aliases)
 *   - EEA fuel-burn curves
 *   - Typical seat configurations
 */
export async function loadAircraftMapping(url: string = DEFAULTS.mapping): Promise<void> {
  setAircraftMapping(await fetchJson<MappingFile>(url));
}

export async function loadFuelBurn(url: string = DEFAULTS.fuelBurn): Promise<void> {
  setFuelBurn(await fetchJson<FuelBurnFile>(url));
}

export async function loadSeatConfigs(url: string = DEFAULTS.seatConfigs): Promise<void> {
  setSeatConfigs(await fetchJson<SeatConfigFile>(url));
}

export function loadAircraftData(urls: AircraftLoadUrls = {}): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      await Promise.all([
        loadAircraftMapping(urls.mapping ?? DEFAULTS.mapping),
        loadFuelBurn(urls.fuelBurn ?? DEFAULTS.fuelBurn),
        loadSeatConfigs(urls.seatConfigs ?? DEFAULTS.seatConfigs),
      ]);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}
