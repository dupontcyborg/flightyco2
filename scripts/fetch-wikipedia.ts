/**
 * Fetch Wikipedia airframe family pages as raw HTML to data/wikipedia/.
 *
 * Output: one HTML file per family page, named by URL slug.
 * Parsed later by scripts/update-seat-configs.ts.
 *
 * Strategy: fetch family pages (e.g. "Boeing 787 Dreamliner") rather than
 * per-variant pages. One family page typically covers 2–8 ICAO variants and
 * contains a "Specifications" table with typical seat counts per variant.
 *
 * Default: skip pages already cached on disk. Pass --force to re-download all.
 *
 * Run: npm run data:wikipedia [-- --force]
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadIfMissing, logFetch, parseFlags } from "./lib/cli.ts";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const OUT_DIR = resolve(REPO, "data/wikipedia");

const USER_AGENT = "flightyco2/0.0.1 (https://github.com/nicolas/flightyco2; ndupont@cyborg.co)";

const PAGES: { title: string; icaos: string[] }[] = [
  // Boeing — narrowbody
  { title: "Boeing_707", icaos: ["B703"] },
  { title: "Boeing_717", icaos: ["B712"] },
  { title: "Boeing_727", icaos: ["B721", "B722"] },
  { title: "Boeing_737_Classic", icaos: ["B733", "B734", "B735"] },
  { title: "Boeing_737_Next_Generation", icaos: ["B736", "B737", "B738", "B739"] },
  { title: "Boeing_737_MAX", icaos: ["B38M", "B39M"] },
  { title: "Boeing_737_Original", icaos: ["B732"] },

  // Boeing — widebody
  { title: "Boeing_747", icaos: ["B741", "B742", "B743", "B744", "B74S"] },
  { title: "Boeing_747-8", icaos: ["B748"] },
  { title: "Boeing_757", icaos: ["B752", "B753"] },
  { title: "Boeing_767", icaos: ["B762", "B763", "B764"] },
  { title: "Boeing_777", icaos: ["B772", "B773", "B77L", "B77W"] },
  { title: "Boeing_787_Dreamliner", icaos: ["B788", "B789", "B78X"] },

  // Airbus — narrowbody
  { title: "Airbus_A220", icaos: ["BCS1", "BCS3"] },
  { title: "Airbus_A318", icaos: ["A318"] },
  { title: "Airbus_A319", icaos: ["A319"] },
  { title: "Airbus_A320", icaos: ["A320"] },
  { title: "Airbus_A321", icaos: ["A321"] },
  { title: "Airbus_A320neo_family", icaos: ["A19N", "A20N", "A21N"] },

  // Airbus — widebody
  { title: "Airbus_A300", icaos: ["A306", "A30B", "A3ST"] },
  { title: "Airbus_A310", icaos: ["A310"] },
  { title: "Airbus_A330", icaos: ["A332", "A333", "A338", "A339"] },
  { title: "Airbus_A340", icaos: ["A342", "A343", "A345", "A346"] },
  { title: "Airbus_A350_XWB", icaos: ["A359", "A35K"] },
  { title: "Airbus_A380", icaos: ["A388"] },

  // McDonnell Douglas
  { title: "McDonnell_Douglas_DC-10", icaos: ["DC10"] },
  { title: "McDonnell_Douglas_MD-11", icaos: ["MD11"] },
  { title: "McDonnell_Douglas_MD-80", icaos: ["MD81", "MD82", "MD83", "MD87", "MD88"] },
  { title: "McDonnell_Douglas_MD-90", icaos: ["MD90"] },

  // Embraer
  { title: "Embraer_E-Jet_family", icaos: ["E170", "E75L", "E75S", "E190", "E195"] },
  { title: "Embraer_E-Jet_E2_family", icaos: ["E290", "E295"] },
  { title: "Embraer_ERJ_family", icaos: ["E135", "E145", "E35L"] },
  { title: "Embraer_EMB_120_Brasilia", icaos: ["E120"] },
  { title: "Embraer_EMB_110_Bandeirante", icaos: ["E110"] },

  // Bombardier
  { title: "Bombardier_CRJ100/200", icaos: ["CRJ1", "CRJ2"] },
  { title: "Bombardier_CRJ700_series", icaos: ["CRJ7", "CRJ9", "CRJX"] },
  { title: "De_Havilland_Canada_Dash_8", icaos: ["DH8A", "DH8B", "DH8C", "DH8D"] },

  // ATR
  { title: "ATR_42", icaos: ["AT43", "AT44", "AT45", "AT46"] },
  { title: "ATR_72", icaos: ["AT72", "AT73", "AT75", "AT76"] },

  // Other
  { title: "Fokker_70", icaos: ["F70"] },
  { title: "Fokker_100", icaos: ["F100"] },
  { title: "Sukhoi_Superjet_100", icaos: ["SU95"] },
  { title: "Mitsubishi_SpaceJet", icaos: ["MRJ9"] },
  { title: "BAe_146", icaos: ["B461", "B462", "B463", "RJ1H", "RJ70", "RJ85"] },
];

function safeFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, "_");
}

async function main(): Promise<void> {
  const flags = parseFlags();
  console.log(`Fetching ${PAGES.length} Wikipedia pages → ${OUT_DIR}`);

  let downloaded = 0;
  let cached = 0;
  let failed = 0;
  let totalIcaos = 0;

  for (const page of PAGES) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(page.title)}`;
    const dest = resolve(OUT_DIR, `${safeFilename(page.title)}.html`);
    try {
      const outcome = await downloadIfMissing(url, dest, flags, {
        headers: { "User-Agent": USER_AGENT },
      });
      logFetch(`${page.title}  (${page.icaos.length} ICAOs)`, outcome);
      if (outcome === "downloaded") {
        downloaded++;
        await new Promise((r) => setTimeout(r, 200)); // 5 req/s ceiling
      } else {
        cached++;
      }
      totalIcaos += page.icaos.length;
    } catch (err) {
      console.log(`  ✗ ${page.title}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(
    `\n${downloaded} downloaded, ${cached} cached, ${failed} failed — ${totalIcaos} ICAO codes covered.`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
