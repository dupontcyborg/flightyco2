# TODO

A complete punch list derived from `PRD.md` plus everything we've discovered while building. Items in each section are listed roughly in dependency order — earlier items unblock later ones.

## ✅ Done

- Astro 6.3 + Svelte 5 + TypeScript 5.9 + Tailwind v4 + Biome 2 scaffold
- CSV parsing (PapaParse + Zod), data-quality tagging, cabin-class normalization (SCREAMING_SNAKE handled)
- Airport coords (4,500 IATA from OurAirports, with ICAO + ISO country baked in), great-circle haversine
- All reference data pipelines as TS (`npm run data`): airports, GAIA, EEA fuel-burn, seat configs, TIM aircraft mapping, DEFRA xlsx fetched
- Reference data served from `public/*.json`, lazy-loaded by runtime via `setX()` setters
- DEFRA 2024 emissions calculator (decimals still `-draft`, awaiting verification)
- **TIM 3.0.0 faithful port** — LTO + CCD interpolation, GAIA distance adjustment (3-tier), cargo deduction, seat-area allocation, load factor scaling. Reproduces TIM's published ZRH-SFO B789 worked example to 0.07%
- Aircraft mapping: TIM Appendix A (160 rows, 101 ICAOs) + hand-curated `data/aircraft-aliases.yaml`. 3-tier match: exact → substring → null. Covers all fixture aircraft strings.
- Seat configs: hand-curated YAML covering 104 commercial airframes + 50-seat default fallback
- Lifetime totals on user fixture: **DEFRA 185.74 t**, **TIM 175.00 t** (with 1.9× RF)

---

## ⏭️ Current focus — finish `src/lib` brain before any UI

The `src/lib/` tree is the calculation engine. UI calls in, never the other way. We want this 100% complete + tested before touching Svelte islands or pages.

### Phase 0 — DEFRA verification ✅

- [x] Extracted verified DEFRA 2024 factors from `data/uk-gov/ghg-conversion-factors-2024-full.xlsx` into `public/defra-factors.json` (`npm run data:defra`). All 4 haul tiers, 215-country haul classification.
- [x] Confirmed DEFRA 2024 RF multiplier is 1.7× CO₂ (not 1.9×); total kgCO₂e ratio = 1.694. We keep `nonCo2Multiplier: 1.9` as default but the value is one-line configurable.
- [x] `DEFRA-2024-draft` → `DEFRA-2024-v1.1`. Factor values now match published spreadsheet to ≥5 decimal places.
- [ ] *(deferred to v1.1)* Adopt country-pair haul classification (Domestic UK / Short-haul UK / Long-haul UK / International non-UK), replacing the uniform "International non-UK" tier we use today. Data side is ready (`public/defra-factors.json` has the table); calculator restructure pending.

### Phase 1 — Test infrastructure + unit tests for existing modules ✅

**152 tests, 13 files, 95.4% line coverage. `npm test` / `npm run test:watch` / `npm run test:coverage`.**

- [x] Vitest set up with v8 coverage
- [x] `airports/distance.test.ts` — haversine math, 5 known great-circle routes, symmetry, antipodal/polar edge cases, IATA case-insensitivity, missing-airport returns null
- [x] `airports/load.test.ts` — fetch mocking; installs store; throws on non-OK
- [x] `aircraft/fuel-burn.test.ts` — TIM Table 1 reference values (LTO 1638, CCD@500=5852, CCD@5000=52962, interpolated@5180=54802), extrapolation below + above range, empty/single-point CCD
- [x] `aircraft/aircraft.test.ts` — 8 exact matches, substring fallback (737-900ER → 737-900), aliases (CRJ900 → Canadair, MD-88 → MD-82), null/empty/miss
- [x] `aircraft/seat-config.test.ts` — exact hits, default fallback, F+J+W+Y = total invariant across common ICAOs
- [x] `aircraft/load.test.ts` — orchestrator loads all 3 in parallel; propagates fetch errors
- [x] `gaia/gaia.test.ts` — tier 1 (LSZH-KSFO = 1.0273), tier 2 (US-GB country), tier 3 (default 1.052), tier priority
- [x] `gaia/load.test.ts` — parallel fetch of both URLs; throws on non-OK
- [x] `csv/parse.test.ts` — full-fixture row counts (373), cancelled count (4), quality histogram, cabin-class subset, synthetic edge cases (PREMIUM_ECONOMY normalization, Canceled='true'/'TRUE', skip-on-invalid-IATA)
- [x] `csv/schema.test.ts` — 12 cabin-normalization cases; data-quality classifier
- [x] `emissions/defra.test.ts` — 7 verified factor cases (DEFRA Int'l non-UK 2024), RF toggle (1.0/1.7/1.9), routing uplift, cabin fallback, bucket boundaries (463/464/3700/3701), monotonic cabin-class ordering
- [x] `emissions/tim.test.ts` — ZRH-SFO B789 all 4 cabin classes within ±1% of TIM-published values; J=4× / F=5× / W=1.5× ratio assertions on widebody; non-CO₂ multiplier toggle; fallback paths (no aircraft, unmapped aircraft, null cabin); canonical transpacific LAX-NRT flight
- [x] `emissions/totals.test.ts` — lifetime regression locks: DEFRA 186.68 t, TIM 175.07 t, 27 DEFRA-fallback flights, 5-7% TIM-vs-DEFRA spread, aircraft mapping coverage on fixture
- [x] Bug fix uncovered by tests: `load.ts` cached failed promises forever; fixed with `finally { inflight = null }`

### Phase 2 — Missing logic in `src/lib` ✅

- [x] `csv/parse.ts`: **diverted flight handling** — `ParsedFlight.actualTo` = `divertedTo ?? to`; distance computed from actualTo; `to` preserved for scheduled-destination reporting
- [x] `csv/parse.ts`: **codeshare dedupe** — `(from, actualTo, scheduledDeparture)` key; first-seen wins; rows without timestamp pass through unconditionally; `ParseResult.deduped: DedupedFlight[]` records every drop with `{kept, dropped}` pair
- [x] **`src/lib/aggregation/`** module:
  - `enrich.ts` — `enrichFlights(flights, calculate)` returns `{ enriched, cancelled, unresolved }`
  - `by-year.ts` — `aggregateByYear` with cabin + aircraft splits
  - `by-month.ts` — `aggregateByMonth(enriched, year?)` with haul-bucket split (drives stacked-bar chart)
  - `by-aircraft.ts` — descending by emissions, `shareOfTotal` precomputed
  - `by-cabin.ts` — always 4 buckets returned (empty bars stay stable in UI)
  - `top-n.ts` — non-mutating sort, returns top N
  - `data-quality.ts` — both raw (`summarizeDataQuality`) and enriched (`summarizeEnrichedQuality`) summaries
- [x] **`src/lib/load.ts`** — `loadAllReferenceData(urls?)` fetches all 6 sources in parallel; inflight cache cleared on settle for retries

### Phase 3 — Tests for new logic ✅

- [x] `csv/parse.test.ts` — diverted-flight handling, codeshare dedupe across 4 cases (collapse, different times, no timestamp, diverted dedupe)
- [x] `aggregation/aggregation.test.ts` — 25 tests across enrichFlights, all four aggregators, top-N, data quality, empty/single-flight edge cases. Sum-invariants verified (cabin split = year total; haul split = month total; shares sum to 1.0)
- [x] `load.test.ts` — orchestrator: parallel fetch of 6 sources, all stores marked loaded, error propagation

**End state:** 189 tests, 15 files, 97.2% line coverage, 86.2% branch coverage, ~330 ms full suite. `src/lib` is feature-complete and fully test-covered for v1. UI work unblocked.

### Phase 4 — Final lib polish ✅

- [x] **`NotFlightyCsvError`** in `csv/parse.ts` — distinguishes "wrong file format" from "valid Flighty CSV with bad rows". Checks for 5 required columns up front.
- [x] **`hashCsv(text)`** in `csv/hash.ts` — SHA-256 hex for the localStorage cache key. Works in browser + Node 18+.
- [x] **`src/lib/comparisons.ts`** — `REFERENCE_BUDGETS` constants (avg American 16 t/yr, 1.5°C 2 t/yr, car 0.171 kg/km) + `comparisonsForTotal(kgCo2e, years)` helper. UI components read these, never inline magic numbers.
- [x] **`src/lib/index.ts`** — top-level barrel; UI imports from one place; submodules still importable directly for tests.
- [x] **`sample_data/canonical-fixture.csv`** — 13-row hand-built committed fixture exercising every edge case (4 cabin classes + null, 3 haul lengths, cancelled, diverted, codeshare pair, substring fallback, alias, no-aircraft DEFRA fallback). Documented in `sample_data/README.md`.
- [x] **`src/lib/integration.test.ts`** — full end-to-end pipeline asserting parse → enrich → aggregate against the canonical fixture, with locked lifetime totals (TIM 11.25 t, DEFRA 11.21 t).
- [x] `emissions/totals.test.ts` now skips gracefully when the gitignored personal fixture is absent; integration.test.ts covers the same ground portably.

**Final end state:** 236 tests, 18 files, ~360 ms full suite. `npm test` passes from a fresh clone with no private data needed.

---

## v1 — to ship

### CSV processing extensions

- [ ] **Codeshare / double-booking dedupe.** Heuristic key: `(date, from, to, scheduled_dep_time)`. Add a tally of deduped flights so it's visible, never silent.
- [ ] **Diverted-flight handling.** When `Diverted To` is set, use that as the actual arrival airport for distance calculation. Currently we'd compute distance to the scheduled destination.
- [ ] **Malformed / empty / non-Flighty CSV error states.** Distinguish "wrong file format" from "valid CSV with bad rows" in the UI.
- [ ] **Canonical anonymized test CSV.** Derive a small public fixture from nicolas's Flighty export — *same flights, smaller subset, adjusted* so private travel patterns aren't exposed. Engineer the subset to hit every edge case in one file:
  - Each cabin class (economy / premium-economy / business / first) at least once, plus a row with no cabin recorded
  - Each common haul-length bucket (domestic short, short-haul, long-haul transatlantic, long-haul transpacific)
  - Several aircraft families incl. one that exercises substring fallback (e.g. `Boeing 737-900ER` → `737-900`) and one alias hit (e.g. `Bombardier CRJ900`)
  - At least one row with **no aircraft** recorded (triggers the cabin-only fallback path)
  - A cancelled flight, a diverted flight, a codeshare-style duplicate pair
  - Routes that exercise GAIA tier 1 (specific airport pair), tier 2 (country pair only), and tier 3 (default 1.052 fallback)
  - A non-Flighty / malformed line to test error states
  - Sanitize dates (e.g. shift by N years or randomize), drop or redact `Notes`/`PNR`/`Seat`/`Tail Number` columns
  Should live at `sample_data/fixture.csv` and be committed (the `FlightyExport-*` originals stay gitignored).
- [ ] **Other synthetic fixtures** if useful: a huge CSV for perf testing, a corrupt CSV for error-state UI.

### Aggregation (between calc and UI)

- [ ] **Per-year aggregation** — totals, flight count, distance, by-cabin and by-aircraft splits.
- [ ] **Monthly breakdown** with haul-length bucketing for the stacked bar chart.
- [ ] **By-aircraft and by-cabin breakdowns** (counts + emissions share).
- [ ] **Top-N highest-emission flights** for the year selector.
- [ ] **Data-quality summary** ("94% of flights had complete data") + cabin-class found/missing split.

### Cabin-class fallback toggle (logic + UI)

- [ ] Toggle state lives in a Svelte store; applies only to flights with `cabinClass === null`.
- [ ] Show count split prominently ("142 with recorded cabin, 232 assumed").
- [ ] Headline number updates live when toggled — show the delta visibly.
- [ ] Persist toggle state alongside the localStorage-cached result.
- [ ] Surface long-haul caveat copy contextually based on the user's haul mix.

### UI — landing & upload

- [ ] **Landing page** — one-sentence pitch, one CTA, privacy claim above the fold.
- [ ] **Inline Flighty CSV export instructions** with screenshots.
- [ ] **Svelte uploader island** — drag/drop + file picker, client-side validation, progress for large files.
- [ ] **Loading state** for parsing + calculation on large CSVs.

### UI — results

- [ ] **Results route** (`/results`) with year selector defaulting to most recent complete year.
- [ ] **Headline tons CO₂e** for selected year.
- [ ] **Comparisons** — vs avg American (~16 t/yr), vs 1.5°C-aligned individual budget (~2 t/yr), vs equivalent km driven.
- [ ] **Monthly stacked bar chart** (D3, color-coded by haul length).
- [ ] **By-aircraft and by-cabin breakdown** components.
- [ ] **Top-5 highest-emission flights** list with route, date, kgCO₂e.
- [ ] **Data quality badge** with breakdown drawer.
- [ ] **Methodology drawer** — one-line summary always visible, full breakdown one click away. Toggles for non-CO₂ multiplier and DEFRA / TIM.

### UI — per-flight detail

- [ ] **Detail view** — route, date, aircraft, cabin, distance, kg CO₂e (with and without non-CO₂ multiplier, both shown).
- [ ] Per-flight data-quality indicator + caveats (`aircraft type inferred`, `cabin assumed`, etc.).
- [ ] **"What if?" sliders** — cabin class, aircraft type, direct vs connecting; updates per-flight estimate live.

### Persistence

- [ ] **localStorage cache** keyed by CSV hash. Re-uploading same file returns instantly.
- [ ] Cache schema includes `factorVersion` so old results stay stable when factors are updated.
- [ ] Cabin-fallback toggle and methodology toggles persisted in the same cache entry.

### Methodology transparency

- [ ] **`/methodology` page** — full calculation in plain language, formulas, factor sources, version, known limitations.
- [ ] **"What's not counted"** section: tech stops, ferry flights, manufacturing emissions, airport ground ops.
- [ ] Citations to DEFRA, ICAO, Google TIM, Lee et al. 2021.
- [ ] `methodology_version` surfaced in UI and stored alongside each calculation.

### Non-functional / launch readiness

- [ ] **Privacy copy** on landing page; verifiable in DevTools Network tab (no requests carry CSV data).
- [ ] **Performance:** TTI < 1s on fast connection; 1,000-flight CSV processed in < 2s on mid-range laptop.
- [ ] **Bundle budget:** < 200 KB JS gzipped on first load. Measure and gate.
- [ ] **Accessibility:** WCAG AA. Keyboard navigation. Charts have text alternatives.
- [ ] **Cross-browser smoke test:** latest Chrome / Safari / Firefox / Edge + mobile Safari + Chrome Android.

### Repo hygiene

- [ ] **README** — what, why, how to run locally, methodology pointers.
- [ ] **MIT LICENSE.**
- [ ] **CONTRIBUTING** note (small) covering methodology contributions specifically.
- [ ] Privacy-respecting page-level analytics (Plausible or similar), opt-out friendly.

### Verification before public launch ⚠️

- [ ] **Verify DEFRA 2024 factor decimals** against the UK Gov spreadsheet PDF. Currently labeled `DEFRA-2024-draft`.
- [ ] **Replace TIM seed table** with the official Google TIM JSON from <https://github.com/google/travel-impact-model>. Currently hand-curated ±15%.
- [ ] **Widen aircraft normalizer** coverage beyond the fixture's 35 airframes (turboprops, regional jets, less-common widebodies).
- [ ] **Distance-bucket boundary unit tests** (462 / 463 / 3699 / 3700 / 3701 km).
- [ ] **Cross-check a known published example flight** against both methods (DEFRA's own example calculations are a good benchmark).

---

## v1.1 — next

- [ ] **Airline logos in flight list**. Port `overhead/assets/*.svg` (80 brand marks, IATA-named, ~50 KB total) into `src/assets/airlines/` (or `public/airlines/`). Render next to the IATA flight number via `?raw` inline or `<img>`. Fall back to text when no asset for the IATA.
- [ ] **Share card** (PNG export of summary, austere "receipt" aesthetic, no Wrapped-y badges).
- [ ] Per-route stage-length adjustment in TIM (short-haul less efficient than long-haul for same airframe).
- [ ] Full TIM JSON dataset with route-bucketed lookups, not just airframe-level averages.
- [ ] **Pack `gaia-airports.json` as binary** — `[8B IATA-pair ASCII][2B uint16 dist×10000][2B uint16 fuel×10000]` per record. Measured saving: 994 KB → 439 KB raw, 221 KB → 184 KB brotli (-17% / -37 KB on the wire). Decoder is ~15 lines TS. Other reference data stays as JSON; savings on smaller files don't justify the decoder complexity.

## v2 — later

- [ ] Support for other CSV formats (App in the Air, OpenFlights, manual entry).
- [ ] Lifetime view across all uploaded years.
- [ ] Anonymous shareable URLs (encoded in hash fragment, no backend).

## Maybe never

- Anything that takes a cut of an offset purchase. The whole point.

---

## Open questions

- **Non-CO₂ multiplier default:** 1.9 (UK gov) vs 2.0 (common simplification) vs haul-length-dependent value (more accurate, harder to explain). Current: 1.9.
- **Pre-2006 flights:** Flighty doesn't enrich these. Show with low-confidence tag, or hide behind a toggle? Moot for the user's own fixture (earliest 2008), still worth deciding for other users.
- **Share card methodology version stamp:** include `methodology: DEFRA-2024 · v1.0` footer (a receipt has a version) or keep visually clean. Moot until v1.1.
