import csv
import json
import os

raw_csv_path = 'raw_bus_routes.csv'
cleaned_json_path = 'cleaned_bus_routes.json'

clean_rows = []
with open(raw_csv_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    line = line.strip()
    if not line or line.startswith('<truncated') or line.startswith('NOTE:'):
        continue
    if line.startswith('bus_num,route'):
        continue

    # Fix the trailing truncated line if needed
    if '""Maragowdanahall' in line and not line.endswith('"]"'):
        line = line.rstrip('"') + 'i""]"'

    try:
        reader = csv.reader([line])
        r = next(reader)
        if len(r) >= 2:
            bus_num = r[0].strip()
            raw_json = r[1].strip()
            if raw_json == '[]':
                stops = []
            else:
                stops = json.loads(raw_json)
            clean_rows.append({'bus_num': bus_num, 'stops': stops})
    except Exception as e:
        print(f"Row {idx} skipped: {e}")

print(f"Total valid routes parsed: {len(clean_rows)}")

with open(cleaned_json_path, 'w', encoding='utf-8') as out:
    json.dump(clean_rows, out, indent=2)

print(f"Saved {cleaned_json_path} with {len(clean_rows)} routes.")
