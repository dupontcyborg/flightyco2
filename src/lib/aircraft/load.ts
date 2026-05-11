import { type MappingFile, setAircraftMapping } from "./data.ts";
import { type FuelBurnFile, setFuelBurn } from "./fuel-burn.ts";
import { type SeatConfigFile, setSeatConfigs } from "./seat-config.ts";

interface AircraftLoadUrls {
  mapping?: string;
  fuelBurn?: string;
  seatConfigs?: string;
}

const DEFAULTS = {
  mapping: "/aircraft-mapping.json",
  fuelBurn: "/eea-fuel-burn.json",
  seatConfigs: "/seat-configs.json",
};

let inflight: Promise<void> | null = null;

/**
 * Load all three aircraft reference assets in parallel:
 *   - IATA→ICAO mapping (Appendix A + aliases)
 *   - EEA fuel-burn curves
 *   - Typical seat configurations
 */
export function loadAircraftMapping(url: string = DEFAULTS.mapping): Promise<void> {
  return fetchJson<MappingFile>(url).then(setAircraftMapping);
}

export function loadFuelBurn(url: string = DEFAULTS.fuelBurn): Promise<void> {
  return fetchJson<FuelBurnFile>(url).then(setFuelBurn);
}

export function loadSeatConfigs(url: string = DEFAULTS.seatConfigs): Promise<void> {
  return fetchJson<SeatConfigFile>(url).then(setSeatConfigs);
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
