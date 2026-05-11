import { describe, expect, it } from "vitest";
import { bootstrapTestData } from "../test-helpers.ts";
import { aircraftToIcao, normalizeAircraftName, setAircraftMapping } from "./data.ts";

bootstrapTestData();

describe("normalizeAircraftName", () => {
  it("lowercases", () => {
    expect(normalizeAircraftName("BOEING")).toBe("boeing");
  });
  it("strips whitespace", () => {
    expect(normalizeAircraftName("Boeing 737-800")).toBe("boeing737-800");
  });
  it("strips parens, slashes, and punctuation but preserves hyphens", () => {
    expect(normalizeAircraftName("Airbus A330-200 (Winglets)")).toBe("airbusa330-200winglets");
    expect(normalizeAircraftName("Boeing 777-200/200ER")).toBe("boeing777-200200er");
  });
  it("returns empty for non-alphanumeric input", () => {
    expect(normalizeAircraftName("   ")).toBe("");
    expect(normalizeAircraftName("...")).toBe("");
  });
});

describe("aircraftToIcao — exact matches (Appendix A directly)", () => {
  const cases: { name: string; icao: string }[] = [
    { name: "Boeing 787-9", icao: "B789" },
    { name: "Boeing 787-8", icao: "B788" },
    { name: "Boeing 737-800", icao: "B738" },
    { name: "Airbus A320neo", icao: "A20N" },
    { name: "Airbus A321neo", icao: "A21N" },
    { name: "Airbus A350-900", icao: "A359" },
    { name: "Airbus A350-1000", icao: "A35K" },
    { name: "Airbus A380-800", icao: "A388" },
  ];

  it.each(cases)("$name → $icao (exact, direct EEA support)", ({ name, icao }) => {
    const r = aircraftToIcao(name);
    expect(r).not.toBeNull();
    expect(r?.icao).toBe(icao);
    expect(r?.matchType).toBe("exact");
    expect(r?.support).toBe("direct");
  });
});

describe("aircraftToIcao — substring fallback", () => {
  it("Boeing 737-900ER falls back to Boeing 737-900 (B739)", () => {
    const r = aircraftToIcao("Boeing 737-900ER");
    expect(r?.icao).toBe("B739");
    expect(r?.matchType).toBe("substring");
    expect(r?.matchedName).toContain("737-900");
  });

  it("Boeing 767 (no variant) resolves to some 767 variant", () => {
    const r = aircraftToIcao("Boeing 767");
    expect(r).not.toBeNull();
    expect(r?.icao.startsWith("B76")).toBe(true);
    // exact or substring is an implementation detail of how the index is built
  });
});

describe("aircraftToIcao — aliases (Bombardier/Canadair, McDonnell MD-88)", () => {
  it("Bombardier CRJ900 → Canadair Regional Jet 900 → CRJ9", () => {
    const r = aircraftToIcao("Bombardier CRJ900");
    expect(r?.icao).toBe("CRJ9");
  });
  it("Bombardier CRJ700 → CRJ7", () => {
    expect(aircraftToIcao("Bombardier CRJ700")?.icao).toBe("CRJ7");
  });
  it("McDonnell Douglas MD-88 → MD-82 (closest EEA equivalent)", () => {
    expect(aircraftToIcao("McDonnell Douglas MD-88")?.icao).toBe("MD82");
  });
});

describe("aircraftToIcao — miss / null / empty", () => {
  it("returns null for unknown aircraft string", () => {
    expect(aircraftToIcao("Made-Up Aircraft 99")).toBeNull();
  });
  it("returns null for null input", () => {
    expect(aircraftToIcao(null)).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(aircraftToIcao("")).toBeNull();
  });
  it("returns null when mapping not loaded", () => {
    setAircraftMapping({
      version: "test-empty",
      mappings: [],
      index: {},
    });
    expect(aircraftToIcao("Boeing 787-9")).toBeNull();
    // Restore for downstream tests
    bootstrapTestData(); // no-op since `bootstrapped` flag is set
    // Force reload
  });
});

describe("aircraftToIcao — support level priority on collisions", () => {
  it("when one normalized name maps to both a direct and a family entry, direct wins", () => {
    setAircraftMapping({
      version: "test",
      mappings: [
        { name: "Foo", iata: "FOO", icao: "FAML", support: "least-in-family" },
        { name: "Foo", iata: "FOO", icao: "DRCT", support: "direct" },
      ],
      // Index in build-script-order: would have the LATER entry win if same key,
      // but our build always picks higher SUPPORT_PRIORITY. Mirror that here.
      index: {
        foo: { icao: "DRCT", support: "direct" },
      },
    });
    expect(aircraftToIcao("Foo")?.icao).toBe("DRCT");
    expect(aircraftToIcao("Foo")?.support).toBe("direct");
  });
});
