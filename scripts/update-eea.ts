/**
 * Refresh data/json/eea-fuel-burn.json from the EEA Master Emissions Calculator xlsx.
 *
 * Source: EMEP/EEA Air Pollutant Emission Inventory Guidebook 2023, Annex
 * 1.A.3.a Aviation, Master Emissions Calculator v1.5_18_09_2024.
 *
 * Output schema:
 *   {
 *     "version": "EEA-MEC-2023-v1.5_18_09_2024",
 *     "aircraft": {
 *       "B789": {
 *         "lto_kg":   1638.46,
 *         "lto2_kg":  1508.26,
 *         "ccd":      [[125, 1883.1], ..., [8000, 84779.1]]
 *       }
 *     }
 *   }
 *
 * Reads the "database" sheet. Columns:
 *   A: ICAO_ID (side index, ignored)
 *   B: AIRCRAFT ID (variant code)
 *   C: IMPACT ACFT ID  ← grouping key (this is the canonical ICAO type)
 *   J: LTO or CCD       ← row 9 in 0-indexed
 *   L: ADES              ← distance in NM, row 11
 *   N: FORECAST FUEL BURNT KG  ← row 13
 *
 * Run: npm run data:eea
 *
 * The xlsx is gitignored; see data/README.md for how to obtain it.
 */

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const XLSX = resolve(REPO, "data/eea/master-emissions-calculator-v1.5.xlsx");
const OUT = resolve(REPO, "data/json/eea-fuel-burn.json");
const VERSION = "EEA-MEC-2023-v1.5_18_09_2024";

interface AircraftEntry {
  lto_kg: number | null;
  lto2_kg: number | null;
  ccd: [number, number][];
}

async function main(): Promise<void> {
  if (!existsSync(XLSX)) {
    console.log(`==> EEA xlsx not present at ${XLSX}`);
    console.log("    See data/README.md § EEA for how to obtain it.");
    console.log("    Existing data/json/eea-fuel-burn.json (if any) is unchanged.");
    return;
  }

  console.log(`Reading ${XLSX}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet("database");
  if (!ws) throw new Error("'database' sheet not found");

  const aircraft = new Map<string, AircraftEntry>();

  // Data starts at row 3. Columns are 1-indexed in ExcelJS.
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum < 3) return;
    const icao = row.getCell(3).value; // IMPACT ACFT ID
    const phase = row.getCell(10).value; // LTO / LTO-2 / CCD
    const ades = row.getCell(12).value; // distance NM
    const fuel = row.getCell(14).value; // FUEL BURNT KG

    if (typeof icao !== "string" || !icao) return;
    if (typeof phase !== "string" || !phase) return;
    const fuelNum = typeof fuel === "number" ? fuel : Number.parseFloat(String(fuel));
    if (!Number.isFinite(fuelNum)) return;

    let entry = aircraft.get(icao);
    if (!entry) {
      entry = { lto_kg: null, lto2_kg: null, ccd: [] };
      aircraft.set(icao, entry);
    }

    if (phase === "LTO") {
      entry.lto_kg = Math.round(fuelNum * 100) / 100;
    } else if (phase === "LTO-2") {
      entry.lto2_kg = Math.round(fuelNum * 100) / 100;
    } else if (phase === "CCD") {
      const adesNum = typeof ades === "number" ? ades : Number.parseFloat(String(ades));
      if (Number.isFinite(adesNum)) {
        entry.ccd.push([Math.round(adesNum), Math.round(fuelNum * 100) / 100]);
      }
    }
  });

  for (const entry of aircraft.values()) {
    entry.ccd.sort((a, b) => a[0] - b[0]);
  }

  const full = [...aircraft.values()].filter((e) => e.lto_kg !== null && e.ccd.length > 0).length;
  console.log(`  Aircraft types: ${aircraft.size}`);
  console.log(`  With LTO + CCD: ${full}`);
  console.log(`  Partial:        ${aircraft.size - full}`);
  console.log(`  Total CCD pts:  ${[...aircraft.values()].reduce((n, e) => n + e.ccd.length, 0)}`);

  // Sanity check against TIM's published Table 1 (B789).
  const b789 = aircraft.get("B789");
  if (b789) {
    const ccd500 = b789.ccd.find(([d]) => d === 500)?.[1];
    const ccd5000 = b789.ccd.find(([d]) => d === 5000)?.[1];
    console.log(`\n  B789 LTO     = ${b789.lto_kg} kg  (TIM expects 1638)`);
    console.log(`  B789 CCD500  = ${ccd500} kg  (TIM expects 5852)`);
    console.log(`  B789 CCD5000 = ${ccd5000} kg  (TIM expects 52962)`);
  }

  const sorted = Object.fromEntries([...aircraft.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const payload = JSON.stringify({
    version: VERSION,
    source: "EMEP/EEA Guidebook 2023, 1.A.3.a Aviation Master Emissions Calculator",
    distance_unit: "nautical_miles",
    fuel_unit: "kg",
    phases: {
      LTO: "Landing + Take-Off cycle (~17 NM)",
      "LTO-2": "Reduced LTO variant",
      CCD: "Climb + Cruise + Descend at given CCD distance",
    },
    aircraft: sorted,
  });
  writeFileSync(OUT, payload);
  console.log(`\nWrote ${OUT} (${(payload.length / 1024).toFixed(1)} KB raw)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
