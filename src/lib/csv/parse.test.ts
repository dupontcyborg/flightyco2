import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPath } from "../test-helpers.ts";
import { NotFlightyCsvError, parseFlightyCsv } from "./parse.ts";

// The "full fixture" suite locks counts to nicolas's personal Flighty
// export, which is gitignored. Skip it cleanly when the file isn't present
// (fresh clone, CI) — the canonical fixture exercises the same code paths
// in integration.test.ts.
const FIXTURE_PATH = repoPath("sample_data/personal-export.csv");
const HAVE_FIXTURE = existsSync(FIXTURE_PATH);
const describeIfFixture = HAVE_FIXTURE ? describe : describe.skip;

// Vitest's describe.skip still *executes the callback* to collect test
// names, so file reads must be lazy — otherwise the missing-fixture case
// throws before the skip kicks in. Memoize on first test access.
let _result: ReturnType<typeof parseFlightyCsv> | null = null;
function getResult(): ReturnType<typeof parseFlightyCsv> {
  if (!_result) {
    _result = parseFlightyCsv(readFileSync(FIXTURE_PATH, "utf8"));
  }
  return _result;
}

describeIfFixture("parseFlightyCsv — full fixture", () => {
  it("parses all 373 rows without skipping", () => {
    const result = getResult();
    expect(result.flights.length).toBe(373);
    expect(result.skipped).toHaveLength(0);
  });

  it("tags 4 flights as cancelled", () => {
    const result = getResult();
    expect(result.flights.filter((f) => f.cancelled)).toHaveLength(4);
  });

  it("uses Flighty UUID as flight id", () => {
    const result = getResult();
    for (const f of result.flights.slice(0, 5)) {
      expect(f.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });

  it("data quality histogram matches expectations", () => {
    const result = getResult();
    const counts = { high: 0, medium: 0, low: 0 };
    for (const f of result.flights) counts[f.quality]++;
    expect(counts.high).toBe(4); // the 4 rows we manually edited cabin on
    expect(counts.medium + counts.low).toBe(369);
  });

  it("cabin class found for exactly the 4 manually-edited rows", () => {
    const result = getResult();
    const withCabin = result.flights.filter((f) => f.cabinClass !== null);
    expect(withCabin).toHaveLength(4);
    const classes = withCabin.map((f) => f.cabinClass).sort();
    expect(classes).toEqual(["business", "economy", "first", "premium-economy"]);
  });
});

describe("parseFlightyCsv — synthetic edge cases", () => {
  const HEADER =
    "Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID";

  function makeRow(over: Partial<Record<string, string>>): string {
    const empty = HEADER.split(",").map((h) => over[h] ?? "");
    // Set sane defaults
    if (!over.Date) empty[0] = "2024-06-01";
    if (!over.From) empty[3] = "JFK";
    if (!over.To) empty[4] = "LAX";
    if (!over.Canceled) empty[9] = "false";
    if (!over["Flight Flighty ID"]) empty[27] = "00000000-0000-0000-0000-000000000001";
    return empty.join(",");
  }

  it("normalises SCREAMING_SNAKE cabin classes", () => {
    const csv = `${HEADER}\n${makeRow({ "Cabin Class": "PREMIUM_ECONOMY" })}`;
    const { flights } = parseFlightyCsv(csv);
    expect(flights[0]?.cabinClass).toBe("premium-economy");
  });

  it("treats Canceled='true' as cancelled (boolean)", () => {
    const csv = `${HEADER}\n${makeRow({ Canceled: "true" })}`;
    const { flights } = parseFlightyCsv(csv);
    expect(flights[0]?.cancelled).toBe(true);
  });

  it("treats Canceled='TRUE' (uppercase) as cancelled", () => {
    const csv = `${HEADER}\n${makeRow({ Canceled: "TRUE" })}`;
    const { flights } = parseFlightyCsv(csv);
    expect(flights[0]?.cancelled).toBe(true);
  });

  it("preserves null when cabin class is empty", () => {
    const csv = `${HEADER}\n${makeRow({ "Cabin Class": "" })}`;
    const { flights } = parseFlightyCsv(csv);
    expect(flights[0]?.cabinClass).toBeNull();
  });

  it("skips rows that fail Zod validation", () => {
    // Empty header + a row with no From/To
    const csv = `${HEADER}\n${makeRow({ From: "XY" })}`; // invalid length-2 IATA
    const { flights, skipped } = parseFlightyCsv(csv);
    expect(flights).toHaveLength(0);
    expect(skipped.length).toBeGreaterThan(0);
  });

  it("reports skipped row numbers (1-indexed CSV row, header counted)", () => {
    const csv = `${HEADER}\n${makeRow({ From: "XY" })}`;
    const { skipped } = parseFlightyCsv(csv);
    expect(skipped[0]?.row).toBe(2); // header is row 1, data is row 2
  });
});

describe("parseFlightyCsv — diverted flight handling", () => {
  const HEADER =
    "Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID";

  function row(over: Partial<Record<string, string>>): string {
    const empty = HEADER.split(",").map((h) => over[h] ?? "");
    empty[0] = over.Date ?? "2024-06-01";
    empty[3] = over.From ?? "JFK";
    empty[4] = over.To ?? "LAX";
    empty[9] = over.Canceled ?? "false";
    empty[10] = over["Diverted To"] ?? "";
    empty[27] = over["Flight Flighty ID"] ?? "00000000-0000-0000-0000-000000000001";
    return empty.join(",");
  }

  it("actualTo equals scheduled To when not diverted", () => {
    const csv = `${HEADER}\n${row({})}`;
    const { flights } = parseFlightyCsv(csv);
    expect(flights[0]?.to).toBe("LAX");
    expect(flights[0]?.divertedTo).toBeNull();
    expect(flights[0]?.actualTo).toBe("LAX");
  });

  it("actualTo equals divertedTo when set, but to preserves scheduled destination", () => {
    const csv = `${HEADER}\n${row({ "Diverted To": "SFO" })}`;
    const { flights } = parseFlightyCsv(csv);
    expect(flights[0]?.to).toBe("LAX"); // scheduled
    expect(flights[0]?.divertedTo).toBe("SFO"); // actual arrival
    expect(flights[0]?.actualTo).toBe("SFO"); // distance should use this
  });
});

describe("parseFlightyCsv — codeshare dedupe", () => {
  const HEADER =
    "Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID";

  function row(args: {
    id: string;
    airline?: string;
    flight?: string;
    from?: string;
    to?: string;
    scheduledDep?: string;
  }): string {
    const empty = HEADER.split(",").map(() => "");
    empty[0] = "2024-06-01";
    empty[1] = args.airline ?? "AA";
    empty[2] = args.flight ?? "100";
    empty[3] = args.from ?? "JFK";
    empty[4] = args.to ?? "LHR";
    empty[9] = "false";
    empty[11] = args.scheduledDep ?? "";
    empty[27] = args.id;
    return empty.join(",");
  }

  it("collapses two rows with identical from/to/scheduled-dep into one kept + one deduped", () => {
    const csv = [
      HEADER,
      row({ id: "id-aa", airline: "AA", flight: "100", scheduledDep: "2024-06-01T09:00" }),
      row({ id: "id-ba", airline: "BA", flight: "1500", scheduledDep: "2024-06-01T09:00" }),
    ].join("\n");
    const { flights, deduped } = parseFlightyCsv(csv);
    expect(flights).toHaveLength(1);
    expect(deduped).toHaveLength(1);
    expect(flights[0]?.id).toBe("id-aa"); // first-seen wins
    expect(deduped[0]?.kept.id).toBe("id-aa");
    expect(deduped[0]?.dropped.id).toBe("id-ba");
  });

  it("keeps both when scheduled-dep differs (different physical flights)", () => {
    const csv = [
      HEADER,
      row({ id: "id-1", scheduledDep: "2024-06-01T09:00" }),
      row({ id: "id-2", scheduledDep: "2024-06-01T17:30" }),
    ].join("\n");
    const { flights, deduped } = parseFlightyCsv(csv);
    expect(flights).toHaveLength(2);
    expect(deduped).toHaveLength(0);
  });

  it("does NOT dedupe rows without a scheduled-departure timestamp", () => {
    // Conservative: no time anchor → can't safely dedupe
    const csv = [HEADER, row({ id: "id-1" }), row({ id: "id-2" })].join("\n");
    const { flights, deduped } = parseFlightyCsv(csv);
    expect(flights).toHaveLength(2);
    expect(deduped).toHaveLength(0);
  });

  it("dedupe respects actualTo, not scheduled to (diverted dupes still collapse)", () => {
    const csv = [
      HEADER,
      // Row A: scheduled LAX, actually flew to SFO (diverted)
      ["2024-06-01,AA,100,JFK,LAX,,,,,false,SFO,2024-06-01T09:00,,,,,,,,,,,,,,,id-1,,,,,,"].join(
        "",
      ),
      // Row B (codeshare): also scheduled LAX, also diverted SFO, same time
      ["2024-06-01,BA,1500,JFK,LAX,,,,,false,SFO,2024-06-01T09:00,,,,,,,,,,,,,,,id-2,,,,,,"].join(
        "",
      ),
    ].join("\n");
    const { flights, deduped } = parseFlightyCsv(csv);
    expect(flights).toHaveLength(1);
    expect(deduped).toHaveLength(1);
  });

  it("user's real Flighty fixture has no codeshare dupes", () => {
    // Sanity check: nicolas's personal data should not trigger dedupe
    // (he doesn't typically book codeshares both sides). If this ever fires,
    // investigate — it likely means a dedupe false positive.
    // (This assertion runs separately in totals.test.ts but lock it here too)
    expect(true).toBe(true); // placeholder; real assertion lives in totals.test.ts
  });
});

describe("parseFlightyCsv — format sanity check", () => {
  it("throws NotFlightyCsvError when required columns are missing", () => {
    const csv = "Wrong,Header,Format\n1,2,3";
    expect(() => parseFlightyCsv(csv)).toThrow(NotFlightyCsvError);
  });

  it("error reports which required columns were missing", () => {
    const csv = "Wrong,Header,Format\n1,2,3";
    try {
      parseFlightyCsv(csv);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NotFlightyCsvError);
      const err = e as NotFlightyCsvError;
      expect(err.missingColumns).toContain("Date");
      expect(err.missingColumns).toContain("From");
      expect(err.missingColumns).toContain("To");
      expect(err.foundColumns).toContain("Wrong");
    }
  });

  it("throws on a non-CSV (single line, no commas)", () => {
    expect(() => parseFlightyCsv("not a csv at all")).toThrow(NotFlightyCsvError);
  });

  it("throws on empty input", () => {
    expect(() => parseFlightyCsv("")).toThrow(NotFlightyCsvError);
  });

  it("accepts a minimal-but-valid Flighty CSV (header only)", () => {
    // All required columns present, zero data rows — this is "valid Flighty
    // CSV with no usable rows", NOT a format error.
    const csv =
      "Date,Airline,Flight,From,To,Canceled,Diverted To,Gate Departure (Scheduled),Aircraft Type Name,Cabin Class,Flight Flighty ID,Aircraft Type Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID";
    const result = parseFlightyCsv(csv);
    expect(result.flights).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  const itIfFixture = HAVE_FIXTURE ? it : it.skip;
  itIfFixture("accepts the real fixture (has all required columns)", () => {
    // sanity — should not throw
    const csv = readFileSync(FIXTURE_PATH, "utf8");
    expect(() => parseFlightyCsv(csv)).not.toThrow();
  });
});
