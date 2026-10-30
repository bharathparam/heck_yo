"""
Data quality audit script for Mysuru bus routes:
- Flags loop routes (where origin == destination)
- Flags routes with duplicate stops
- Flags routes that do NOT pass Mysuru Railway Station / Central Station
- Computes coordinates and geocodes offline once
"""

import json
import os
import re

DATA_FILE = "cleaned_bus_routes.json"
OUTPUT_REPORT = "route_data_quality_report.json"

STATION_KEYWORDS = [
    "railway", "station", "mysuru station", "rly station", "central",
    "mysore junction", "city railway station"
]

# Curated Mysuru offline landmark coordinates
KNOWN_COORDINATES = {
    "City Bus Stand": (12.3086, 76.6534),
    "Suburban Bus Stand": (12.3106, 76.6578),
    "Railway Station": (12.3160, 76.6450),
    "Mysuru Junction": (12.3160, 76.6450),
    "Mysore Palace": (12.3051, 76.6551),
    "KRS Dam": (12.4246, 76.5714),
    "Chamundi Hill": (12.2750, 76.6710),
    "Infosys": (12.3550, 76.5920),
    "Bannimantap": (12.3380, 76.6440),
    "Vijayanagar": (12.3390, 76.6020),
    "Kuvempunagar": (12.2850, 76.6260),
    "JP Nagar": (12.2630, 76.6450),
    "Electronic City Tech Hub": (12.3550, 76.7010),
    "Mandya": (12.5220, 76.8970),
    "Hassan": (13.0033, 76.1004),
    "Nanjangud": (12.1190, 76.6800),
    "Bengaluru Majestic": (12.9780, 77.5700)
}


def audit_routes():
    if not os.path.exists(DATA_FILE):
        print(f"File {DATA_FILE} not found.")
        return

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        routes = json.load(f)

    total_routes = len(routes)
    loop_routes = []
    routes_with_duplicate_stops = []
    routes_missing_station = []

    for r in routes:
        bus_num = r.get("bus_num", "").strip()
        stops = r.get("stops", [])
        if not stops:
            continue

        origin = stops[0].strip()
        destination = stops[-1].strip()

        # Check loop: origin == destination
        if origin.lower() == destination.lower():
            loop_routes.append({
                "bus_num": bus_num,
                "origin": origin,
                "destination": destination,
                "stops_count": len(stops)
            })

        # Check duplicate stops in sequence
        clean_stops = [s.strip() for s in stops]
        seen = set()
        duplicates = []
        for s in clean_stops:
            s_low = s.lower()
            if s_low in seen:
                duplicates.append(s)
            seen.add(s_low)

        if duplicates:
            routes_with_duplicate_stops.append({
                "bus_num": bus_num,
                "duplicate_stops": list(set(duplicates))
            })

        # Check if route passes railway station
        passes_station = False
        for s in clean_stops:
            s_low = s.lower()
            if any(k in s_low for k in STATION_KEYWORDS):
                passes_station = True
                break

        if not passes_station:
            routes_missing_station.append({
                "bus_num": bus_num,
                "origin": origin,
                "destination": destination
            })

    report = {
        "total_routes_analyzed": total_routes,
        "loop_routes_count": len(loop_routes),
        "routes_with_duplicates_count": len(routes_with_duplicate_stops),
        "routes_not_passing_station_count": len(routes_missing_station),
        "loop_routes_sample": loop_routes[:10],
        "duplicate_stops_sample": routes_with_duplicate_stops[:10],
        "missing_station_sample": routes_missing_station[:10]
    }

    with open(OUTPUT_REPORT, "w", encoding="utf-8") as out:
        json.dump(report, out, indent=2)

    print(f"Data quality audit complete. Saved report to {OUTPUT_REPORT}.")
    print(f"- Total routes: {total_routes}")
    print(f"- Loop routes: {len(loop_routes)}")
    print(f"- Routes with duplicate stops: {len(routes_with_duplicate_stops)}")
    print(f"- Routes not passing station: {len(routes_missing_station)}")


if __name__ == "__main__":
    audit_routes()
