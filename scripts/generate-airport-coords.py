#!/usr/bin/env python3
"""
Generate airport-coords.ts from OurAirports data.

Downloads the latest airport data and creates a TypeScript file with
coordinates for airports that have IATA codes.

Usage:
    python generate_airport_coords.py
    python generate_airport_coords.py --types large_airport medium_airport
    python generate_airport_coords.py --min-type medium  # medium and larger
    python generate_airport_coords.py --all  # include small airports

Data source: https://ourairports.com/data/ (public domain)
"""

import argparse
import csv
import io
import json
from pathlib import Path
from urllib.request import urlopen

OURAIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "lib" / "airports" / "coords.ts"

# Airport types in order of size
AIRPORT_TYPES = ["large_airport", "medium_airport", "small_airport", "heliport", "seaplane_base", "closed"]

TYPE_HIERARCHY = {
    "large": ["large_airport"],
    "medium": ["large_airport", "medium_airport"],
    "small": ["large_airport", "medium_airport", "small_airport"],
    "all": AIRPORT_TYPES,
}


def download_airports() -> list[dict]:
    """Download airport data from OurAirports."""
    print(f"Downloading airport data from {OURAIRPORTS_URL}...")

    with urlopen(OURAIRPORTS_URL) as response:
        content = response.read().decode('utf-8')

    reader = csv.DictReader(io.StringIO(content))
    airports = list(reader)
    print(f"Downloaded {len(airports):,} airports")
    return airports


def filter_airports(airports: list[dict], types: list[str]) -> list[dict]:
    """Filter airports by type and IATA code availability."""
    filtered = []

    for airport in airports:
        # Must have IATA code
        iata = airport.get("iata_code", "").strip()
        if not iata or len(iata) != 3:
            continue

        # Must be correct type
        airport_type = airport.get("type", "")
        if airport_type not in types:
            continue

        # Must have valid coordinates
        try:
            lat = float(airport.get("latitude_deg", ""))
            lon = float(airport.get("longitude_deg", ""))
        except (ValueError, TypeError):
            continue

        filtered.append({
            "iata": iata.upper(),
            "name": airport.get("name", ""),
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "type": airport_type,
            "country": airport.get("iso_country", ""),
        })

    return filtered


def generate_typescript(airports: list[dict]) -> str:
    """Generate TypeScript file content with inline JSON for fast parsing."""
    # Build compact data structure: IATA -> [lat, lon]
    data = {}
    for airport in sorted(airports, key=lambda x: x["iata"]):
        data[airport["iata"]] = [airport["lat"], airport["lon"]]

    # Generate compact JSON string
    json_str = json.dumps(data, separators=(',', ':'))

    lines = [
        "/**",
        " * Airport Coordinates Database",
        " *",
        " * Contains coordinates for airports with IATA codes.",
        " * Used for great-circle distance calculation in flight emissions.",
        " *",
        " * Source: OurAirports (https://ourairports.com/data/) - public domain",
        f" * Generated: {len(airports)} airports",
        " *",
        " * To regenerate: python scripts/generate-airport-coords.py",
        " */",
        "",
        "export interface AirportCoord {",
        "    lat: number;",
        "    lon: number;",
        "}",
        "",
        "// Inline JSON for fast parsing (~34% faster cold start than object literal)",
        "// prettier-ignore",
        "// eslint-disable-next-line max-len",
        f"const AIRPORT_JSON = '{json_str}';",
        "",
        "let _parsed: Record<string, [number, number]> | null = null;",
        "",
        "function getData(): Record<string, [number, number]> {",
        "    if (_parsed === null) {",
        "        _parsed = JSON.parse(AIRPORT_JSON);",
        "    }",
        "    return _parsed!;",
        "}",
        "",
        "/**",
        " * Get airport coordinates by IATA code",
        " */",
        "export function getAirportCoords(iataCode: string): AirportCoord | null {",
        "    const coords = getData()[iataCode?.toUpperCase()];",
        "    if (!coords) return null;",
        "    return { lat: coords[0], lon: coords[1] };",
        "}",
        "",
        "/**",
        " * Check if airport exists in database",
        " */",
        "export function hasAirport(iataCode: string): boolean {",
        "    return iataCode?.toUpperCase() in getData();",
        "}",
        "",
        "/**",
        " * Get count of airports in database",
        " */",
        "export function getAirportCount(): number {",
        "    return Object.keys(getData()).length;",
        "}",
        "",
    ]

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Generate airport coordinates TypeScript file from OurAirports data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--types",
        nargs="+",
        choices=AIRPORT_TYPES,
        help="Airport types to include (default: large_airport medium_airport)",
    )
    parser.add_argument(
        "--min-type",
        choices=["large", "medium", "small", "all"],
        default="medium",
        help="Minimum airport type to include (default: medium = large + medium)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Include all airports with IATA codes (same as --min-type all)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_PATH,
        help=f"Output file path (default: {OUTPUT_PATH})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print stats without writing file",
    )

    args = parser.parse_args()

    # Determine which types to include
    if args.types:
        types = args.types
    elif args.all:
        types = TYPE_HIERARCHY["all"]
    else:
        types = TYPE_HIERARCHY[args.min_type]

    print(f"Including airport types: {', '.join(types)}")

    # Download and filter
    airports = download_airports()
    filtered = filter_airports(airports, types)

    print(f"\nFiltered to {len(filtered):,} airports with IATA codes")

    # Stats by type
    type_counts = {}
    for airport in filtered:
        t = airport["type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    print("\nBy type:")
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {count:,}")

    # Stats by region
    region_counts = {}
    for airport in filtered:
        # Use first 2 chars of country
        region = airport["country"][:2] if airport["country"] else "??"
        region_counts[region] = region_counts.get(region, 0) + 1

    print(f"\nTop 10 countries:")
    for region, count in sorted(region_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {region}: {count:,}")

    if args.dry_run:
        print("\n[Dry run - not writing file]")
        return

    # Generate and write
    content = generate_typescript(filtered)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content)

    size_kb = len(content) / 1024
    print(f"\nWrote {args.output}")
    print(f"File size: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
