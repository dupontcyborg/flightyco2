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
- **Method A (default, ships v1):** Distance-based with DEFRA 2024 emission factors. Distance buckets (domestic / short-haul / long-haul), cabin class multipliers, 9% distance uplift for non-direct routing, 1.9× non-CO₂ multiplier applied by default with a toggle to disable.
- **Method B (ships v1.1):** Aircraft-aware calculation using Google Travel Impact Model methodology. Falls back to Method A when aircraft data is missing or unrecognized.
- Each flight's result records which method was used and what factor table version (e.g., `DEFRA-2024`) was applied. Past calculations remain stable when factors update.
- All emissions reported in kg CO₂e. Aggregate to metric tons in UI.

### Airport Database
- Pre-built binary blob shipped with the app. Source: OpenFlights, filtered to airports with valid IATA codes; heliports and closed fields excluded.
- Packed format: IATA (3B) + ICAO (4B) + lat/lon as scaled int32 + country code (2B) = 17B per record.
- Compressed with Brotli-11 or zstd-19. Target: under 50KB over the wire.
- Decoded once at app boot into typed arrays plus a `Map<string, number>` lookup keyed by both IATA and ICAO codes.

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
- **Language:** TypeScript 6.0 throughout.
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
- v1.1: Method B (aircraft-aware via TIM).
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

- Which non-CO₂ multiplier to default to: 1.9 (UK gov), 2.0 (common simplification), or a haul-length-dependent value (more accurate, harder to explain)?
- How to handle pre-2006 flights gracefully — Flighty itself doesn't enrich these. Show with a "low confidence" tag, or hide behind a toggle?
- Should the share card include the methodology version, or keep it visually clean and surface methodology only on click-through?
