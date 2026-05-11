/**
 * Typical per-class seat counts per ICAO aircraft type.
 *
 * Source: hand-curated YAML at data/seat-configs.yaml. See data/README.md
 * for sourcing notes.
 *
 * Unlisted aircraft return the `default` fallback (50-seat single-class
 * narrowbody).
 */

export type AircraftBody = "narrow" | "wide";

export interface SeatConfig {
  body: AircraftBody;
  F: number;
  J: number;
  W: number;
  Y: number;
  total: number;
  note?: string;
}

export interface SeatConfigFile {
  version: string;
  source?: string;
  default: SeatConfig;
  configs: Record<string, SeatConfig>;
}

let store: SeatConfigFile | null = null;

export function setSeatConfigs(table: SeatConfigFile): void {
  store = table;
}
export function seatConfigsLoaded(): boolean {
  return store !== null;
}

export interface SeatConfigLookup {
  config: SeatConfig;
  /** "exact" when this ICAO is in the table; "default" when the fallback was used. */
  source: "exact" | "default";
}

export function getSeatConfig(icao: string): SeatConfigLookup {
  if (!store) throw new Error("seat configs not loaded — call loadSeatConfigs() first");
  const code = icao.toUpperCase();
  const hit = store.configs[code];
  if (hit) return { config: hit, source: "exact" };
  return { config: store.default, source: "default" };
}
