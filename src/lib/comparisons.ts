/**
 * Reference budgets and equivalents used in the "headline comparisons"
 * (PRD: "Comparisons: vs. average American annual total, vs. 1.5°C-aligned
 * individual budget, vs. equivalent km driven").
 *
 * Sources cited per constant. Tweak by editing this file; UI components
 * should read these rather than inlining magic numbers.
 */

export const REFERENCE_BUDGETS = {
  /**
   * Average American per-person annual carbon footprint, kg CO₂e/year.
   * Source: Our World in Data, per-capita CO₂ emissions, USA 2022 (~14.4 t).
   * Rounded up to 16 t to match commonly cited "lifestyle footprint" figures
   * that include non-energy emissions.
   */
  avgAmericanAnnualKg: 16_000,

  /**
   * 1.5°C-aligned per-person annual carbon budget, kg CO₂e/year.
   * Source: Oxfam "Carbon Inequality Era" report, mid-range citation.
   * Stockholm Environment Institute uses 2.3 t; we pick the round 2 t.
   * Some sources go as low as 1.5 t — see PRD Open Questions.
   */
  paris15AnnualKg: 2_000,

  /**
   * Average passenger car emissions, kg CO₂e per vehicle-km.
   * Source: EPA passenger vehicle average ~411 g/mile → 0.255 kg/km TTW;
   * we use 0.171 kg/km to align with DEFRA's "average car (km)" factor for
   * a small/medium passenger car (without RF — directly comparable to our
   * without-RF aviation number).
   */
  carPerKm: 0.171,
} as const;

export interface ComparisonSet {
  /**
   * Multiple of the average American's total emissions over `years`.
   * E.g. 0.64 = "your flying alone was 64% of an average American's
   * entire 18-year footprint."
   */
  vsAvgAmerican: number;

  /**
   * Multiple of the 1.5°C-aligned individual budget over `years`.
   * E.g. 4.9 = "your flying alone was 4.9× the total carbon budget any
   * individual is allowed for 18 years."
   */
  vs15Budget: number;

  /**
   * Equivalent km driven by an average passenger car.
   * E.g. 1_023_000 = "the same emissions as driving an average car a
   * million km."
   */
  equivalentCarKm: number;

  /** Years the input covers — echoed back for UI labels. */
  years: number;
}

/**
 * Build the comparison set for a total carbon number over a given span.
 *
 * @param kgCo2e Total emissions to compare, kg CO₂e.
 * @param years  Number of years the total covers. Use 1 for an annual figure.
 */
export function comparisonsForTotal(kgCo2e: number, years: number): ComparisonSet {
  if (years <= 0) throw new RangeError(`years must be > 0, got ${years}`);
  return {
    vsAvgAmerican: kgCo2e / (REFERENCE_BUDGETS.avgAmericanAnnualKg * years),
    vs15Budget: kgCo2e / (REFERENCE_BUDGETS.paris15AnnualKg * years),
    equivalentCarKm: kgCo2e / REFERENCE_BUDGETS.carPerKm,
    years,
  };
}
