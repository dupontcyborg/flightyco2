import { setGaiaAirports, setGaiaCountries } from "./data.ts";

const DEFAULT_AIRPORTS_URL = "/gaia-airports.json";
const DEFAULT_COUNTRIES_URL = "/gaia-countries.json";

let inflight: Promise<void> | null = null;

export function loadGaia(
  airportsUrl: string = DEFAULT_AIRPORTS_URL,
  countriesUrl: string = DEFAULT_COUNTRIES_URL,
): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [airports, countries] = await Promise.all([
        fetch(airportsUrl).then((r) => {
          if (!r.ok) throw new Error(`loadGaia: ${airportsUrl} returned ${r.status}`);
          return r.json() as Promise<Record<string, [number, number]>>;
        }),
        fetch(countriesUrl).then((r) => {
          if (!r.ok) throw new Error(`loadGaia: ${countriesUrl} returned ${r.status}`);
          return r.json() as Promise<Record<string, [number, number]>>;
        }),
      ]);
      setGaiaAirports(airports);
      setGaiaCountries(countries);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
