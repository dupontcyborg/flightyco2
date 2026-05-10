import { getAirportCoords } from "./coords.ts";

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface RouteDistance {
  km: number;
  from: { iata: string; lat: number; lon: number };
  to: { iata: string; lat: number; lon: number };
}

export function routeDistanceKm(fromIata: string, toIata: string): RouteDistance | null {
  const from = getAirportCoords(fromIata);
  const to = getAirportCoords(toIata);
  if (!from || !to) return null;
  return {
    km: haversineKm(from.lat, from.lon, to.lat, to.lon),
    from: { iata: fromIata.toUpperCase(), ...from },
    to: { iata: toIata.toUpperCase(), ...to },
  };
}
