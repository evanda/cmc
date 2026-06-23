import json, csv, os
MD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(MD, "authoring")
FACILITY = os.environ.get("FACILITY", "midwaypca")
FDIR = os.path.join(MD, "facilities", FACILITY)
pois = json.load(open(os.path.join(FDIR, "pois.geojson")))["features"]

# Flat CSV checklist of every POI (the HVAC units imported from the slides, plus
# any hand-added features) — a handy reference while placing them in geojson.io.
cols = ["id", "label", "kind", "poi_type", "building_code", "building",
        "level", "level_name", "linked_asset_id", "notes", "lng", "lat"]
out = os.path.join(A, f"pois-{FACILITY}.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(cols)
    for ft in pois:
        p = ft["properties"]; lng, lat = ft["geometry"]["coordinates"]
        w.writerow([p.get("id"), p.get("label"), p.get("kind"), p.get("poi_type"),
                    p.get("building_code"), p.get("building"), p.get("level"),
                    p.get("level_name"), p.get("linked_asset_id") or "",
                    p.get("notes"), lng, lat])
print(f"wrote {out} rows: {len(pois)}")
