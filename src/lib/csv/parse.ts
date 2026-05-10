import Papa from "papaparse";
import { FlightyRowSchema, type ParsedFlight, toParsedFlight } from "./schema.ts";

export interface ParseResult {
  flights: ParsedFlight[];
  skipped: { row: number; error: string }[];
  totalRows: number;
}

export function parseFlightyCsv(csv: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const flights: ParsedFlight[] = [];
  const skipped: { row: number; error: string }[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i];
    if (!raw) continue;
    const parsed = FlightyRowSchema.safeParse(raw);
    if (!parsed.success) {
      skipped.push({ row: i + 2, error: parsed.error.issues[0]?.message ?? "invalid" });
      continue;
    }
    flights.push(toParsedFlight(parsed.data));
  }

  return { flights, skipped, totalRows: result.data.length };
}
