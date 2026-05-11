# flightyco2

An honest flight-emissions calculator for users of [Flighty](https://flightyapp.com).

Upload your Flighty CSV export, get a per-year and per-flight breakdown of your carbon footprint computed with Google's Travel Impact Model and DEFRA 2024 factors. All processing happens client-side - the CSV never leaves your browser.

## What's in the box

- Two emission methods:
  - **TIM 3.0.0** - faithful port of Google's Travel Impact Model, validated against its published worked example to 0.07%. Reads per-aircraft EEA fuel-burn curves, route-specific distance adjustments (GAIA), CORSIA well-to-wake conversion, seat-area class allocation.
  - **DEFRA 2024** - UK Gov GHG conversion factors, verified against the published spreadsheet to 5 decimal places.
- Transparent fallback: when TIM lacks data for a flight (no aircraft string, unmapped ICAO), it falls back to DEFRA with an explicit caveat attached to the result.
- Non-CO₂ effects on by default: 1.9× radiative-forcing uplift, toggleable in the UI.
- Honest data quality reporting: every flight carries `cabinSource`, `matchType`, and `caveats` fields surfacing how the number was computed.

---

## Tech stack

- Astro 6 static shell + Svelte 5 islands (uploader, charts)
- TypeScript 5.9, Tailwind v4, Biome 2, Vitest
- PapaParse for CSV, Zod for validation, ExcelJS for xlsx
  extraction (dev only)
- Hosted on Cloudflare Pages (static)

---

## Local development

Requires Node 20+ and npm.

```bash
git clone <repo-url>
cd flightyco2
npm install

npm run dev          # Astro dev server (predev regenerates asset hashes)
npm test             # Vitest, ~250 ms
npm run test:watch   # Vitest watch mode
npm run test:coverage
npm run build        # Production build (prebuild regenerates asset hashes)
npm run lint         # Biome
npm run fix          # Biome --write
```

All tests run on a fresh clone with no private data needed - the
end-to-end regression uses
[`sample_data/canonical-fixture.csv`](./sample_data/canonical-fixture.csv).

---

## Data pipeline

The calculation library depends on six reference JSON files (~1.4 MB raw,
~315 KB brotli) covering airports, aircraft, fuel-burn curves, route
adjustments, seat configurations, and emission factors. They are
generated from upstream sources by a TypeScript pipeline and served via
content-addressable URLs.

### Layout

```
data/                          curated + upstream sources
├── eea/*.xlsx                 EEA Master Emissions Calculator        (gitignored)
├── gaia/*.csv                 Zenodo GAIA route adjustment            (committed, CC-BY)
├── ourairports/airports.csv   OurAirports cache                       (gitignored)
├── tim/README.md              Google TIM README                       (gitignored)
├── uk-gov/*.xlsx              UK Gov DEFRA factors                    (gitignored)
├── seat-configs.yaml          Hand-curated typical configurations     (committed)
├── aircraft-aliases.yaml      Hand-curated IATA->ICAO aliases         (committed)
└── json/*.json                Built reference data                    (committed)

public/
├── *.[hash].json              Content-hashed reference data           (gitignored, regenerated)
└── _headers                   Cloudflare Pages cache config           (committed)

src/lib/asset-manifest.ts      Maps logical names to hashed URLs       (committed, generated)
```

### Refreshing the data

```bash
npm run data                # run the full pipeline (all six sources)
npm run data:airports       # OurAirports only
npm run data:gaia           # Zenodo GAIA only
npm run data:eea            # EEA Master Emissions Calculator only
npm run data:tim            # Google TIM README only
npm run data:defra          # UK Gov DEFRA xlsx only
npm run data:seats          # YAML -> JSON only
npm run hash-assets         # regenerate content-hashed copies + manifest
```

Add `-- --force` to any sub-command to bypass the on-disk fetch cache and
re-download from upstream:

```bash
npm run data:gaia -- --force
```

### What runs when

```
npm run data
 -> update-airports.ts        OurAirports CSV          -> data/json/airports.json
    update-gaia.ts            Zenodo GAIA CSVs         -> data/json/gaia-{airports,countries}.json
    update-eea.ts             EEA xlsx                 -> data/json/eea-fuel-burn.json
    build-seat-configs.ts     data/seat-configs.yaml   -> data/json/seat-configs.json
    update-tim-mapping.ts     TIM README + aliases     -> data/json/aircraft-mapping.json
    update-defra.ts           UK Gov xlsx              -> data/json/defra-factors.json
    hash-public-assets.ts     data/json/*.json         -> public/*.[hash].json
                                                       -> src/lib/asset-manifest.ts (regenerated)

npm run dev    (predev hook runs hash-public-assets.ts before the dev server starts)
npm run build  (prebuild hook runs hash-public-assets.ts before astro build)
```

A fresh clone deploys with no manual data step:

```bash
npm install && npm run build && npx wrangler pages deploy dist
```

Source-of-truth JSONs live in `data/json/` (committed). The content-hashed
copies in `public/` are build artifacts (gitignored), regenerated by the
`prebuild` hook. The hash step also rewrites `src/lib/asset-manifest.ts`,
which loaders import to know which URL to fetch.

See [`data/README.md`](./data/README.md) for upstream source attribution
and licenses.

---

## Repository layout

```
src/
├── lib/                       calculation engine (UI-free, fully test-covered)
│   ├── airports/              IATA + ICAO + country lookup, great-circle distance
│   ├── aircraft/              IATA->ICAO mapping, EEA fuel-burn, seat configs
│   ├── gaia/                  Three-tier route adjustment (airport/country/default)
│   ├── csv/                   Flighty CSV parsing, codeshare dedupe, hash
│   ├── emissions/             DEFRA + TIM calculators
│   ├── aggregation/           Per-year, per-month, by-aircraft, by-cabin, top-N
│   ├── comparisons.ts         vs. avg American / 1.5C budget / km driven
│   ├── load.ts                Single async entry-point for the UI
│   ├── asset-manifest.ts      Generated: hashed URLs for /public assets
│   └── index.ts               Public surface for UI imports
├── pages/                     Astro routes (in progress)
├── layouts/                   Astro layouts
└── styles/                    Tailwind entry point

scripts/                       Data pipeline (all TypeScript, run via tsx)
sample_data/                   Canonical test fixture + personal exports
public/                        Static assets + content-hashed reference data
```

---

## Methodology

- TIM 3.0.0 - [Google Travel Impact Model](https://github.com/google/travel-impact-model)
  (CC-BY 4.0)
- DEFRA 2024 - [UK Gov GHG Conversion Factors](https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024)
  (Open Government Licence v3.0)
- EEA fuel-burn - [EMEP/EEA Air Pollutant Emission Inventory Guidebook 2023](https://www.eea.europa.eu/publications/emep-eea-guidebook-2023),
  Annex 1.A.3.a Aviation
- GAIA route adjustment - Teoh et al. (2023), CC-BY 4.0,
  [Zenodo 8369564](https://zenodo.org/records/8369564)
- Airports - [OurAirports](https://ourairports.com/data/), public domain
- Non-CO₂ multiplier - Lee et al. 2009/2021, default 1.9 with UI toggle

A `/methodology` page with full calculation breakdowns, citations, and
known limitations is planned for v1.

---

## License

MIT (LICENSE pending). Methodology contributions welcome - see
[`TODO.md`](./TODO.md) for what's open.
