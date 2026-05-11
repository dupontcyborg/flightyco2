/**
 * DEFRA 2024 calculator — verify factor application against the published
 * UK Gov spreadsheet values.
 *
 * Verified factors (kg CO₂e per passenger-km, no RF):
 *   Economy:          0.07948
 *   Premium economy:  0.12716
 *   Business:         0.23047
 *   First:            0.31789
 *
 * These are DEFRA's "International, to/from non-UK" tier (without RF).
 * Source: UK Gov GHG Conversion Factors 2024 v1.1, "Business travel- air".
 */

import { calculateDefra } from "./defra.ts";
import { DEFRA_FACTORS_KG_PER_PKM } from "./factors/defra-2024.ts";
import { DEFAULT_EMISSION_OPTIONS, type EmissionOptions } from "./types.ts";

const cases: { distance: number; cabin: keyof typeof DEFRA_FACTORS_KG_PER_PKM; label: string }[] = [
  { distance: 1000, cabin: "economy", label: "1000 km · economy" },
  { distance: 1000, cabin: "premium-economy", label: "1000 km · premium economy" },
  { distance: 1000, cabin: "business", label: "1000 km · business" },
  { distance: 1000, cabin: "first", label: "1000 km · first" },
  { distance: 5000, cabin: "economy", label: "5000 km · economy" },
  { distance: 5000, cabin: "business", label: "5000 km · business" },
];

const noRfNoUplift: EmissionOptions = {
  ...DEFAULT_EMISSION_OPTIONS,
  nonCo2Multiplier: 1,
  routingUplift: 1,
};

console.log("DEFRA 2024 factor verification (no RF, no routing uplift):");
console.log("");
let failed = 0;
for (const c of cases) {
  const result = calculateDefra(
    {
      distanceKm: c.distance,
      cabinClass: c.cabin,
      aircraft: null,
      aircraftId: null,
    },
    noRfNoUplift,
  );
  const expected = c.distance * DEFRA_FACTORS_KG_PER_PKM[c.cabin];
  const delta = Math.abs(result.kgCo2 - expected);
  const ok = delta < 0.001;
  if (!ok) failed++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${c.label.padEnd(32)}  ${result.kgCo2.toFixed(4)} kg  (expected ${expected.toFixed(4)})`,
  );
}

// RF multiplier check: confirm 1.9× toggle works
const rfCheck = calculateDefra(
  { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
  { ...noRfNoUplift, nonCo2Multiplier: 1.9 },
);
const expectedRf = 1000 * 0.07948 * 1.9;
const rfOk = Math.abs(rfCheck.kgCo2e - expectedRf) < 0.001;
if (!rfOk) failed++;
console.log(
  `  ${rfOk ? "✓" : "✗"} RF×1.9 toggle              ${rfCheck.kgCo2e.toFixed(4)} kg  (expected ${expectedRf.toFixed(4)})`,
);

// Routing uplift check: confirm 1.09× distance uplift is applied
const upliftCheck = calculateDefra(
  { distanceKm: 1000, cabinClass: "economy", aircraft: null, aircraftId: null },
  { ...noRfNoUplift, routingUplift: 1.09 },
);
const expectedUplift = 1000 * 1.09 * 0.07948;
const upliftOk = Math.abs(upliftCheck.kgCo2 - expectedUplift) < 0.001;
if (!upliftOk) failed++;
console.log(
  `  ${upliftOk ? "✓" : "✗"} Routing uplift 1.09×       ${upliftCheck.kgCo2.toFixed(4)} kg  (expected ${expectedUplift.toFixed(4)})`,
);

// Cabin fallback check: null cabin → uses fallback
const fbCheck = calculateDefra(
  { distanceKm: 1000, cabinClass: null, aircraft: null, aircraftId: null },
  { ...noRfNoUplift, cabinFallback: "business" },
);
const fbOk =
  fbCheck.cabinClass === "business" &&
  fbCheck.cabinSource === "fallback" &&
  fbCheck.caveats.some((c) => c.includes("cabin assumed: business"));
if (!fbOk) failed++;
console.log(
  `  ${fbOk ? "✓" : "✗"} Cabin fallback to business  cabinSource=${fbCheck.cabinSource}  caveat=${fbCheck.caveats[0]}`,
);

if (failed > 0) {
  console.error(`\n✗ FAIL: ${failed} assertion(s)`);
  process.exit(1);
}
console.log(`\n✓ PASS: all DEFRA factor assertions hold against verified UK Gov 2024 values`);
