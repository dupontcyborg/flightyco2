# PRD: Flight Carbon Footprint Calculator

## Summary

A static web app that takes a Flighty CSV export and produces an honest, visually compelling estimate of the user's flight carbon footprint. All processing happens client-side; the CSV never leaves the user's browser.

The project exists because every existing flight carbon calculator either (a) is ugly and unmotivating, (b) hides non-CO₂ effects to make numbers look smaller, or (c) is a thinly-disguised funnel for selling carbon offsets of dubious quality. This tool optimizes for one thing: telling frequent flyers the truth about their footprint, beautifully.

## Goals

- Give Flighty users a per-year and per-flight breakdown of their flight emissions in under 30 seconds from CSV upload.
- Be the most methodologically honest free flight calculator on the web. Show non-CO₂ warming effects by default. Surface methodology and data quality openly.
- Make the result emotionally legible — the user should viscerally understand the scale of their footprint, not just see a number.
- Stay free, ad-free, offset-marketplace-free, and account-free, forever.

## Non-Goals (v1)

- User accounts, saved trips, server-side storage of any kind.
- Live flight tracking, flight booking, or itinerary planning (Flighty already does this).
- Carbon offset purchasing or marketplace integration. Project must remain unincentivized to inflate numbers.
- Comparison/social features that require a backend.
- Support for non-Flighty CSV sources in v1 (e.g., manual entry, App in the Air, OpenFlights). Possible in v2.

## Users

Primary: Flighty users who fly enough to care (rough heuristic: 25k+ miles/year). They are climate-aware, technically literate, and skeptical of greenwashing. They want an honest number, not a guilt trip and not a sales pitch.

Secondary: occasional flyers curious about their footprint who happen to use Flighty.

## User Flow

1. Land on homepage. One-sentence pitch, one CTA: "Upload your Flighty CSV." Methodology and privacy explainers visible but secondary.
2. User exports CSV from Flighty (Profile → Settings → Account Data → Export Your Flights). Brief inline instructions with screenshots.
3. User drops or selects CSV file. Parsing + calculation runs client-side. Loading state shows progress for large files.
4. Results page renders with year selector defaulting to most recent complete year.
5. User can drill into per-flight detail, toggle methodology assumptions, switch years, or share a result card.

No login. No email capture. No "sign up to see your full results." Ever.

## Functional Requirements

### CSV Processing
- Parse Flighty CSV exports. Sniff header row; do not hardcode column positions.
- Validate rows with Zod schemas. Bad rows go to a "skipped" tally, not silently dropped.
- Detect and dedupe codeshare/double-booked flights (same date + route + aircraft + similar time).
- Exclude cancelled flights from emissions, count them in metadata.
- Use actual departure/arrival airports for diverted flights.
- Tag each flight with a data quality level (`high`, `medium`, `low`) based on completeness.

### Emission Calculation

Two calculation methods are available, both shipping in v1. The user toggles between them in the methodology drawer; the result records which one produced each per-flight number.

- **TIM (recommended default):** Faithful port of Google's Travel Impact Model 3.0.0. Reads per-aircraft EEA fuel-burn curves (LTO + CCD interpolated by distance), applies GAIA route-specific distance adjustment (airport-pair → country-pair → 1.052 global default), converts fuel to CO₂e via the CORSIA WTW factor (3.8359 kg CO₂e/kg jet fuel), apportions ~8% to belly cargo, and allocates per-passenger by seat-area (IATA RP 1726 class multipliers: narrow 1/1/1.5/1.5, wide 1/1.5/4/5). Scales by an 84.5% global load factor. Validated against TIM's published ZRH-SFO B789 worked example to 0.07%.
  - **Per-flight transparent fallback to DEFRA** when (a) the aircraft string can't be mapped to a known ICAO, (b) the ICAO has no EEA fuel-burn entry, or (c) any required input is missing. The `EmissionResult.method` field always reflects what was actually used (`"TIM-2024"` vs `"DEFRA-2024"`), and `caveats` explains the fallback. The methodology UI surfaces this — e.g. "TIM covered 342 flights, DEFRA fallback covered 27."

- **DEFRA (alternative):** UK Gov GHG Conversion Factors 2024 (v1.1), distance × per-passenger-km factor by cabin class, with the optional non-CO₂ uplift applied externally. Currently uses the "International, to/from non-UK" tier uniformly across all flights — accurate for non-UK users, off by 30–50% for UK-involved flights. Country-pair haul classification (Domestic UK / Short-haul UK / Long-haul UK / International) is captured in the data pipeline (`public/defra-factors.json` has the 215-country table) and lands as a v1.x refinement.

**Non-CO₂ multiplier:** Applied externally on top of either method, toggleable in the UI. Default **1.9×** (Lee et al. 2009, common climate-reporting convention). DEFRA 2024 internally uses ~1.7× and Lee et al. 2021 puts the central estimate at ~2× with wide uncertainty; the toggle exposes the range. With multiplier = 1 the numbers are "raw CO₂e from the molecule + upstream fuel production"; with multiplier > 1 they're "total climate impact including contrails, NOₓ, water vapor at altitude."

**Routing uplift:** DEFRA applies 1.09× to great-circle distance. TIM uses route-specific GAIA ratios (median ~1.05).

**Factor versioning:** Each result records `method` and `factorVersion` (e.g. `"TIM-3.0.0 (EEA-MEC-2023-v1.5_18_09_2024 fuel, GAIA-2023 routing)"`). Past calculations remain stable when factors update.

All emissions reported in kg CO₂e. Aggregate to metric tons in UI.

### Airport Database
- Inline-JSON-in-TypeScript shipped with the app, lazy-parsed on first lookup. ~4,500 airports (large + medium types).
- Source: **OurAirports** (public domain, actively maintained), filtered to entries with valid 3-letter IATA codes.
- Format: `{ "IATA": [lat, lon] }` with coordinates rounded to 4 decimals (~11m precision; far below airport-reference-point variance).
- **IATA-keyed only.** Empirically, Flighty CSVs use IATA in `From`/`To`/`Diverted To` for 100% of rows — ICAO indexing would be unused weight. If a future user surfaces ICAO-only rows, add a translator layer at parse time, not a second key in the blob.
- Wire size: ~110KB raw, ~50KB gzipped, ~38KB brotli. Comfortably inside the bundle budget without packing.
- Refresh script: `scripts/generate-airport-coords.py` (downloads from OurAirports and regenerates `src/lib/airports/coords.ts`).
- **Future optimization (not v1):** packed binary format (IATA + lat/lon scaled int32 = ~9B per record, ~30KB compressed) decoded into typed arrays at boot. Only worth doing if bundle measurements push us over budget.

### Results: Summary View (per year)
- Headline: total tons CO₂e for selected year.
- Comparisons: vs. average American annual total (~16t), vs. 1.5°C-aligned individual budget (~2t), vs. equivalent km driven.
- Monthly stacked bar chart of emissions, color-coded by haul length.
- Breakdown by aircraft type.
- Breakdown by cabin class.
- Top 5 highest-emission flights for the year.
- Data quality badge (e.g., "94% of flights had complete data").
- Year selector for users with multi-year data.
- Methodology drawer: one-line summary always visible, full breakdown one click away. Toggles for non-CO₂ multiplier and methodology version.

### Results: Detail View (per flight)
- Route, date, aircraft, cabin, distance, kg CO₂e (with and without non-CO₂ multiplier, both shown).
- Data quality indicator and any caveats (e.g., "aircraft type inferred").
- "What if?" sliders: cabin class, aircraft type, direct vs. connecting. Each updates the per-flight estimate live.

### Cabin Class Fallback
- Many older Flighty rows have an empty `Cabin Class` field. Calculator must not silently default to economy.
- After upload, surface a single toggle: "Mostly economy / Mostly business / Mixed (set per-flight)."
- The toggle applies **only** to flights missing cabin data. Flights with a recorded cabin class are never overridden.
- UI must show the count split, e.g. "Cabin class found for 142 flights. For the other 232, assume: [Economy ▾]."
- Flipping the toggle updates the headline number live, so the assumption is legible rather than hidden inside the math.
- Per-flight overrides available on the detail view (already covered by the "What if?" sliders).
- Persist the toggle alongside the cached result (CSV-hash key); a different CSV resets it.
- Long-haul caveat in copy: cabin class is the largest single lever on long-haul and nearly cosmetic on short hops. Surface this contextually based on the user's data.

### Sharing
- **Deferred from v1.** No share card, no PNG export, no canvas work. The "honest receipt" aesthetic still governs the results page itself.
- May return in a later version. When it does, the design direction below still applies.

### Persistence
- Cache decoded results in `localStorage` keyed by a hash of the CSV. Re-uploading the same file returns instantly.
- No remote storage. No analytics that capture user data. Privacy-respecting analytics (e.g., Plausible) for page-level metrics only.

## Non-Functional Requirements

- **Privacy:** CSV never leaves the browser. State this prominently on the landing page. Verifiable via DevTools network tab.
- **Performance:** Time-to-interactive under 1s on a fast connection. Full processing of a 1,000-flight CSV under 2s on a mid-range laptop.
- **Bundle size:** Aim for under 200KB JS gzipped on first load (Astro's static-first model + Svelte islands should make this comfortable).
- **Accessibility:** WCAG AA. Keyboard navigation throughout. Charts must have text alternatives.
- **Browser support:** Latest two versions of Chrome, Safari, Firefox, Edge. Mobile Safari and Chrome Android.
- **Open source:** MIT licensed. Public repo. Methodology code inspectable. Test fixtures committed (synthetic or anonymized).

## Tech Stack

- **Framework:** Astro 6.x for static shell + Svelte islands for interactive surfaces (uploader, charts, sliders).
- **Language:** TypeScript 5.9 throughout.
- **Lint/format:** Biome (single tool for both).
- **CSV parsing:** PapaParse.
- **Validation:** Zod.
- **Math:** numpy-ts for vectorized distance and emission calculations (tree-shakeable; only the imported ops ship).
- **Charts:** D3 directly, or a thin wrapper. Avoid heavy chart libraries.
- **Styling:** Tailwind.
- **Hosting:** Vercel, Netlify, or Cloudflare Pages free tier.
- **Build artifacts:** Pre-built airport binary blob (~40KB compressed), pre-built emission factor JSON tables (versioned).

## Methodology Transparency

The methodology is the product. The site must include:
- A `/methodology` page with the full calculation explained in plain language, including formulas, factor sources, version, and known limitations.
- A "what's not counted" section: tech stops, ferry flights flown empty, manufacturing emissions of aircraft, airport ground operations.
- Citations to DEFRA, ICAO, Google TIM, and Lee et al. 2021 (non-CO₂ effects).
- A `methodology_version` field surfaced in the UI and stored alongside each calculation.

## Design Direction

- Honest, slightly uncomfortable, deliberately not Wrapped-y.
- Typography-forward. Big numbers, restrained color palette.
- Charts should be readable, not decorative. No gradients-for-the-sake-of-gradients.
- The share card especially should feel like a receipt, not a trophy.
- No tree icons, no "you saved X polar bears," no gamification, no badges.

## Out of Scope, Possibly Later

- v1.1: share card (PNG export of summary, designed as a receipt rather than a trophy).
- v1.1: DEFRA country-pair haul classification (currently we use the International non-UK tier uniformly; full classification needed for ≥30% accuracy gain on UK-involved flights).
- v2: support for other CSV formats (App in the Air, OpenFlights, manual entry).
- v2: lifetime view across all uploaded years.
- v2: anonymous shareable URLs (encoded in hash, no backend).
- Maybe never: anything that takes a cut of an offset purchase.

## Success Metrics

- Number of CSVs processed per week.
- Share card downloads (tracked client-side, anonymous count only).
- GitHub stars / community contributions to methodology.
- Inbound from climate-credible voices (journalists, researchers) — qualitative.

The metric we are explicitly not optimizing for: time-on-site or return visits. This is a tool people should use a few times a year and walk away from with a clearer picture, not a destination.

## Open Questions

- **Non-CO₂ multiplier default:** 1.9× (Lee et al. 2009, common climate-reporting convention) vs 1.7× (DEFRA 2024 internal value) vs ~2× (Lee et al. 2021 central estimate). Current: 1.9, with UI toggle to switch.
- **Default method shown first:** TIM (more refined, requires aircraft data) or DEFRA (simpler, fewer caveats)? Current PRD leans TIM-default since it's more accurate per-flight and the transparent DEFRA-fallback handles missing-aircraft rows cleanly.
- **Pre-2006 flights:** Flighty doesn't enrich these. Show with a "low confidence" tag, or hide behind a toggle? Moot for our reference fixture (earliest 2008) but worth deciding for other users.
- **Share card methodology version stamp:** include `methodology: TIM-3.0.0 · v1.0` footer (a receipt has a version) or keep visually clean? Moot until v1.1 share card lands.
