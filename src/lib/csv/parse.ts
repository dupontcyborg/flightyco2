import Papa from "papaparse";
import { FlightyRowSchema, type ParsedFlight, toParsedFlight } from "./schema.ts";

export interface DedupedFlight {
  /** The flight that was kept. */
  kept: ParsedFlight;
  /** The duplicate that was dropped. */
  dropped: ParsedFlight;
}

export interface ParseResult {
  flights: ParsedFlight[];
  skipped: { row: number; error: string }[];
  /** Duplicates removed by the codeshare heuristic. Visible, never silent. */
  deduped: DedupedFlight[];
  totalRows: number;
}

/**
 * Thrown when the input doesn't look like a Flighty CSV at all — wrong
 * headers, missing required columns, or a totally different file format.
 *
 * Distinguishes "not a Flighty CSV" (this) from "valid Flighty CSV with
 * bad rows" (returns ParseResult with non-empty `skipped`).
 */
export class NotFlightyCsvError extends Error {
  readonly missingColumns: string[];
  readonly foundColumns: string[];
  constructor(missing: string[], found: string[]) {
    super(
      `Doesn't look like a Flighty CSV export — missing required columns: ${missing.join(", ")}`,
    );
    this.name = "NotFlightyCsvError";
    this.missingColumns = missing;
    this.foundColumns = found;
  }
}

/**
 * Minimum columns we need to call a CSV "Flighty-shaped". A real Flighty
 * export has 33 columns; these 5 are the ones we cannot work without.
 */
const REQUIRED_FLIGHTY_COLUMNS = ["Date", "From", "To", "Canceled", "Flight Flighty ID"];

function codeshareKey(f: ParsedFlight): string | null {
  if (!f.scheduledDeparture) return null;
  return `${f.from}|${f.actualTo}|${f.scheduledDeparture}`;
}

function dedupeCodeshares(flights: ParsedFlight[]): {
  flights: ParsedFlight[];
  deduped: DedupedFlight[];
} {
  const seen = new Map<string, ParsedFlight>();
  const kept: ParsedFlight[] = [];
  const deduped: DedupedFlight[] = [];

  for (const f of flights) {
    const key = codeshareKey(f);
    if (!key) {
      kept.push(f);
      continue;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, f);
      kept.push(f);
      continue;
    }
    deduped.push({ kept: existing, dropped: f });
  }

  return { flights: kept, deduped };
}

/**
 * Parse a Flighty CSV export. Throws `NotFlightyCsvError` if the input
 * doesn't look like a Flighty CSV at all (missing required columns).
 *
 * For valid-shape CSVs with bad rows, returns a `ParseResult` with the bad
 * rows in `skipped` — caller decides how to surface those.
 */
export function parseFlightyCsv(csv: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  // Format sanity check — distinguish "wrong file format" from "valid format, no usable rows".
  const headers = result.meta.fields ?? [];
  const missing = REQUIRED_FLIGHTY_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length > 0) throw new NotFlightyCsvError(missing, headers);

  const raw: ParsedFlight[] = [];
  const skipped: { row: number; error: string }[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    if (!row) continue;
    const parsed = FlightyRowSchema.safeParse(row);
    if (!parsed.success) {
      skipped.push({ row: i + 2, error: parsed.error.issues[0]?.message ?? "invalid" });
      continue;
    }
    raw.push(toParsedFlight(parsed.data));
  }

  const { flights, deduped } = dedupeCodeshares(raw);
  return { flights, skipped, deduped, totalRows: result.data.length };
}
