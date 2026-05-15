import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// load.ts and its child loaders keep module-level promise caches. Reset
// the module graph between tests so each test gets a fresh `cached` /
// `inflight` and exercises real fetch behavior.
async function freshLoadModule() {
  vi.resetModules();
  return await import("./load.ts");
}

afterEach(() => vi.restoreAllMocks());
beforeEach(() => vi.resetModules());

function mockAll(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const json = (data: unknown) => Promise.resolve({ ok: true, json: async () => data });
      // Match by basename, allowing for content-hashed URLs like
      // /airports.abcd1234.json. Check more-specific names first.
      if (url.includes("gaia-airports")) return json({});
      if (url.includes("gaia-countries")) return json({});
      if (url.includes("/airports.")) return json({ JFK: [40.6398, -73.7789, "KJFK", "US"] });
      if (url.includes("/airlines.")) return json({});
      if (url.includes("aircraft-mapping"))
        return json({
          version: "test",
          mappings: [],
          index: { boeing: { icao: "BOEI", support: "direct" } },
        });
      if (url.includes("eea-fuel-burn")) return json({ version: "test", aircraft: {} });
      if (url.includes("seat-configs"))
        return json({
          version: "test",
          default: { body: "narrow", F: 0, J: 0, W: 0, Y: 1, total: 1 },
          configs: {},
        });
      throw new Error(`unexpected URL: ${url}`);
    }),
  );
}

describe("loadAllReferenceData", () => {
  it("loads every source and marks every store as loaded", async () => {
    mockAll();
    const { loadAllReferenceData } = await freshLoadModule();
    const { airportsLoaded } = await import("./airports/data.ts");
    const { aircraftMappingLoaded } = await import("./aircraft/data.ts");
    const { fuelBurnLoaded } = await import("./aircraft/fuel-burn.ts");
    const { seatConfigsLoaded } = await import("./aircraft/seat-config.ts");
    const { gaiaLoaded } = await import("./gaia/data.ts");

    await loadAllReferenceData();
    expect(airportsLoaded()).toBe(true);
    expect(aircraftMappingLoaded()).toBe(true);
    expect(fuelBurnLoaded()).toBe(true);
    expect(seatConfigsLoaded()).toBe(true);
    expect(gaiaLoaded()).toBe(true);
  });

  it("caches the result — second call does not re-fetch", async () => {
    mockAll();
    const { loadAllReferenceData } = await freshLoadModule();
    await loadAllReferenceData();
    const after1 = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(after1).toBeGreaterThan(0);
    await loadAllReferenceData();
    const after2 = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(after2).toBe(after1);
  });

  it("propagates errors when any source fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }),
    );
    const { loadAllReferenceData } = await freshLoadModule();
    await expect(loadAllReferenceData()).rejects.toThrow(/500/);
  });
});
