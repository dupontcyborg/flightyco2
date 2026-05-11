/**
 * Fetch Google's Travel Impact Model README and extract Appendix A —
 * the canonical aircraft IATA→ICAO mapping with EEA support status.
 *
 * Source: https://github.com/google/travel-impact-model (CC-BY 4.0)
 *
 * Output schema:
 *   {
 *     "version": "TIM-3.x.y",
 *     "fetched_from": "<url>",
 *     "license": "CC-BY 4.0",
 *     "support_levels": { "direct": "...", "winglet": "...", ... },
 *     "mappings": [
 *       { "name": "Boeing 787-9", "iata": "789", "icao": "B789", "support": "direct" },
 *       ...
 *     ]
 *   }
 *
 * Default: re-parse from cached README. Pass --force to re-fetch.
 *
 * Run: npm run data:tim [-- --force]
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { downloadIfMissing, logFetch, parseFlags } from "./lib/cli.ts";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const TIM_README_URL =
  "https://raw.githubusercontent.com/google/travel-impact-model/main/README.md";
const CACHE = resolve(REPO, "data/tim/README.md");
const ALIASES = resolve(REPO, "data/aircraft-aliases.yaml");
const OUT = resolve(REPO, "data/json/aircraft-mapping.json");

type SupportLevel =
  | "direct"
  | "winglet"
  | "previous-gen"
  | "least-in-family"
  | "similar"
  | "unknown";

interface Mapping {
  name: string;
  iata: string;
  icao: string;
  support: SupportLevel;
}

const SUPPORT_LEVELS: Record<SupportLevel, string> = {
  direct: "Direct match in EEA fuel-burn data",
  winglet: "Supported via winglet/sharklet correction factor (-3% LTO/CCD)",
  "previous-gen": "Mapped to a previous-generation aircraft type in the same family",
  "least-in-family": "Umbrella code mapped to the least-efficient aircraft in the family",
  similar: "Mapped to a similar aircraft type",
  unknown: "Support status not classified",
};

function classifySupport(rawSupport: string): SupportLevel {
  const s = rawSupport.toLowerCase();
  if (s.includes("direct match")) return "direct";
  if (s.includes("winglet") || s.includes("sharklet")) return "winglet";
  if (s.includes("previous generation") || s.includes("older model") || s.includes("newer model"))
    return "previous-gen";
  if (s.includes("least efficient")) return "least-in-family";
  if (s.includes("similar")) return "similar";
  return "unknown";
}

const SUPPORT_PRIORITY: Record<SupportLevel, number> = {
  direct: 5,
  winglet: 4,
  "previous-gen": 3,
  similar: 2,
  "least-in-family": 1,
  unknown: 0,
};

/** Normalize an aircraft-name string for index lookup. */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/**
 * Expand a name like "Boeing 777-200/200ER" into ["Boeing 777-200",
 * "Boeing 777-200ER"]. Splits at slashes, generating one candidate per
 * slash-bound segment using the leftmost-prefix + segment + suffix-after-
 * last-slash. Returns the original plus expansions; original always first.
 */
function expandSlashes(name: string): string[] {
  if (!name.includes("/")) return [name];
  // Strategy: find the position of the first slash, split there. The prefix
  // is everything up to the last whitespace-or-hyphen before the slash. The
  // segments are slash-separated parts. We don't try to be clever — just
  // emit each segment with the same prefix.
  const slashIdx = name.indexOf("/");
  let prefixEnd = slashIdx;
  while (prefixEnd > 0 && /[A-Za-z0-9]/.test(name[prefixEnd - 1] ?? "")) {
    prefixEnd--;
  }
  // Find the slash-group: everything from prefixEnd to first non-slash-segment char
  let slashGroupEnd = slashIdx;
  while (slashGroupEnd < name.length && /[A-Za-z0-9/-]/.test(name[slashGroupEnd] ?? "")) {
    slashGroupEnd++;
  }
  const prefix = name.slice(0, prefixEnd);
  const slashGroup = name.slice(prefixEnd, slashGroupEnd);
  const suffix = name.slice(slashGroupEnd);
  const segments = slashGroup
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  return [name, ...segments.map((seg) => `${prefix}${seg}${suffix}`)];
}

function extractVersion(readme: string): string {
  const m = /Travel Impact Model\s+(\d+\.\d+\.\d+)/.exec(readme);
  return m ? `TIM-${m[1]}` : "TIM-unknown";
}

function extractAppendixA(readme: string): Mapping[] {
  // Find the Appendix A heading
  const headerRe = /^###\s+Appendix A:.*$/m;
  const headerMatch = headerRe.exec(readme);
  if (!headerMatch) throw new Error("Appendix A heading not found in TIM README");
  const start = headerMatch.index + headerMatch[0].length;

  // End at the next heading at the same or higher level
  const tail = readme.slice(start);
  const nextHeading = /^###?\s+/m.exec(tail);
  const section = nextHeading ? tail.slice(0, nextHeading.index) : tail;

  const lines = section.split("\n");
  const mappings: Mapping[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.includes("|")) continue;
    // Skip header row + dash separator
    if (/^[-\s|]+$/.test(line)) continue;
    if (/Aircraft full name/i.test(line)) continue;

    // GitHub pipe-table (no leading/trailing pipes). Split on `|`.
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4) continue;

    const [name, iata, icao, supportRaw] = cells as [string, string, string, string];

    if (!name || !icao) continue;
    if (icao.length !== 4) continue;
    if (!/^[A-Z0-9]{4}$/i.test(icao)) continue;

    mappings.push({
      name,
      iata: iata.toUpperCase(),
      icao: icao.toUpperCase(),
      support: classifySupport(supportRaw),
    });
  }

  return mappings;
}

async function main(): Promise<void> {
  const flags = parseFlags();
  const outcome = await downloadIfMissing(TIM_README_URL, CACHE, flags);
  logFetch("TIM README.md", outcome, statSync(CACHE).size);

  const readme = readFileSync(CACHE, "utf8");
  const version = extractVersion(readme);
  const mappings = extractAppendixA(readme);

  // Stats
  const supportCounts = new Map<SupportLevel, number>();
  for (const m of mappings) {
    supportCounts.set(m.support, (supportCounts.get(m.support) ?? 0) + 1);
  }
  const uniqueIcaos = new Set(mappings.map((m) => m.icao)).size;

  console.log(`Version:  ${version}`);
  console.log(`Mappings: ${mappings.length} rows, ${uniqueIcaos} unique ICAO codes`);
  for (const [level, count] of [...supportCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${level.padEnd(18)} ${count}`);
  }

  // EEA coverage sanity
  try {
    const eea = JSON.parse(readFileSync(resolve(REPO, "data/json/eea-fuel-burn.json"), "utf8")) as {
      aircraft: Record<string, unknown>;
    };
    const eeaIcaos = new Set(Object.keys(eea.aircraft));
    const directHits = mappings.filter(
      (m) => m.support === "direct" && eeaIcaos.has(m.icao),
    ).length;
    const directMisses = mappings.filter((m) => m.support === "direct" && !eeaIcaos.has(m.icao));
    console.log(
      `\nEEA cross-check: ${directHits} of ${mappings.filter((m) => m.support === "direct").length} "direct" mappings land in our EEA fuel-burn table`,
    );
    if (directMisses.length > 0) {
      console.log(
        `  Misses (${directMisses.length}): ${directMisses
          .slice(0, 10)
          .map((m) => `${m.icao}(${m.name})`)
          .join(", ")}${directMisses.length > 10 ? ", ..." : ""}`,
      );
    }
  } catch {
    // EEA JSON not built yet — skip
  }

  // Build runtime lookup index keyed by normalized name. When multiple
  // entries share a key (slash-expansion alias collisions), keep the one
  // with the higher support priority.
  const index: Record<string, { icao: string; support: SupportLevel }> = {};
  for (const m of mappings) {
    const candidates = [m.name, ...expandSlashes(m.name)];
    for (const name of candidates) {
      const key = normalizeName(name);
      if (!key) continue;
      const existing = index[key];
      if (!existing || SUPPORT_PRIORITY[m.support] > SUPPORT_PRIORITY[existing.support]) {
        index[key] = { icao: m.icao, support: m.support };
      }
    }
  }
  console.log(`Index keys (from Appendix A): ${Object.keys(index).length} unique normalized names`);

  // Layer aliases on top: each flighty_string maps to a canonical TIM name.
  // Resolve the canonical name through the index we just built, then store.
  let aliasHits = 0;
  let aliasMisses = 0;
  if (existsSync(ALIASES)) {
    const aliasMap = parseYaml(readFileSync(ALIASES, "utf8")) as Record<string, string>;
    for (const [flighty, canonical] of Object.entries(aliasMap)) {
      const targetKey = normalizeName(canonical);
      const target = index[targetKey];
      if (!target) {
        aliasMisses++;
        console.log(
          `  ✗ alias ${JSON.stringify(flighty)} → ${JSON.stringify(canonical)} (canonical not found)`,
        );
        continue;
      }
      const key = normalizeName(flighty);
      // Aliases override only when key is unindexed; never replace direct matches.
      const existing = index[key];
      if (!existing || SUPPORT_PRIORITY[target.support] > SUPPORT_PRIORITY[existing.support]) {
        index[key] = target;
        aliasHits++;
      }
    }
    console.log(`Aliases: ${aliasHits} applied, ${aliasMisses} unresolved`);
  }

  const payload = JSON.stringify({
    version,
    fetched_from: TIM_README_URL,
    license: "CC-BY 4.0",
    support_levels: SUPPORT_LEVELS,
    mappings,
    index,
  });
  writeFileSync(OUT, payload);
  console.log(`\nWrote ${OUT} (${(payload.length / 1024).toFixed(1)} KB raw)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
