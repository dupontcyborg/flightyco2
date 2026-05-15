# flightyco2

A simple flight-emissions calculator for users of [Flighty](https://flightyapp.com).

Upload your Flighty CSV export, get a per-year and per-flight breakdown of your carbon footprint computed with Google's Travel Impact Model and DEFRA 2024 factors. All processing happens client-side — the CSV never leaves your browser.

[Try it out here](https://flightyco2.com)!

## Methodology

- **TIM 3.0.0** — faithful port of Google's [Travel Impact Model](https://github.com/google/travel-impact-model), validated against its published worked example to within 0.07%. Reads per-aircraft EEA fuel-burn curves, route-specific distance adjustments (GAIA), CORSIA well-to-wake conversion, seat-area class allocation.
- **DEFRA 2024** — UK Gov GHG conversion factors, verified against the published spreadsheet. Used as a transparent fallback when TIM lacks data for a flight (no aircraft string, unmapped ICAO); the per-flight result records which method ran.
- **Non-CO₂ effects** — 1.9× radiative-forcing uplift on by default, toggleable in the UI.

Full methodology and source list is in the in-app methodology drawer.

## Stack

- Astro 6 static + Svelte 5 islands + TypeScript 5.9 + Tailwind v4
- Biome + Vitest + PapaParse + Zod
- Deployed on Cloudflare Pages

## Local development

Requires Node 20+ and npm.

```bash
git clone https://github.com/dupontcyborg/flightyco2.git
cd flightyco2
npm install

npm run dev      # Astro dev server
npm test         # Vitest
npm run build    # Production build
npm run lint     # Biome
```

Tests run on a fresh clone with no private data — the end-to-end regression uses [`sample_data/canonical-fixture.csv`](./sample_data/canonical-fixture.csv).

Reference data (airports, aircraft, fuel-burn, etc.) is regenerated from upstream sources via `npm run data` (and per-source variants `npm run data:airports`, `data:gaia`, `data:eea`, `data:tim`, `data:defra`, `data:seats`). See [`data/README.md`](./data/README.md) for upstream attribution and licenses.

## Airline brand logos

`public/airlines/*.svg` contains airline brand marks used solely to identify the carrier of each flight in the user's own uploaded CSV — i.e. nominative use, no endorsement implied, no resale. The trademarks remain the property of their respective owners; this project claims no rights to them.

## AI disclosure

This project was built with substantial use of large language models. Specifically:

- **Architecture and design** — human (me, [@dupontcyborg](https://nico.codes), a senior software engineer).
- **Implementation** - predominantly LLM-assisted. Most TypeScript, Svelte components, and tests were drafted by my dear friend Claude :)
- **Review** - me again.

Bugs and typos are most likely my own, in all fairness to Claude.

## License

MIT. Contributions welcome.
