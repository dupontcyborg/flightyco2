/**
 * Orchestrator: refresh all reference data sources in sequence.
 *
 * Run: npm run data
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(import.meta.url), "..");

const SCRIPTS = ["update-airports.ts", "update-gaia.ts", "update-eea.ts"];

for (const script of SCRIPTS) {
  console.log(`\n=========================================================`);
  console.log(`==> ${script}`);
  console.log(`=========================================================`);
  const result = spawnSync("npx", ["tsx", resolve(HERE, script)], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`\n${script} failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n==> All reference data refreshed.");
