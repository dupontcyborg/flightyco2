import { afterEach, describe, expect, it, vi } from "vitest";
import { gaiaLoaded, lookupGaia, setGaiaAirports, setGaiaCountries } from "./data.ts";
import { loadGaia } from "./load.ts";

afterEach(() => {
  vi.restoreAllMocks();
  setGaiaAirports({});
  setGaiaCountries({});
});

describe("loadGaia", () => {
  it("fetches both URLs in parallel and installs both tables", async () => {
    const airports = { "KAAA-KBBB": [1.1, 1.2] };
    const countries = { "US-GB": [1.03, 1.05] };
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("airports"))
        return Promise.resolve({ ok: true, json: async () => airports });
      return Promise.resolve({ ok: true, json: async () => countries });
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadGaia("/gaia-airports.json", "/gaia-countries.json");
    expect(gaiaLoaded()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const r = lookupGaia("KAAA", "KBBB", "US", "GB");
    expect(r.tier).toBe("airport-pair");
    expect(r.distanceRatio).toBe(1.1);
  });

  it("throws when either URL returns non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }),
    );
    await expect(loadGaia()).rejects.toThrow(/500/);
  });
});
