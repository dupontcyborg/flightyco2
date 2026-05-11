/**
 * Validate data/seat-configs.yaml and emit data/json/seat-configs.json.
 *
 * The YAML is the source of truth — hand-curated, committed, comments-rich.
 * This script's only jobs:
 *   1. Parse YAML
 *   2. Validate schema (no negative seats, total > 0, body is narrow|wide)
 *   3. Sanity-check against EEA aircraft list (warn on missing ICAOs)
 *   4. Emit a compact JSON for the runtime
 *
 * Run: npm run data:seats
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const SRC = resolve(REPO, "data/seat-configs.yaml");
const OUT = resolve(REPO, "data/json/seat-configs.json");
const EEA_JSON = resolve(REPO, "data/json/eea-fuel-burn.json");

const SeatConfigSchema = z
  .object({
    body: z.enum(["narrow", "wide"]),
    F: z.number().int().nonnegative(),
    J: z.number().int().nonnegative(),
    W: z.number().int().nonnegative(),
    Y: z.number().int().nonnegative(),
    note: z.string().optional(),
  })
  .refine((c) => c.F + c.J + c.W + c.Y > 0, "total seats must be > 0");

interface OutputConfig {
  body: "narrow" | "wide";
  F: number;
  J: number;
  W: number;
  Y: number;
  total: number;
  note?: string;
}

async function main(): Promise<void> {
  console.log(`Reading ${SRC}`);
  const raw = parseYaml(readFileSync(SRC, "utf8")) as Record<string, unknown>;

  const configs: Record<string, OutputConfig> = {};
  let defaultConfig: OutputConfig | null = null;
  const errors: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    const parsed = SeatConfigSchema.safeParse(value);
    if (!parsed.success) {
      errors.push(`  ${key}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    const cfg = parsed.data;
    const total = cfg.F + cfg.J + cfg.W + cfg.Y;
    const out: OutputConfig = { body: cfg.body, F: cfg.F, J: cfg.J, W: cfg.W, Y: cfg.Y, total };
    if (cfg.note) out.note = cfg.note;
    if (key === "_default") defaultConfig = out;
    else configs[key] = out;
  }

  if (errors.length > 0) {
    console.error("Validation errors:");
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  // Coverage report against EEA aircraft list.
  try {
    const eea = JSON.parse(readFileSync(EEA_JSON, "utf8")) as { aircraft: Record<string, unknown> };
    const eeaCodes = Object.keys(eea.aircraft);
    const covered = eeaCodes.filter((c) => c in configs);
    const uncovered = eeaCodes.filter((c) => !(c in configs));
    console.log(
      `EEA coverage: ${covered.length}/${eeaCodes.length} (${((100 * covered.length) / eeaCodes.length).toFixed(0)}%)`,
    );
    if (uncovered.length > 0 && uncovered.length <= 250) {
      console.log(
        `  Uncovered (will use _default fallback): ${uncovered.length} codes — ${uncovered.slice(0, 20).join(", ")}${uncovered.length > 20 ? ", ..." : ""}`,
      );
    }
  } catch {
    console.log("(EEA aircraft list not yet built — skipping coverage report)");
  }

  // Breakdown
  const narrow = Object.values(configs).filter((c) => c.body === "narrow").length;
  const wide = Object.values(configs).filter((c) => c.body === "wide").length;
  console.log(`Configs: ${Object.keys(configs).length} total — ${narrow} narrow, ${wide} wide`);

  const payload = JSON.stringify({
    version: `manual-${new Date().toISOString().slice(0, 10)}`,
    source: "data/seat-configs.yaml (hand-curated from manufacturer typical configs)",
    default: defaultConfig,
    configs,
  });
  writeFileSync(OUT, payload);
  console.log(`\nWrote ${OUT} (${(payload.length / 1024).toFixed(1)} KB raw)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
