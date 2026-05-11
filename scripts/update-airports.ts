/**
 * Refresh public/airports.json from OurAirports.
 *
 * Output schema: { IATA: [lat, lon, ICAO, ISO_country] }
 *   - lat, lon: rounded to 4 decimals (~11m precision)
 *   - ICAO: 4-letter code, or empty string if absent
 *   - ISO_country: 2-letter (ISO 3166 alpha-2)
 *
 * Source: https://ourairports.com/data/ (public domain)
 *
 * Default: re-parse from cached CSV in data/ourairports/. Pass --force to
 * re-download the CSV.
 *
 * Run: npm run data:airports [-- --force]
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { downloadIfMissing, logFetch, parseFlags } from "./lib/cli.ts";

const OURAIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const CACHE = resolve(REPO, "data/ourairports/airports.csv");
const OUTPUT = resolve(REPO, "public/airports.json");

const KEEP_TYPES = new Set(["large_airport", "medium_airport"]);
const ICAO_RE = /^[A-Z]{4}$/;

interface OurAirportsRow {
  iata_code?: string;
  icao_code?: string;
  ident?: string;
  type?: string;
  latitude_deg?: string;
  longitude_deg?: string;
  iso_country?: string;
}

function extractIcao(row: OurAirportsRow): string {
  for (const field of ["icao_code", "ident"] as const) {
    const v = (row[field] ?? "").trim().toUpperCase();
    if (ICAO_RE.test(v)) return v;
  }
  return "";
}

async function main(): Promise<void> {
  const flags = parseFlags();
  const outcome = await downloadIfMissing(OURAIRPORTS_URL, CACHE, flags);
  logFetch("OurAirports airports.csv", outcome, statSync(CACHE).size);

  const csv = readFileSync(CACHE, "utf8");
  const parsed = Papa.parse<OurAirportsRow>(csv, { header: true, skipEmptyLines: true });
  console.log(`  ${parsed.data.length.toLocaleString()} rows`);

  const out: Record<string, [number, number, string, string]> = {};
  for (const row of parsed.data) {
    const iata = (row.iata_code ?? "").trim().toUpperCase();
    if (iata.length !== 3 || !/^[A-Z]{3}$/.test(iata)) continue;
    if (!KEEP_TYPES.has(row.type ?? "")) continue;
    const lat = Number.parseFloat(row.latitude_deg ?? "");
    const lon = Number.parseFloat(row.longitude_deg ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    out[iata] = [
      Math.round(lat * 10000) / 10000,
      Math.round(lon * 10000) / 10000,
      extractIcao(row),
      (row.iso_country ?? "").trim().toUpperCase(),
    ];
  }

  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  const iataCount = Object.keys(sorted).length;
  const icaoCount = Object.values(sorted).filter((v) => v[2]).length;
  const countries = new Set(
    Object.values(sorted)
      .map((v) => v[3])
      .filter(Boolean),
  );

  console.log(`Filtered: ${iataCount.toLocaleString()} airports with IATA codes`);
  console.log(
    `  with ICAO code:     ${icaoCount.toLocaleString()}  (${((100 * icaoCount) / iataCount).toFixed(1)}%)`,
  );
  console.log(`  distinct countries: ${countries.size.toLocaleString()}`);

  const payload = JSON.stringify(sorted);
  writeFileSync(OUTPUT, payload);
  console.log(`\nWrote ${OUTPUT} (${(payload.length / 1024).toFixed(1)} KB raw)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
