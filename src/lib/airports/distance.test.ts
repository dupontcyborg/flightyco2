import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseFlightyCsv } from "../csv/parse.ts";
import { type AirportTable, setAirports } from "./data.ts";
import { routeDistanceKm } from "./distance.ts";

// Bootstrap: load the static JSON from disk and populate the in-memory store.
const airportsPath = fileURLToPath(new URL("../../../public/airports.json", import.meta.url));
setAirports(JSON.parse(readFileSync(airportsPath, "utf8")) as AirportTable);

const knownRoutes: { from: string; to: string; expectedKm: number }[] = [
  { from: "JFK", to: "LAX", expectedKm: 3974 },
  { from: "JFK", to: "LHR", expectedKm: 5540 },
  { from: "SFO", to: "NRT", expectedKm: 8270 },
  { from: "CDG", to: "ATL", expectedKm: 7080 },
  { from: "LGA", to: "BOS", expectedKm: 295 },
];

console.log("Known-route checks:");
for (const r of knownRoutes) {
  const result = routeDistanceKm(r.from, r.to);
  if (!result) {
    console.log(`  ${r.from}->${r.to}  MISSING`);
    continue;
  }
  const delta = Math.abs(result.km - r.expectedKm);
  const pct = (delta / r.expectedKm) * 100;
  const ok = pct < 2 ? "✓" : "✗";
  console.log(
    `  ${ok} ${r.from}->${r.to}  ${result.km.toFixed(0)}km (expected ~${r.expectedKm}, Δ ${pct.toFixed(2)}%)`,
  );
}

// ICAO + country baked-in check
const jfk = routeDistanceKm("JFK", "LHR");
if (jfk) {
  console.log(`\nJFK metadata: icao=${jfk.from.icao} country=${jfk.from.country}`);
  console.log(`LHR metadata: icao=${jfk.to.icao} country=${jfk.to.country}`);
}

const fixture = fileURLToPath(
  new URL("../../../sample_data/FlightyExport-2026-05-10 (2).csv", import.meta.url),
);
const { flights } = parseFlightyCsv(readFileSync(fixture, "utf8"));

let resolved = 0;
let missing = 0;
let totalKm = 0;
const missingCodes = new Set<string>();
for (const f of flights) {
  if (f.cancelled) continue;
  const r = routeDistanceKm(f.from, f.to);
  if (r) {
    resolved++;
    totalKm += r.km;
  } else {
    missing++;
    missingCodes.add(f.from);
    missingCodes.add(f.to);
  }
}

console.log("\nFixture coverage:");
console.log(`  Flights resolved: ${resolved}`);
console.log(`  Flights missing:  ${missing}`);
console.log(`  Total km flown:   ${totalKm.toFixed(0)} (${(totalKm * 0.621371).toFixed(0)} mi)`);
if (missing > 0) console.log(`  Unresolved codes: ${[...missingCodes].sort().join(", ")}`);
