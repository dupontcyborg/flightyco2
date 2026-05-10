import { readFileSync } from "node:fs";
import Papa from "papaparse";

const path = process.argv[2];
if (!path) {
  console.error("usage: tsx scripts/inspect-cabin.ts <csv-path>");
  process.exit(1);
}

const csv = readFileSync(path, "utf8");
const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });

const filled = result.data.filter((r) => (r["Cabin Class"] ?? "").trim() !== "");
console.log(`Rows total: ${result.data.length}`);
console.log(`Rows with cabin class: ${filled.length}`);
console.log("---");
for (const r of filled) {
  console.log(
    `${r.Date} ${r.From}->${r.To}  cabin="${r["Cabin Class"]}"  seat-type="${r["Seat Type"]}"  cabin-id="${r["Aircraft Type Flighty ID"]}"`,
  );
}
