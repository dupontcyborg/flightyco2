import { afterEach, describe, expect, it, vi } from "vitest";
import { aircraftToIcao, setAircraftMapping } from "./data.ts";
import { setFuelBurn } from "./fuel-burn.ts";
import { loadAircraftData, loadAircraftMapping, loadFuelBurn, loadSeatConfigs } from "./load.ts";
import { setSeatConfigs } from "./seat-config.ts";

afterEach(() => {
  vi.restoreAllMocks();
  setAircraftMapping({ version: "test", mappings: [], index: {} });
  setFuelBurn({ version: "test", aircraft: {} });
  setSeatConfigs({
    version: "test",
    default: { body: "narrow", F: 0, J: 0, W: 0, Y: 1, total: 1 },
    configs: {},
  });
});

describe("loadAircraftMapping", () => {
  it("installs the fetched table into the aircraft store", async () => {
    const payload = {
      version: "TIM-test",
      mappings: [{ name: "Foo", iata: "FOO", icao: "FOOO", support: "direct" as const }],
      index: { foo: { icao: "FOOO", support: "direct" as const } },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    await loadAircraftMapping("/aircraft-mapping.json");
    expect(aircraftToIcao("Foo")?.icao).toBe("FOOO");
  });

  it("propagates fetch errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" }),
    );
    await expect(loadFuelBurn("/eea.json")).rejects.toThrow(/403/);
  });
});

describe("loadAircraftData (parallel orchestrator)", () => {
  it("loads mapping + fuel-burn + seat-configs in one go", async () => {
    const mapping = {
      version: "test",
      mappings: [],
      index: { foo: { icao: "FOOO", support: "direct" as const } },
    };
    const fuel = { version: "test", aircraft: { FOOO: { lto_kg: 100, lto2_kg: null, ccd: [] } } };
    const seats = {
      version: "test",
      default: { body: "narrow" as const, F: 0, J: 0, W: 0, Y: 1, total: 1 },
      configs: {},
    };
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("aircraft-mapping"))
        return Promise.resolve({ ok: true, json: async () => mapping });
      if (url.includes("eea-fuel-burn"))
        return Promise.resolve({ ok: true, json: async () => fuel });
      if (url.includes("seat-configs"))
        return Promise.resolve({ ok: true, json: async () => seats });
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadAircraftData();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(aircraftToIcao("foo")?.icao).toBe("FOOO");
  });

  it("loadSeatConfigs propagates fetch errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }),
    );
    await expect(loadSeatConfigs("/seat-configs.json")).rejects.toThrow(/500/);
  });
});
