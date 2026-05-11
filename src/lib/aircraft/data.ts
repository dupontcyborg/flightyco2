/**
 * In-memory aircraft IATA→ICAO mapping, sourced from
 * TIM Appendix A + data/aircraft-aliases.yaml.
 *
 * The data is fetched at runtime from the content-hashed URL in
 * `src/lib/asset-manifest.ts` (generated from `data/json/aircraft-mapping.json`).
 * Tests can populate the store directly via `setAircraftMapping()`.
 */

export type SupportLevel =
  | "direct"
  | "winglet"
  | "previous-gen"
  | "least-in-family"
  | "similar"
  | "unknown";

export interface AircraftLookup {
  icao: string;
  support: SupportLevel;
  /** How the match was resolved — useful for surfacing data-quality notes. */
  matchType: "exact" | "substring" | "miss";
  /** The Appendix A name we matched against (when not a miss). */
  matchedName?: string;
}

export interface MappingFile {
  version: string;
  fetched_from?: string;
  license?: string;
  mappings: { name: string; iata: string; icao: string; support: SupportLevel }[];
  index: Record<string, { icao: string; support: SupportLevel }>;
}

let store: MappingFile | null = null;

export function setAircraftMapping(table: MappingFile): void {
  store = table;
}

export function aircraftMappingLoaded(): boolean {
  return store !== null;
}

/** Normalize an aircraft string for index lookup — must match build script. */
export function normalizeAircraftName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

const SUPPORT_PRIORITY: Record<SupportLevel, number> = {
  direct: 5,
  winglet: 4,
  "previous-gen": 3,
  similar: 2,
  "least-in-family": 1,
  unknown: 0,
};

/**
 * Look up an aircraft string (from Flighty CSV) and resolve it to an ICAO
 * type code. Three-tier matching:
 *
 *   1. Exact normalized hash lookup against the precomputed index
 *   2. Substring fallback — find Appendix A entries that contain the input,
 *      or are contained by it; pick highest-support match
 *   3. Miss
 *
 * The build script applies hand-curated aliases (data/aircraft-aliases.yaml)
 * to tier 1, so most Flighty strings hit on the first try.
 */
export function aircraftToIcao(rawName: string | null): AircraftLookup | null {
  if (!rawName || !store) return null;
  const norm = normalizeAircraftName(rawName);
  if (!norm) return null;

  // Tier 1: exact lookup
  const exact = store.index[norm];
  if (exact) {
    return { icao: exact.icao, support: exact.support, matchType: "exact" };
  }

  // Tier 2: substring match against Appendix A mappings. Either direction is
  // valid (input "Boeing 737-900ER" contains "Boeing 737-900", or input
  // "Boeing 767" is contained by "Boeing 767-300"). Prefer the longest match
  // and ties go to higher support priority. Require ≥ 4 chars of overlap to
  // avoid pathologically loose hits (e.g. "Boeing 707" matching "AeroSpace 707").
  let best: { entry: MappingFile["mappings"][number]; overlap: number } | null = null;
  for (const m of store.mappings) {
    const e = normalizeAircraftName(m.name);
    if (!e) continue;
    let overlap = 0;
    if (e.includes(norm)) overlap = norm.length;
    else if (norm.includes(e)) overlap = e.length;
    if (overlap < 4) continue;

    if (
      !best ||
      overlap > best.overlap ||
      (overlap === best.overlap &&
        SUPPORT_PRIORITY[m.support] > SUPPORT_PRIORITY[best.entry.support])
    ) {
      best = { entry: m, overlap };
    }
  }
  if (best) {
    return {
      icao: best.entry.icao,
      support: best.entry.support,
      matchType: "substring",
      matchedName: best.entry.name,
    };
  }

  return null;
}
