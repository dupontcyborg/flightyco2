# Sample data

## `canonical-fixture.csv` (committed, public)

A hand-built 13-row Flighty CSV designed to exercise every edge case in
`src/lib` in a single fixture. Used by `src/lib/integration.test.ts` as the
canonical end-to-end test data.

**Coverage:**

| Concern | Row(s) | Notes |
|---|---|---|
| Cabin class — economy | 1, 4, 5, 6, 7, 9, 11, 13 | most common |
| Cabin class — premium economy | 3 | ATL-MCO short-haul |
| Cabin class — business | 2 | JFK-LHR widebody transatlantic |
| Cabin class — first | 7 | SFO-NRT widebody transpacific |
| Cabin class — null (fallback path) | 10 | BOS-MIA, exercises `cabinFallback` |
| Haul — domestic (≤463 km) | 1 | LGA-BOS, 295 km |
| Haul — short-haul (≤3700 km) | 3, 9, 13 | ATL-MCO, LAX-SFO, CDG-LHR |
| Haul — long-haul (>3700 km) | 2, 4, 5, 6, 7, 11 | transcontinental + transatlantic + transpacific |
| Cancelled flight (excluded) | 8 | ATL-LGA |
| Diverted flight (`actualTo` ≠ `to`) | 11 | JFK-LAX scheduled, diverted SAN — distance should be JFK-SAN |
| Codeshare dedupe pair | 5 + 6 | AA 100 and BA 1500 share `from\|to\|scheduled-dep` |
| Aircraft — exact match in TIM Appendix A | 1, 2, 3, 5, 6, 7, 13 | B738, B789, A321, A320 |
| Aircraft — substring fallback | 4 | "Boeing 737-900ER" → B739 |
| Aircraft — alias from `data/aircraft-aliases.yaml` | 9 | "Bombardier CRJ900" → CRJ9 (Canadair Regional Jet 900) |
| Aircraft — no string (TIM → DEFRA fallback) | 12 | ORD-DEN, exercises TIM's transparent DEFRA fallback |

**PII columns** (`PNR`, `Seat`, `Tail Number`, `Flight Reason`, `Notes`)
are intentionally left blank. Real flight numbers and airline codes are
used since those aren't personal data.

After dedupe + cancelled removal, the fixture yields **11 enriched
flights** over 3 calendar years (2022-2024).

## `FlightyExport-*.csv` (gitignored)

Personal Flighty exports — not committed. The `totals.test.ts` regression
suite runs against these when present and skips gracefully otherwise.
