/**
 * Refresh data/gaia/*.csv from Zenodo and rebuild public/gaia-*.json.
 *
 * Default: re-parse from cached CSVs. Pass --force to re-download from Zenodo.
 *
 * Source: Teoh et al. (2023) — https://zenodo.org/records/8369564 (CC-BY 4.0)
 *
 * Run: npm run data:gaia [-- --force]
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { downloadIfMissing, logFetch, parseFlags } from "./lib/cli.ts";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const GAIA_DIR = resolve(REPO, "data/gaia");
const OUT_DIR = resolve(REPO, "data/json");

const SOURCES = [
  {
    url: "https://zenodo.org/records/8369564/files/origin_destination_airport_gaia_vs_eea.csv",
    csv: "airport-pairs.csv",
    json: "gaia-airports.json",
    keyCol: "origin_destination_airport",
  },
  {
    url: "https://zenodo.org/records/8369564/files/origin_destination_country_gaia_vs_eea.csv",
    csv: "country-pairs.csv",
    json: "gaia-countries.json",
    keyCol: "origin_destination_country",
  },
];

interface GaiaRow {
  ratio_distance_inefficiency: string;
  ratio_ccd_fuel_inefficiency: string;
  [key: string]: string;
}

function convert(csvPath: string, jsonPath: string, keyCol: string): void {
  const csv = readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<GaiaRow>(csv, { header: true, skipEmptyLines: true });
  const table: Record<string, [number, number]> = {};
  for (const row of parsed.data) {
    const key = (row[keyCol] ?? "").trim();
    if (!key) continue;
    const dist = Number.parseFloat(row.ratio_distance_inefficiency);
    const fuel = Number.parseFloat(row.ratio_ccd_fuel_inefficiency);
    if (!Number.isFinite(dist) || !Number.isFinite(fuel)) continue;
    table[key] = [Math.round(dist * 10000) / 10000, Math.round(fuel * 10000) / 10000];
  }
  const payload = JSON.stringify(table);
  writeFileSync(jsonPath, payload);
  console.log(
    `  ${jsonPath.split("/").pop()}: ${Object.keys(table).length.toLocaleString()} rows, ${(payload.length / 1024).toFixed(1)} KB raw`,
  );
}

async function main(): Promise<void> {
  const flags = parseFlags();
  for (const src of SOURCES) {
    const csvPath = resolve(GAIA_DIR, src.csv);
    const outcome = await downloadIfMissing(src.url, csvPath, flags);
    logFetch(src.csv, outcome, statSync(csvPath).size);
  }

  console.log("\nBuilding GAIA JSON tables");
  for (const src of SOURCES) {
    convert(resolve(GAIA_DIR, src.csv), resolve(OUT_DIR, src.json), src.keyCol);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
