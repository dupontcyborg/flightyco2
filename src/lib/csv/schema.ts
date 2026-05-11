import { z } from "zod";

export const CABIN_CLASSES = ["economy", "premium-economy", "business", "first"] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

const cabinClassMap: Record<string, CabinClass> = {
  economy: "economy",
  coach: "economy",
  "premium economy": "premium-economy",
  business: "business",
  first: "first",
};

export function normalizeCabinClass(raw: string | null): CabinClass | null {
  if (!raw) return null;
  // Lowercase, trim, collapse any run of underscore/dash/whitespace into a single space.
  const key = raw
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, " ");
  return cabinClassMap[key] ?? null;
}

const trimmedString = z
  .string()
  .transform((s) => s.trim())
  .transform((s) => (s.length === 0 ? null : s));

export const FlightyRowSchema = z
  .object({
    Date: z.string(),
    Airline: trimmedString.nullable(),
    Flight: trimmedString.nullable(),
    From: z.string().length(3),
    To: z.string().length(3),
    Canceled: z.string().transform((v) => v.toLowerCase() === "true"),
    "Diverted To": trimmedString.nullable(),
    "Aircraft Type Name": trimmedString.nullable(),
    "Cabin Class": trimmedString.nullable(),
    "Gate Departure (Scheduled)": trimmedString.nullable(),
    "Flight Flighty ID": z.string(),
    "Departure Airport Flighty ID": trimmedString.nullable(),
    "Arrival Airport Flighty ID": trimmedString.nullable(),
    "Aircraft Type Flighty ID": trimmedString.nullable(),
  })
  .passthrough();

export type FlightyRow = z.infer<typeof FlightyRowSchema>;

export type DataQuality = "high" | "medium" | "low";

export interface ParsedFlight {
  id: string;
  date: string;
  from: string;
  /** Scheduled destination. */
  to: string;
  divertedTo: string | null;
  /**
   * The airport the flight actually arrived at — `divertedTo ?? to`.
   * Distance and emissions calculations should use this; `to` is preserved
   * for reporting the originally scheduled destination.
   */
  actualTo: string;
  cancelled: boolean;
  airline: string | null;
  flightNumber: string | null;
  aircraft: string | null;
  aircraftId: string | null;
  cabinClass: CabinClass | null;
  scheduledDeparture: string | null;
  quality: DataQuality;
}

export function classifyQuality(row: FlightyRow): DataQuality {
  const hasAircraft = row["Aircraft Type Name"] !== null;
  const hasCabin = row["Cabin Class"] !== null;
  if (hasAircraft && hasCabin) return "high";
  if (hasAircraft || hasCabin) return "medium";
  return "low";
}

export function toParsedFlight(row: FlightyRow): ParsedFlight {
  const divertedTo = row["Diverted To"];
  return {
    id: row["Flight Flighty ID"],
    date: row.Date,
    from: row.From,
    to: row.To,
    divertedTo,
    actualTo: divertedTo ?? row.To,
    cancelled: row.Canceled,
    airline: row.Airline,
    flightNumber: row.Flight,
    aircraft: row["Aircraft Type Name"],
    aircraftId: row["Aircraft Type Flighty ID"],
    cabinClass: normalizeCabinClass(row["Cabin Class"]),
    scheduledDeparture: row["Gate Departure (Scheduled)"],
    quality: classifyQuality(row),
  };
}
