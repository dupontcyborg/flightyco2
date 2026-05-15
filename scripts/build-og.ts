/**
 * Generate the Open Graph share image at public/og.png.
 *
 * Layout mirrors the "primary share card" design: the logo-wordmark SVG
 * (badge + flighty/co₂ lockup) over a divider and an italic-serif tagline
 * matching the site's hero copy.
 *
 * Fonts are downloaded on first run and cached under scripts/og/fonts/
 * (gitignored).
 *
 * Idempotent. Runs as part of `npm run prebuild`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { html } from "satori-html";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const fontsDir = resolve(__dirname, "og", "fonts");
const outPath = resolve(root, "public", "og.png");

// Google Fonts serves TTF when the client UA looks like it can't take woff2.
// We fetch the CSS once, extract the TTF URL, then download and cache.
const FONTS = [
  {
    // Inter Bold — used by resvg to render the <text> inside logo-wordmark.svg.
    name: "Inter",
    file: "Inter-700.ttf",
    cssUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap",
    weight: 700 as const,
    style: "normal" as const,
  },
  {
    name: "SourceSerif",
    file: "SourceSerif4-400i.ttf",
    cssUrl: "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@1,400&display=swap",
    weight: 400 as const,
    style: "italic" as const,
  },
];

const UA = "Mozilla/5.0 (compatible; OGBuilder/1.0)";

async function ensureFont(file: string, cssUrl: string): Promise<Buffer> {
  const p = resolve(fontsDir, file);
  if (existsSync(p)) return readFileSync(p);
  mkdirSync(fontsDir, { recursive: true });
  console.log(`[og] downloading ${file}`);
  const cssRes = await fetch(cssUrl, { headers: { "User-Agent": UA } });
  if (!cssRes.ok) throw new Error(`fetch css ${cssUrl}: ${cssRes.status}`);
  const css = await cssRes.text();
  const m = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
  if (!m) throw new Error(`no ttf url in css for ${file}`);
  const ttfRes = await fetch(m[1]);
  if (!ttfRes.ok) throw new Error(`fetch ttf ${m[1]}: ${ttfRes.status}`);
  const buf = Buffer.from(await ttfRes.arrayBuffer());
  writeFileSync(p, buf);
  return buf;
}

// Faint contrail diagonal across the card, echoing the hero design.
const CONTRAIL_SVG = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="t" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <line x1="-50" y1="600" x2="1250" y2="80" stroke="url(#t)" stroke-width="1.5"/>
</svg>
`.trim();

const WORDMARK_SVG = readFileSync(resolve(root, "src", "assets", "logo-wordmark.svg"), "utf8");

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function pngDataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

// Rasterize the wordmark SVG to PNG once with resvg (so its <text> renders
// against Inter from fontsDir). Satori then embeds the PNG, preserving the
// text — embedding the SVG directly drops <text> in the Satori → resvg path.
function rasterizeWordmark(targetWidth: number): Buffer {
  return new Resvg(WORDMARK_SVG, {
    fitTo: { mode: "width", value: targetWidth },
    font: {
      fontDirs: [fontsDir],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();
}

function template(wordmarkPng: Buffer): unknown {
  const wordmark = pngDataUrl(wordmarkPng);
  const contrail = svgDataUrl(CONTRAIL_SVG);

  // logo-wordmark.svg is 500×110. Render at 810×178 in the layout.
  const wordmarkW = 810;
  const wordmarkH = Math.round((wordmarkW * 110) / 500);

  return html`
    <div style="width: 1200px; height: 630px; background: #0a0a0c; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
      <img src="${contrail}" style="position: absolute; top: 0; left: 0; width: 1200px; height: 630px;" />

      <img src="${wordmark}" style="width: ${wordmarkW}px; height: ${wordmarkH}px;" />

      <div style="width: 760px; height: 1px; background: #26262d; margin-top: 56px; margin-bottom: 44px; display: flex;"></div>

      <div style="font-family: 'SourceSerif'; font-style: italic; font-weight: 400; font-size: 52px; color: #ffffff; line-height: 1.25; text-align: center; max-width: 1000px;">
        Your Flighty history, in tons of CO₂.
      </div>
    </div>
  `;
}

async function main() {
  const fonts = await Promise.all(
    FONTS.map(async (f) => ({
      name: f.name,
      data: await ensureFont(f.file, f.cssUrl),
      weight: f.weight,
      style: f.style,
    })),
  );

  // Rasterize wordmark at 2× the layout width for crisp downscaling.
  const wordmarkPng = rasterizeWordmark(1620);

  const svg = await satori(template(wordmarkPng) as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts,
  });

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      fontDirs: [fontsDir],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  })
    .render()
    .asPng();

  writeFileSync(outPath, png);
  console.log(`[og] wrote ${outPath} (${png.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
