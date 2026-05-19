/**
 * Postbuild: inject two kinds of link hints into each built HTML page.
 *
 * 1) `<link rel="prefetch">` for lazy chunks we *know* the user will need
 *    shortly after landing (the modals). Idle-priority, not in Lighthouse's
 *    critical request chain.
 *
 * 2) `<link rel="modulepreload">` for the static deps of each Astro island
 *    entry. Astro hydration uses a runtime `import()`, so Vite can't see
 *    the island's static graph and won't auto-preload it. Without this,
 *    those deps form a depth-2 critical chain (entry → component + snippet
 *    chunks). Modulepreload promotes them to peers of the entry in HTML,
 *    flattening the chain to depth 1.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = join(import.meta.dirname, "..", "dist");
const ASSETS_DIR = join(DIST, "_astro");

// Source-file basenames of chunks we want prefetched. Match against the
// hashed filenames the bundler emits (e.g. `HowToModal.C4RCa6Hf.js`).
const PREFETCH_CHUNKS = ["HowToModal", "MethodologyModal"];

function findChunks(): string[] {
  const files = readdirSync(ASSETS_DIR);
  const matches: string[] = [];
  for (const base of PREFETCH_CHUNKS) {
    const re = new RegExp(`^${base}\\.[A-Za-z0-9_-]+\\.js$`);
    const hit = files.find((f) => re.test(f));
    if (!hit) {
      console.warn(`[prefetch] no chunk found for ${base} — skipping`);
      continue;
    }
    matches.push(`/_astro/${hit}`);
  }
  return matches;
}

function walkHtml(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

// Pull every `<astro-island component-url="/_astro/Foo.HASH.js">` chunk path
// out of the HTML, then read each chunk and regex out the relative
// imports — those are the static deps Astro's runtime `import()` will
// trigger after hydration. Returns absolute URLs ready for modulepreload.
function islandStaticDeps(html: string): string[] {
  const islandRe = /<astro-island\b[^>]*\bcomponent-url="(\/_astro\/[^"]+\.js)"/g;
  const deps = new Set<string>();
  let m: RegExpExecArray | null;
  m = islandRe.exec(html);
  while (m !== null) {
    const entryUrl = m[1];
    const entryPath = join(DIST, entryUrl);
    try {
      const src = readFileSync(entryPath, "utf8");
      // Rollup output uses double-quoted `import"./Foo.HASH.js"` and
      // `from"./Foo.HASH.js"` forms; cover both.
      const importRe = /(?:import|from)"(\.\/[^"]+\.js)"/g;
      let im: RegExpExecArray | null;
      im = importRe.exec(src);
      while (im !== null) {
        deps.add(`/_astro/${im[1].slice(2)}`);
        im = importRe.exec(src);
      }
    } catch {
      // Missing entry — skip silently; Astro would have warned at build.
    }
    m = islandRe.exec(html);
  }
  return [...deps];
}

function injectInto(html: string, prefetchHrefs: string[]): string {
  const modulepreloadHrefs = islandStaticDeps(html);
  const prefetchTags = prefetchHrefs
    .filter((h) => !html.includes(`rel="prefetch" href="${h}"`))
    .map((h) => `<link rel="prefetch" href="${h}" as="script" crossorigin="anonymous">`);
  const modulepreloadTags = modulepreloadHrefs
    .filter((h) => !html.includes(`rel="modulepreload" href="${h}"`))
    .map((h) => `<link rel="modulepreload" href="${h}" crossorigin="anonymous">`);
  if (prefetchTags.length === 0 && modulepreloadTags.length === 0) return html;
  return html.replace("</head>", `${modulepreloadTags.join("")}${prefetchTags.join("")}</head>`);
}

const chunks = findChunks();
if (chunks.length === 0) {
  console.warn("[prefetch] no chunks matched — nothing to inject");
  process.exit(0);
}

const pages = walkHtml(DIST);
let patched = 0;
for (const page of pages) {
  const before = readFileSync(page, "utf8");
  const after = injectInto(before, chunks);
  if (after !== before) {
    writeFileSync(page, after);
    patched++;
  }
}

console.log(
  `[prefetch] patched ${patched}/${pages.length} page(s) with chunk prefetch + island modulepreload:`,
);
for (const c of chunks) console.log(`  prefetch:      ${c}`);
for (const p of pages) {
  console.log(`  → ${relative(DIST, p)}`);
  const deps = islandStaticDeps(readFileSync(p, "utf8"));
  for (const d of deps) console.log(`    modulepreload: ${d}`);
}
