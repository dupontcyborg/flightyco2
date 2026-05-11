import { afterEach, describe, expect, it, vi } from "vitest";
import { airportsLoaded, getAirport, setAirports } from "./data.ts";
import { loadAirports } from "./load.ts";

afterEach(() => {
  vi.restoreAllMocks();
  // Clear the store between tests
  setAirports({});
});

describe("loadAirports", () => {
  it("fetches the URL and installs the table into the store", async () => {
    const mockTable = {
      JFK: [40.6398, -73.7789, "KJFK", "US"] as [number, number, string, string],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockTable }));

    await loadAirports("/airports.json");
    expect(airportsLoaded()).toBe(true);
    expect(getAirport("JFK")?.iata).toBe("JFK");
    expect(getAirport("JFK")?.country).toBe("US");
  });

  it("throws when fetch returns non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );
    await expect(loadAirports("/missing.json")).rejects.toThrow(/404/);
  });
});
