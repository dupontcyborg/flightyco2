# Reference data

This directory holds the **upstream sources** for the emission factors and
route adjustments. Everything in `../public/*.json` is *generated* from what's
here (plus OurAirports, which is fetched fresh each run).

## TL;DR — refresh everything

```bash
npm run data
```

This downloads OurAirports + GAIA fresh and regenerates all three derived
JSON files in `public/`. The EEA spreadsheet has to be downloaded manually
(see below) — it can't be reliably auto-fetched.

---

## What's committed where

| Path | Committed? | Why |
|---|---|---|
| `data/gaia/*.csv` | ✅ | Upstream provenance, small (~1 MB), CC-BY, immutable Zenodo record |
| `data/eea/*.xlsx` | ❌ gitignored | Large, license is murky, URL rotates |
| `public/*.json` | ✅ | Astro serves these directly; no build-time codegen |
| `scripts/update-*.ts` | ✅ | Regeneration toolchain (`npm run data`) |

A clean clone can deploy without running any of the regen scripts. The
scripts are for *updating* the data, not for *building* the app.

---

## Sources

### 1. OurAirports — airport coordinates

**What:** lat/lon, ICAO code, ISO country for every airport on Earth with
an IATA code. Filtered to large + medium airports by default (4,500–5,000
rows, drops heliports and tiny strips).

**License:** Public domain.

**Source URL:** <https://davidmegginson.github.io/ourairports-data/airports.csv>
(fetched live by the script — no committed copy).

**Generates:** `public/airports.json` (~160 KB raw, ~55 KB brotli)

**Refresh:** `npm run data:airports`

---

### 2. GAIA — route distance/fuel adjustment

**What:** per-airport-pair and per-country-pair ratios of actual flown
distance ÷ great-circle distance, plus actual CCD fuel ÷ EEA-predicted CCD
fuel. Calculated from 2019 ADS-B tracking data covering all commercial
flights. Used to adjust great-circle distance and EEA fuel-burn estimates
into realistic numbers.

The statistics drop pairs with fewer than 50 flights in 2019, pairs with
GCD < 50 km, and rows where origin = destination.

**Columns** (`airport-pairs.csv`):
- `origin_destination_airport` — ICAO origin and destination, joined with `-` (e.g. `KJFK-EGLL`)
- `ratio_distance_inefficiency` — actual flown km ÷ great-circle km (always ≥ 1)
- `ratio_ccd_fuel_inefficiency` — actual CCD fuel ÷ great-circle-trajectory CCD fuel from EEA. **Can be < 1** when tailwinds help.

**Columns** (`country-pairs.csv`):
- `origin_destination_country` — ISO alpha-2 origin and destination (e.g. `US-GB`)
- Same two ratios, averaged across all flights between the country pair

**License:** CC-BY 4.0.

**Citation:** Teoh, R., Schumann, U., Voigt, C., et al. (2023). *The high-
resolution Global Aviation emissions Inventory based on ADS-B (GAIA) for
2019 - 2021: Origin-destination statistics.*

**Source:** <https://zenodo.org/records/8369564>

**Files:**
- `data/gaia/airport-pairs.csv` — 36,627 specific ICAO pairs (~890 KB)
- `data/gaia/country-pairs.csv` — 4,494 country pairs (~93 KB)

**Generates:**
- `public/gaia-airports.json` (~994 KB raw, ~221 KB brotli)
- `public/gaia-countries.json` (~105 KB raw, ~25 KB brotli)

**Refresh:** `npm run data:gaia`

---

### 3. EEA Master Emissions Calculator — aircraft fuel burn

**What:** per-aircraft LTO (Landing/Take-Off, fixed) + CCD (Climb/Cruise/
Descend, distance-dependent) fuel-burn tables. 283 ICAO types × ~9 distance
points each. The same data Google's TIM uses.

**License:** EEA materials are reusable under
[Commission Decision 2011/833/EU](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011D0833)
with attribution. The xlsx itself is gitignored because it's macro-protected,
large, and the EEA reorganises its site frequently.

**Source:** EMEP/EEA Air Pollutant Emission Inventory Guidebook 2023, Annex
1.A.3.a Aviation, Master Emissions Calculator. Current version: v1.5_18_09_2024.

**How to get it:**
1. Search: `EMEP/EEA Guidebook 2023 1.A.3.a Aviation Master Emissions Calculator`
2. Open the EEA publication page for "1.A.3.a Aviation"
3. Download the Master Emissions Calculator xlsx (the "Annex 1" file)
4. Drop it at `data/eea/master-emissions-calculator-v1.5.xlsx`

**Generates:** `public/eea-fuel-burn.json` (~50 KB raw, ~11 KB brotli)

**Refresh:** `npm run data:eea`

The extractor verifies B789 against TIM's published example (LTO 1638 kg,
CCD@500NM 5852 kg, CCD@5000NM 52962 kg). If those don't match, the
spreadsheet format has changed and the extractor needs updating.

---

## Other inputs (not under this directory)

- **DEFRA conversion factors** (`src/lib/emissions/factors/defra-2024.ts`) —
  hand-typed from the UK Gov GHG Conversion Factors 2024 spreadsheet
  ("business travel - air" sheet). Small enough to live in source.
- **Typical seat configurations** (`src/lib/emissions/factors/seat-configs.ts` — pending) —
  hand-curated from Boeing/Airbus datasheets and Wikipedia airframe pages.
  TIM uses proprietary OAG data we can't access; this is our approximation.
