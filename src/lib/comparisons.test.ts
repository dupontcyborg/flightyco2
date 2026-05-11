import { describe, expect, it } from "vitest";
import { type ComparisonSet, comparisonsForTotal, REFERENCE_BUDGETS } from "./comparisons.ts";

describe("comparisonsForTotal", () => {
  it("returns 1.0× when emissions equal the avg American × years", () => {
    const r = comparisonsForTotal(REFERENCE_BUDGETS.avgAmericanAnnualKg * 5, 5);
    expect(r.vsAvgAmerican).toBeCloseTo(1.0, 6);
  });

  it("returns 1.0× when emissions equal the 1.5° budget × years", () => {
    const r = comparisonsForTotal(REFERENCE_BUDGETS.paris15AnnualKg * 5, 5);
    expect(r.vs15Budget).toBeCloseTo(1.0, 6);
  });

  it("matches user's headline numbers (175 t over 18 yr)", () => {
    const r = comparisonsForTotal(175_000, 18);
    // 175 / (16 × 18) = 0.608
    expect(r.vsAvgAmerican).toBeCloseTo(0.608, 2);
    // 175 / (2 × 18) = 4.86
    expect(r.vs15Budget).toBeCloseTo(4.86, 2);
  });

  it("computes equivalent car km using REFERENCE_BUDGETS.carPerKm", () => {
    const r = comparisonsForTotal(100, 1);
    expect(r.equivalentCarKm).toBeCloseTo(100 / REFERENCE_BUDGETS.carPerKm, 4);
  });

  it("echoes back years", () => {
    expect(comparisonsForTotal(1, 7).years).toBe(7);
  });

  it("throws on non-positive years", () => {
    expect(() => comparisonsForTotal(100, 0)).toThrow(/years/);
    expect(() => comparisonsForTotal(100, -1)).toThrow(/years/);
  });

  it("scales linearly with kgCo2e", () => {
    const a = comparisonsForTotal(1_000, 1);
    const b = comparisonsForTotal(10_000, 1);
    expect(b.vsAvgAmerican / a.vsAvgAmerican).toBeCloseTo(10, 6);
    expect(b.equivalentCarKm / a.equivalentCarKm).toBeCloseTo(10, 6);
  });

  it("ComparisonSet shape matches type", () => {
    const r: ComparisonSet = comparisonsForTotal(100, 1);
    expect(typeof r.vsAvgAmerican).toBe("number");
    expect(typeof r.vs15Budget).toBe("number");
    expect(typeof r.equivalentCarKm).toBe("number");
    expect(typeof r.years).toBe("number");
  });
});

describe("REFERENCE_BUDGETS", () => {
  it("avgAmerican is > paris15 budget (climate reality)", () => {
    expect(REFERENCE_BUDGETS.avgAmericanAnnualKg).toBeGreaterThan(
      REFERENCE_BUDGETS.paris15AnnualKg,
    );
  });

  it("car per-km is in a reasonable range (0.1-0.3 kg/km)", () => {
    expect(REFERENCE_BUDGETS.carPerKm).toBeGreaterThan(0.1);
    expect(REFERENCE_BUDGETS.carPerKm).toBeLessThan(0.3);
  });
});
