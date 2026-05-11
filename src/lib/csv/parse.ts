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
 * Codeshare key: `from|actualTo|scheduledDeparture`.
 *
 * Two airline rows that describe the same physical flight (e.g. AA's
 * JFK-LHR and BA's codeshare) share these three fields exactly. Rows with
 * no scheduled-departure timestamp are excluded from dedupe — without a
 * time anchor we can't safely distinguish two same-day same-route flights.
 */
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
      // No time anchor — pass through unconditionally
      kept.push(f);
      continue;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, f);
      kept.push(f);
      continue;
    }
    // Already have a flight with this key — record the dupe
    deduped.push({ kept: existing, dropped: f });
  }

  return { flights: kept, deduped };
}

export function parseFlightyCsv(csv: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

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
