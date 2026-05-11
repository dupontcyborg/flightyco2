/**
 * Reproduce TIM's published worked example.
 *
 *   Route:    ZRH → SFO (LSZH → KSFO)
 *   Aircraft: Boeing 787-9
 *   Cabin:    Economy
 *
 * TIM documents the following intermediate and final values:
 *   GCD               = 9369 km    (5058.9 NM)
 *   distance ratio    = 1.0273      → adjusted 5197.0 NM
 *   CCD distance      = 5180 NM     (after subtracting 17 NM for LTO)
 *   CCD fuel @ 5180   = 54802 kg   (interpolated from 5000→5500)
 *   LTO fuel          = 1638 kg
 *   Total fuel        = 56440 kg
 *   WTW kg CO₂e       = 216498 kg  (× 3.8359)
 *   Passenger share   = 199178 kg  (× 0.92, cargo fraction 8%)
 *   Equiv capacity    = 411.5 seats (188×1 + 21×1.5 + 48×4 + 0×5)
 *   Per economy seat  = 484.029 kg
 *   Per occupied econ = 572.815 kg (÷ 0.845 load factor)
 *
 * The seat configuration in our hand-curated table is (B789, 290 seats:
 * 0F + 28J + 0W + 262Y) — TIM's example uses a slightly different specific
 * configuration (188Y + 21W + 48J + 0F = 257 occupied / 411.5 equiv). We
 * test the algorithm with TIM's exact configuration to isolate algorithm
 * correctness from seat-config approximation, then separately verify our
 * default config against the algorithm with our own seat numbers.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type MappingFile, setAircraftMapping } from "../aircraft/data.ts";
import { type FuelBurnFile, setFuelBurn } from "../aircraft/fuel-burn.ts";
import { type SeatConfigFile, setSeatConfigs } from "../aircraft/seat-config.ts";
import { type AirportTable, setAirports } from "../airports/data.ts";
import { routeDistanceKm } from "../airports/distance.ts";
import { setGaiaAirports, setGaiaCountries } from "../gaia/data.ts";
import { calculateTim } from "./tim.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionOptions } from "./types.ts";

// ─────────────────────────────────────────────────────────────── load reference ──

function loadJson<T>(rel: string): T {
  const path = fileURLToPath(new URL(`../../../${rel}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

setAirports(loadJson<AirportTable>("public/airports.json"));
setAircraftMapping(loadJson<MappingFile>("public/aircraft-mapping.json"));
setFuelBurn(loadJson<FuelBurnFile>("public/eea-fuel-burn.json"));
setGaiaAirports(loadJson<Record<string, [number, number]>>("public/gaia-airports.json"));
setGaiaCountries(loadJson<Record<string, [number, number]>>("public/gaia-countries.json"));

// Override seat config to match TIM's exact ZRH-SFO example configuration
// so we can isolate algorithm correctness from our seat-config approximation.
const TIM_EXAMPLE_SEAT_FILE: SeatConfigFile = {
  version: "tim-example",
  default: { body: "narrow", F: 0, J: 0, W: 0, Y: 50, total: 50 },
  configs: {
    B789: { body: "wide", F: 0, J: 48, W: 21, Y: 188, total: 257 },
  },
};
setSeatConfigs(TIM_EXAMPLE_SEAT_FILE);

// ───────────────────────────────────────────────────────────────────────── test ──

const route = routeDistanceKm("ZRH", "SFO");
if (!route) throw new Error("ZRH-SFO route lookup failed");

console.log(
  `Route: ZRH (${route.from.icao}/${route.from.country}) → SFO (${route.to.icao}/${route.to.country})`,
);
console.log(`GCD: ${route.km.toFixed(1)} km   (TIM example: 9369 km)`);

const optsNoRf: EmissionOptions = { ...DEFAULT_EMISSION_OPTIONS, nonCo2Multiplier: 1 };
const r = calculateTim(
  {
    distanceKm: route.km,
    cabinClass: "economy",
    aircraft: "Boeing 787-9",
    aircraftId: null,
    fromIcao: route.from.icao,
    fromCountry: route.from.country,
    toIcao: route.to.icao,
    toCountry: route.to.country,
  },
  optsNoRf,
);

console.log("\nResults (no RF multiplier, single economy passenger):");
console.log(`  method:       ${r.method}`);
console.log(`  factor ver:   ${r.factorVersion}`);
console.log(`  kg CO₂e:      ${r.kgCo2.toFixed(2)}`);
console.log(`  caveats:      ${r.caveats.length ? r.caveats.join(" | ") : "(none)"}`);

const expected = 572.815;
const delta = Math.abs(r.kgCo2 - expected);
const pct = (delta / expected) * 100;
console.log(`\nTIM published expected: ${expected.toFixed(3)} kg WTW per economy passenger`);
console.log(`Our value:              ${r.kgCo2.toFixed(3)} kg`);
console.log(`Delta:                  ${delta.toFixed(3)} kg  (${pct.toFixed(2)}%)`);

if (pct > 1) {
  console.error(`\n✗ FAIL: delta ${pct.toFixed(2)}% > 1% tolerance`);
  process.exit(1);
}
console.log(`\n✓ PASS: within 1% of TIM's published value`);
