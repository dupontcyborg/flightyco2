/**
 * Shared CLI helpers for the data-update scripts.
 *
 * Each script accepts `--force` / `-f` to bypass the local cache and
 * re-download upstream files. Without that flag, downloads are skipped
 * when the destination file already exists.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface CliFlags {
  force: boolean;
}

export function parseFlags(argv: string[] = process.argv.slice(2)): CliFlags {
  return { force: argv.includes("--force") || argv.includes("-f") };
}

export type FetchOutcome = "downloaded" | "cached";

/**
 * Download a URL to disk unless the file already exists. Use `force: true`
 * to overwrite. Returns "cached" when the local file was reused.
 */
export async function downloadIfMissing(
  url: string,
  destPath: string,
  flags: CliFlags,
  init?: RequestInit,
): Promise<FetchOutcome> {
  if (!flags.force && existsSync(destPath)) return "cached";
  mkdirSync(dirname(destPath), { recursive: true });
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} returned ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
  return "downloaded";
}

export function logFetch(label: string, outcome: FetchOutcome, sizeBytes?: number): void {
  const marker = outcome === "cached" ? "·" : "↓";
  const size = sizeBytes !== undefined ? `  (${(sizeBytes / 1024).toFixed(1)} KB)` : "";
  console.log(`  ${marker} ${label}${size}  [${outcome}]`);
}
