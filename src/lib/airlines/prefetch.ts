import { AVAILABLE_AIRLINE_LOGOS } from "./available.ts";
import { icaoToIata } from "./data.ts";

/**
 * Warm the browser cache for the airline brand logos we're about to render.
 *
 * Called during the crunching animation: by the time the dashboard mounts
 * a few hundred ms later, the ~10-20 unique logos for this user are
 * already fetched (or in flight) and the FlightList <img> requests are
 * cache hits.
 *
 * `<link rel="prefetch" as="image">` is a hint, not a guarantee — the
 * browser may skip prefetches on slow connections. That's fine; the
 * <img> fall-through still works.
 */
export function prefetchAirlineLogos(icaoCodes: Iterable<string | null | undefined>): void {
  if (typeof document === "undefined") return;

  const seen = new Set<string>();
  for (const icao of icaoCodes) {
    const iata =
      icaoToIata(icao) ?? (icao && /^[A-Z0-9]{2}$/i.test(icao) ? icao.toUpperCase() : null);
    if (!iata || seen.has(iata)) continue;
    seen.add(iata);
    if (!AVAILABLE_AIRLINE_LOGOS.has(iata)) continue;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "image";
    link.href = `/airlines/${iata}.svg`;
    document.head.appendChild(link);
  }
}
