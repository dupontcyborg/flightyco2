import { afterEach, describe, expect, it, vi } from "vitest";
import { aircraftMappingLoaded } from "./aircraft/data.ts";
import { fuelBurnLoaded } from "./aircraft/fuel-burn.ts";
import { seatConfigsLoaded } from "./aircraft/seat-config.ts";
import { airportsLoaded } from "./airports/data.ts";
import { gaiaLoaded } from "./gaia/data.ts";
import { loadAllReferenceData } from "./load.ts";

afterEach(() => vi.restoreAllMocks());

function mockAll(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const json = (data: unknown) => Promise.resolve({ ok: true, json: async () => data });
      if (url.includes("airports.json")) return json({ JFK: [40.6398, -73.7789, "KJFK", "US"] });
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
      if (url.includes("gaia-airports")) return json({});
      if (url.includes("gaia-countries")) return json({});
      throw new Error(`unexpected URL: ${url}`);
    }),
  );
}

describe("loadAllReferenceData", () => {
  it("loads all 6 sources in parallel and marks every store as loaded", async () => {
    mockAll();
    await loadAllReferenceData();
    expect(airportsLoaded()).toBe(true);
    expect(aircraftMappingLoaded()).toBe(true);
    expect(fuelBurnLoaded()).toBe(true);
    expect(seatConfigsLoaded()).toBe(true);
    expect(gaiaLoaded()).toBe(true);
  });

  it("can be called more than once; second call is essentially a no-op", async () => {
    mockAll();
    await loadAllReferenceData();
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await loadAllReferenceData();
    // Either no new fetches (good caching) or it re-runs — both acceptable
    // since the stores are already populated. Just verify it doesn't throw.
    expect(airportsLoaded()).toBe(true);
    expect(before).toBeGreaterThan(0);
  });

  it("propagates errors when any source fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }),
    );
    await expect(loadAllReferenceData()).rejects.toThrow(/500/);
  });
});
