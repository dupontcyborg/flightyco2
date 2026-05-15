/**
 * Extract DEFRA 2024 GHG Conversion Factors for air travel into
 * data/json/defra-factors.json.
 *
 * Source: UK Government GHG Conversion Factors 2024, "Business travel- air"
 * sheet of the full-set xlsx (data/uk-gov/...).
 *
 * Output schema:
 *   {
 *     "version": "DEFRA-2024-v1.1",
 *     "source": "UK Gov GHG Conversion Factors 2024 — Business travel- air",
 *     "factors": {
 *       "domestic_uk":   { "average": [withRF, withoutRF] },
 *       "short_haul_uk": { "average": [..], "economy": [..], "business": [..] },
 *       "long_haul_uk":  { "average": [..], "economy": [..], "premium_economy": [..], "business": [..], "first": [..] },
 *       "international": { same shape as long_haul_uk }
 *     },
 *     "haul_by_alpha3": { "FRA": "short_haul_uk", "USA": "long_haul_uk", ... },
 *     "domestic_uk_alpha3": ["GBR", "GGY", "IMN", "JEY"]
 *   }
 *
 * Run: npm run data:defra
 */

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const XLSX = resolve(REPO, "data/uk-gov/ghg-conversion-factors-2024-full.xlsx");
const OUT = resolve(REPO, "data/json/defra-factors.json");
const VERSION = "DEFRA-2024-v1.1";

type HaulCategory = "domestic_uk" | "short_haul_uk" | "long_haul_uk" | "international";
type CabinKey = "average" | "economy" | "premium_economy" | "business" | "first";
type Factors = Record<HaulCategory, Partial<Record<CabinKey, [number, number]>>>;

const HAUL_LABEL_MAP: Record<string, HaulCategory> = {
  "Domestic, to/from UK": "domestic_uk",
  "Short-haul, to/from UK": "short_haul_uk",
  "Long-haul, to/from UK": "long_haul_uk",
  "International, to/from non-UK": "international",
};

const CABIN_LABEL_MAP: Record<string, CabinKey> = {
  "Average passenger": "average",
  "Economy class": "economy",
  "Premium economy class": "premium_economy",
  "Business class": "business",
  "First class": "first",
};

function cellText(cell: ExcelJS.CellValue): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") return cell;
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "object" && "richText" in cell) {
    return (cell.richText as { text: string }[]).map((r) => r.text).join("");
  }
  return String(cell);
}

function cellNumber(cell: ExcelJS.CellValue): number | null {
  if (typeof cell === "number") return cell;
  const s = cellText(cell).trim();
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

async function main(): Promise<void> {
  if (!existsSync(XLSX)) {
    console.error(`DEFRA xlsx not present at ${XLSX}`);
    console.error("Drop it there (see data/README.md § DEFRA) and re-run.");
    process.exit(1);
  }

  console.log(`Reading ${XLSX}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);

  // 1. Extract factor table from "Business travel- air"
  const airSheet = wb.getWorksheet("Business travel- air");
  if (!airSheet) throw new Error("'Business travel- air' sheet missing");

  const factors: Factors = {
    domestic_uk: {},
    short_haul_uk: {},
    long_haul_uk: {},
    international: {},
  };

  // Factor rows start at row 23 in the v1.1 spreadsheet
  for (let r = 23; r <= 36; r++) {
    const row = airSheet.getRow(r);
    const haulLabel = cellText(row.getCell(2).value);
    const cabinLabel = cellText(row.getCell(3).value);
    const withRf = cellNumber(row.getCell(5).value);
    const withoutRf = cellNumber(row.getCell(9).value);
    if (!haulLabel || !cabinLabel || withRf === null || withoutRf === null) continue;

    const haul = HAUL_LABEL_MAP[haulLabel];
    const cabin = CABIN_LABEL_MAP[cabinLabel];
    if (!haul || !cabin) {
      console.warn(
        `  skipping row ${r}: haul=${JSON.stringify(haulLabel)} cabin=${JSON.stringify(cabinLabel)}`,
      );
      continue;
    }
    factors[haul][cabin] = [withRf, withoutRf];
  }

  // Summary
  for (const haul of Object.keys(factors) as HaulCategory[]) {
    const cabins = Object.keys(factors[haul]);
    console.log(`  ${haul}: ${cabins.length} cabin classes — ${cabins.join(", ")}`);
  }

  // 2. Extract haul definition (country → category)
  const haulSheet = wb.getWorksheet("Haul definition");
  if (!haulSheet) throw new Error("'Haul definition' sheet missing");

  const haulByAlpha3: Record<string, HaulCategory> = {};
  const domesticUk: string[] = [];
  // Rows 6+ are data (header at row 5)
  for (let r = 6; r <= haulSheet.rowCount; r++) {
    const row = haulSheet.getRow(r);
    const alpha3 = cellText(row.getCell(2).value).trim().toUpperCase();
    const haulRaw = cellText(row.getCell(3).value).trim();
    if (!alpha3 || !haulRaw) continue;
    if (alpha3.length !== 3) continue;
    if (haulRaw === "Domestic") {
      haulByAlpha3[alpha3] = "domestic_uk";
      domesticUk.push(alpha3);
    } else if (haulRaw === "Short Haul") {
      haulByAlpha3[alpha3] = "short_haul_uk";
    } else if (haulRaw === "Long Haul") {
      haulByAlpha3[alpha3] = "long_haul_uk";
    }
  }
  console.log(
    `  haul definition: ${Object.keys(haulByAlpha3).length} countries — domestic=${domesticUk.length}, short=${Object.values(haulByAlpha3).filter((v) => v === "short_haul_uk").length}, long=${Object.values(haulByAlpha3).filter((v) => v === "long_haul_uk").length}`,
  );

  // 3. RF multiplier sanity check (DEFRA 2024 uses 1.7 applied to CO2)
  const longHaulEcon = factors.long_haul_uk.economy;
  if (longHaulEcon) {
    const ratio = longHaulEcon[0] / longHaulEcon[1];
    console.log(`  RF multiplier (total kgCO2e ratio, long-haul UK economy): ${ratio.toFixed(4)}`);
    if (Math.abs(ratio - 1.694) > 0.01) {
      console.warn(`  ⚠ unexpected RF ratio (expected ~1.694, got ${ratio.toFixed(4)})`);
    }
  }

  const payload = JSON.stringify({
    version: VERSION,
    source: "UK Gov GHG Conversion Factors 2024 — Business travel- air (full set v1.1)",
    license: "Open Government Licence v3.0",
    note: "Factor pairs are [withRF, withoutRF] in kg CO2e per passenger.km. DEFRA 2024 RF uplift is ~1.7 (applied to CO2 component); total kgCO2e ratio works out to ~1.694 because CH4/N2O don't get the uplift.",
    factors,
    haul_by_alpha3: haulByAlpha3,
    domestic_uk_alpha3: domesticUk,
  });
  writeFileSync(OUT, payload);
  console.log(`\nWrote ${OUT} (${(payload.length / 1024).toFixed(1)} KB raw)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
