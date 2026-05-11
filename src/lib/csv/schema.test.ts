import { describe, expect, it } from "vitest";
import {
  type CabinClass,
  classifyQuality,
  type FlightyRow,
  normalizeCabinClass,
} from "./schema.ts";

describe("normalizeCabinClass", () => {
  it.each<[string, CabinClass]>([
    ["ECONOMY", "economy"],
    ["economy", "economy"],
    ["Economy", "economy"],
    ["coach", "economy"],
    ["COACH", "economy"],
    ["PREMIUM_ECONOMY", "premium-economy"],
    ["premium economy", "premium-economy"],
    ["Premium Economy", "premium-economy"],
    ["BUSINESS", "business"],
    ["business", "business"],
    ["FIRST", "first"],
    ["First", "first"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeCabinClass(input)).toBe(expected);
  });

  it.each<string | null>(["", "   ", "ridiculous", null])("returns null for %s", (input) => {
    expect(normalizeCabinClass(input)).toBeNull();
  });

  it("strips underscores and normalises whitespace before lookup", () => {
    expect(normalizeCabinClass("premium_economy")).toBe("premium-economy");
    expect(normalizeCabinClass("premium-economy")).toBe("premium-economy");
    expect(normalizeCabinClass("  PREMIUM  ECONOMY  ")).toBe("premium-economy");
  });
});

describe("classifyQuality", () => {
  // We only need the fields that classifyQuality actually inspects.
  const minimal = (over: Partial<FlightyRow>): FlightyRow =>
    ({
      Date: "2024-01-01",
      Airline: "AA",
      Flight: "100",
      From: "JFK",
      To: "LAX",
      Canceled: false,
      "Diverted To": null,
      "Aircraft Type Name": null,
      "Cabin Class": null,
      "Gate Departure (Scheduled)": null,
      "Flight Flighty ID": "id",
      "Departure Airport Flighty ID": null,
      "Arrival Airport Flighty ID": null,
      "Aircraft Type Flighty ID": null,
      ...over,
    }) as FlightyRow;

  it("high — both aircraft + cabin recorded", () => {
    expect(
      classifyQuality(minimal({ "Aircraft Type Name": "Boeing 787-9", "Cabin Class": "ECONOMY" })),
    ).toBe("high");
  });

  it("medium — aircraft only", () => {
    expect(classifyQuality(minimal({ "Aircraft Type Name": "Boeing 787-9" }))).toBe("medium");
  });

  it("medium — cabin only", () => {
    expect(classifyQuality(minimal({ "Cabin Class": "ECONOMY" }))).toBe("medium");
  });

  it("low — neither recorded", () => {
    expect(classifyQuality(minimal({}))).toBe("low");
  });
});
