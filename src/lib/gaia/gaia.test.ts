import { beforeEach, describe, expect, it } from "vitest";
import { bootstrapTestData } from "../test-helpers.ts";
import { lookupGaia, setGaiaAirports, setGaiaCountries } from "./data.ts";

beforeEach(() => bootstrapTestData());

describe("lookupGaia — tier 1 (specific airport pair)", () => {
  it("returns the LSZH-KSFO pair (TIM worked example)", () => {
    const r = lookupGaia("LSZH", "KSFO", "CH", "US");
    expect(r.tier).toBe("airport-pair");
    expect(r.distanceRatio).toBeCloseTo(1.0273, 4);
    expect(r.fuelRatio).toBeCloseTo(1.0984, 4);
  });

  it("returns the KJFK-EGLL pair", () => {
    const r = lookupGaia("KJFK", "EGLL", "US", "GB");
    expect(r.tier).toBe("airport-pair");
    expect(r.distanceRatio).toBeGreaterThan(1.0);
    expect(r.distanceRatio).toBeLessThan(1.1);
  });

  it("airport-pair takes precedence over country-pair", () => {
    // KJFK-EGLL has its own pair; US-GB country pair also exists.
    // Tier 1 should fire and not fall through.
    const r = lookupGaia("KJFK", "EGLL", "US", "GB");
    expect(r.tier).toBe("airport-pair");
  });
});

describe("lookupGaia — tier 2 (country pair)", () => {
  it("falls through to country pair when airport pair not present", () => {
    // Use a small/uncommon airport ICAO that's not in tier 1, with country
    // codes that ARE in tier 2 (US-GB)
    const r = lookupGaia("KNON", "EGNON", "US", "GB");
    expect(r.tier).toBe("country-pair");
    expect(r.distanceRatio).toBeGreaterThan(1.0);
  });

  it("returns the canonical US-GB country pair", () => {
    const r = lookupGaia("", "", "US", "GB");
    expect(r.tier).toBe("country-pair");
    // US-GB is asymmetric with GB-US — confirm value within a small window
    expect(r.distanceRatio).toBeGreaterThan(1.02);
    expect(r.distanceRatio).toBeLessThan(1.05);
  });
});

describe("lookupGaia — tier 3 (default)", () => {
  it("returns 1.052 / 1.052 when neither tier 1 nor 2 match", () => {
    const r = lookupGaia("KNON", "EGNON", "ZZ", "QQ");
    expect(r.tier).toBe("default");
    expect(r.distanceRatio).toBe(1.052);
    expect(r.fuelRatio).toBe(1.052);
  });

  it("returns default for empty country codes", () => {
    const r = lookupGaia("", "", "", "");
    expect(r.tier).toBe("default");
  });

  it("returns default for empty ICAO when country tier also misses", () => {
    const r = lookupGaia("", "", "ZZ", "QQ");
    expect(r.tier).toBe("default");
  });
});

describe("lookupGaia — constructed mini tables", () => {
  it("respects custom airport-pair table", () => {
    setGaiaAirports({ "AAAA-BBBB": [1.5, 1.6] });
    setGaiaCountries({});
    const r = lookupGaia("AAAA", "BBBB", "XX", "YY");
    expect(r.tier).toBe("airport-pair");
    expect(r.distanceRatio).toBe(1.5);
    expect(r.fuelRatio).toBe(1.6);
    bootstrapTestData(); // doesn't restore since flag is set; reset manually
    // Re-bootstrap helper resets stores
  });
});
