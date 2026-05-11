import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { aircraftToIcao, type MappingFile, setAircraftMapping } from "../aircraft/data.ts";
import { type FuelBurnFile, setFuelBurn } from "../aircraft/fuel-burn.ts";
import { type SeatConfigFile, setSeatConfigs } from "../aircraft/seat-config.ts";
import { type AirportTable, setAirports } from "../airports/data.ts";
import { routeDistanceKm } from "../airports/distance.ts";
import { parseFlightyCsv } from "../csv/parse.ts";
import { setGaiaAirports, setGaiaCountries } from "../gaia/data.ts";
import { calculateDefra, calculateTim } from "./index.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionInput, type EmissionOptions } from "./types.ts";

function loadJson<T>(rel: string): T {
  const path = fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

setAirports(loadJson<AirportTable>("public/airports.json"));
setAircraftMapping(loadJson<MappingFile>("public/aircraft-mapping.json"));
setFuelBurn(loadJson<FuelBurnFile>("public/eea-fuel-burn.json"));
setSeatConfigs(loadJson<SeatConfigFile>("public/seat-configs.json"));
setGaiaAirports(loadJson<Record<string, [number, number]>>("public/gaia-airports.json"));
setGaiaCountries(loadJson<Record<string, [number, number]>>("public/gaia-countries.json"));

const fixture = fileURLToPath(
  new URL("../../../sample_data/FlightyExport-2026-05-10 (2).csv", import.meta.url),
);
const { flights } = parseFlightyCsv(readFileSync(fixture, "utf8"));

interface Totals {
  kgCo2e: number;
  kgCo2: number;
  count: number;
  fellBack: number;
}

function buildInput(f: (typeof flights)[number]): EmissionInput | null {
  const route = routeDistanceKm(f.from, f.to);
  if (!route) return null;
  return {
    distanceKm: route.km,
    cabinClass: f.cabinClass,
    aircraft: f.aircraft,
    aircraftId: f.aircraftId,
    fromIcao: route.from.icao,
    fromCountry: route.from.country,
    toIcao: route.to.icao,
    toCountry: route.to.country,
  };
}

function runDefra(options: EmissionOptions): Totals {
  const t: Totals = { kgCo2e: 0, kgCo2: 0, count: 0, fellBack: 0 };
  for (const f of flights) {
    if (f.cancelled) continue;
    const input = buildInput(f);
    if (!input) continue;
    const r = calculateDefra(input, options);
    t.kgCo2 += r.kgCo2;
    t.kgCo2e += r.kgCo2e;
    t.count++;
  }
  return t;
}
function runTim(options: EmissionOptions): Totals {
  const t: Totals = { kgCo2e: 0, kgCo2: 0, count: 0, fellBack: 0 };
  for (const f of flights) {
    if (f.cancelled) continue;
    const input = buildInput(f);
    if (!input) continue;
    const r = calculateTim(input, options);
    t.kgCo2 += r.kgCo2;
    t.kgCo2e += r.kgCo2e;
    t.count++;
    if (r.method === "DEFRA-2024") t.fellBack++;
  }
  return t;
}

const fmt = (kg: number) => `${(kg / 1000).toFixed(2)} t`;

console.log("Lifetime totals (cabin fallback = economy):");

const withRf = DEFAULT_EMISSION_OPTIONS;
const withoutRf: EmissionOptions = { ...DEFAULT_EMISSION_OPTIONS, nonCo2Multiplier: 1 };

const defra = runDefra(withRf);
const defraNoRf = runDefra(withoutRf);
const tim = runTim(withRf);
const timNoRf = runTim(withoutRf);

console.log("\nDEFRA 2024:");
console.log(`  with 1.9× RF:    ${fmt(defra.kgCo2e)} CO₂e`);
console.log(`  without RF:      ${fmt(defraNoRf.kgCo2)} CO₂`);
console.log(`  flights:         ${defra.count}`);

console.log("\nTIM 3.0.0:");
console.log(`  with 1.9× RF:    ${fmt(tim.kgCo2e)} CO₂e`);
console.log(`  without RF:      ${fmt(timNoRf.kgCo2)} CO₂`);
console.log(`  flights:         ${tim.count}`);
console.log(`  fell back to DEFRA: ${tim.fellBack}`);

const delta = tim.kgCo2e - defra.kgCo2e;
const pct = (delta / defra.kgCo2e) * 100;
console.log(
  `\nDivergence (TIM vs DEFRA, with RF): ${delta >= 0 ? "+" : ""}${fmt(delta)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
);

console.log("\nComparisons (TIM with RF):");
console.log(
  `  vs avg American (16t/yr × 18yr = 288t): ${((tim.kgCo2e / 1000 / 288) * 100).toFixed(0)}%`,
);
console.log(
  `  vs 1.5°C-aligned budget (2t/yr × 18yr = 36t): ${(tim.kgCo2e / 1000 / 36).toFixed(1)}× over`,
);

// Mapping coverage
console.log("\nAircraft mapping coverage:");
const hits = { exact: 0, substring: 0, miss: 0 };
let total = 0;
for (const f of flights) {
  if (f.cancelled) continue;
  total++;
  if (!f.aircraft) {
    hits.miss++;
    continue;
  }
  const l = aircraftToIcao(f.aircraft);
  hits[l?.matchType ?? "miss"]++;
}
console.log(
  `  exact: ${hits.exact}  substring: ${hits.substring}  unmapped: ${hits.miss}  total: ${total}`,
);
