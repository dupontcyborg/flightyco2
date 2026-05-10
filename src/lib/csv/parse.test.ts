import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseFlightyCsv } from "./parse.ts";

const fixture = fileURLToPath(
  new URL("../../../sample_data/FlightyExport-2026-05-10 (2).csv", import.meta.url),
);

const csv = readFileSync(fixture, "utf8");
const result = parseFlightyCsv(csv);

console.log(`Total rows: ${result.totalRows}`);
console.log(`Parsed:    ${result.flights.length}`);
console.log(`Skipped:   ${result.skipped.length}`);

const cabin = { found: 0, missing: 0 };
const quality = { high: 0, medium: 0, low: 0 };
let cancelled = 0;
for (const f of result.flights) {
  if (f.cabinClass) cabin.found++;
  else cabin.missing++;
  quality[f.quality]++;
  if (f.cancelled) cancelled++;
}
console.log(`Cabin found:   ${cabin.found}`);
console.log(`Cabin missing: ${cabin.missing}`);
console.log(`Quality:       high=${quality.high} medium=${quality.medium} low=${quality.low}`);
console.log(`Cancelled:     ${cancelled}`);

if (result.skipped.length > 0) {
  console.log("First 3 skipped:", result.skipped.slice(0, 3));
}
