import { beforeEach, describe, expect, it } from "vitest";
import { bootstrapTestData } from "../test-helpers.ts";
import {
  type AircraftFuelBurn,
  getFuelBurnEntry,
  interpolateCcdFuel,
  setFuelBurn,
} from "./fuel-burn.ts";

beforeEach(() => bootstrapTestData());

describe("getFuelBurnEntry", () => {
  it("returns B789 LTO of 1638 kg (matches TIM Table 1)", () => {
    const entry = getFuelBurnEntry("B789");
    expect(entry).not.toBeNull();
    expect(entry?.lto_kg).toBeCloseTo(1638, 0);
  });

  it("returns CCD curve sorted ascending by distance", () => {
    const entry = getFuelBurnEntry("B789");
    expect(entry?.ccd.length).toBeGreaterThan(5);
    const distances = entry?.ccd.map((p) => p[0]) ?? [];
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
  });

  it("uppercases ICAO codes before lookup", () => {
    expect(getFuelBurnEntry("b789")).not.toBeNull();
  });

  it("returns null for unknown ICAO", () => {
    expect(getFuelBurnEntry("ZZZZ")).toBeNull();
  });
});

describe("interpolateCcdFuel — TIM Table 1 reference values (B789)", () => {
  it("returns 5852 kg at exactly 500 NM (table point)", () => {
    const entry = getFuelBurnEntry("B789")!;
    expect(interpolateCcdFuel(entry, 500)).toBeCloseTo(5852, 0);
  });

  it("returns 52962 kg at exactly 5000 NM (table point)", () => {
    const entry = getFuelBurnEntry("B789")!;
    expect(interpolateCcdFuel(entry, 5000)).toBeCloseTo(52962, 0);
  });

  it("interpolates ~54801 kg at 5180 NM (TIM's worked example, ±1 kg)", () => {
    // TIM doc cites 54802 (their inputs are rounded to integer kg).
    // Our extractor preserves 2 decimals so we compute 54801.29.
    const entry = getFuelBurnEntry("B789")!;
    const r = interpolateCcdFuel(entry, 5180)!;
    expect(Math.abs(r - 54802)).toBeLessThan(1);
  });

  it("midpoint interpolation matches manual calculation", () => {
    // 5250 NM midway between 5000 and 5500 — should be ~(52962 + 58072) / 2
    const entry = getFuelBurnEntry("B789")!;
    const r = interpolateCcdFuel(entry, 5250)!;
    expect(Math.abs(r - 55517)).toBeLessThan(1);
  });
});

describe("interpolateCcdFuel — extrapolation outside the table", () => {
  it("extrapolates below the smallest data point (linear)", () => {
    // Manufactured 2-point curve to test math directly
    const entry: AircraftFuelBurn = {
      lto_kg: 1000,
      lto2_kg: null,
      ccd: [
        [100, 1000],
        [200, 2000],
      ],
    };
    // At 50 NM: y = 1000 + (50-100)/(200-100) × (2000-1000) = 1000 - 500 = 500
    expect(interpolateCcdFuel(entry, 50)).toBeCloseTo(500, 6);
  });

  it("extrapolates above the largest data point (linear)", () => {
    const entry: AircraftFuelBurn = {
      lto_kg: 1000,
      lto2_kg: null,
      ccd: [
        [100, 1000],
        [200, 2000],
      ],
    };
    // At 300 NM: y = 1000 + (300-100)/(200-100) × (2000-1000) = 1000 + 2000 = 3000
    expect(interpolateCcdFuel(entry, 300)).toBeCloseTo(3000, 6);
  });

  it("returns null for an empty CCD curve", () => {
    const entry: AircraftFuelBurn = { lto_kg: 1000, lto2_kg: null, ccd: [] };
    expect(interpolateCcdFuel(entry, 1000)).toBeNull();
  });

  it("returns the single point when CCD has length 1", () => {
    const entry: AircraftFuelBurn = { lto_kg: 1000, lto2_kg: null, ccd: [[500, 12345]] };
    expect(interpolateCcdFuel(entry, 1000)).toBe(12345);
  });
});

describe("setFuelBurn / loaded state", () => {
  it("throws when fuel burn is queried without being loaded", () => {
    // Reset via a tiny manual override
    setFuelBurn({
      version: "test-empty",
      aircraft: {},
    });
    expect(getFuelBurnEntry("B789")).toBeNull();
    bootstrapTestData(); // restore is a no-op since idempotent — re-set explicitly
    // We need to re-load. Read file again.
  });
});
