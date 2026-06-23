#!/usr/bin/env python3
"""Re-home the slide-derived HVAC POIs into the CURRENT (real) building
footprints, and regenerate floors.json. Run after buildings.geojson changes.

Reuses the slide POI data + notes from gen_map.py (P, kind), but places points
inside each real footprint's bbox in lng/lat — so the POIs follow wherever you
trace the buildings. Positions are a tidy per-floor grid (nudge to exact spots
later in the loader / geojson.io).

Usage (from map-data/):  python3 gen_pois.py
"""
import json, math, os
import gen_map as G  # safe: gen_map only writes files under __main__

MD = os.path.dirname(os.path.abspath(__file__))
FACILITY = os.environ.get("FACILITY", "midwaypca")
FDIR = os.path.join(MD, "facilities", FACILITY)
buildings = json.load(open(os.path.join(FDIR, "buildings.geojson")))["features"]

ring_by_code = {f["properties"]["code"]: f["geometry"]["coordinates"][0] for f in buildings}
name_by_code = {f["properties"]["code"]: f["properties"]["name"] for f in buildings}
# level -> display name, per building, from the slide definitions in gen_map
level_name = {(b["code"], l["level"]): l["name"] for b in G.buildings for l in b["levels"]}

def bbox(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)

def grid(ring, n, frac=0.20):
    """n points in a grid inside the footprint bbox (inset by a fraction)."""
    x0, y0, x1, y1 = bbox(ring)
    ix, iy = (x1 - x0) * frac, (y1 - y0) * frac
    x0 += ix; x1 -= ix; y0 += iy; y1 -= iy
    cols = math.ceil(math.sqrt(n)); rows = math.ceil(n / cols)
    out = []
    for i in range(n):
        r, c = divmod(i, cols)
        gx = x0 if cols == 1 else x0 + (x1 - x0) * c / (cols - 1)
        gy = y1 if rows == 1 else y1 - (y1 - y0) * r / (rows - 1)
        out.append([round(gx, 7), round(gy, 7)])
    return out

# Preserve any manually-added, non-HVAC features (shutoffs, fountains, …) so
# regenerating the slide-derived HVAC set doesn't wipe hand-placed features.
pois_path = os.path.join(FDIR, "pois.geojson")
kept = []
if os.path.exists(pois_path):
    for f in json.load(open(pois_path))["features"]:
        if f.get("properties", {}).get("poi_type") != "hvac":
            kept.append(f)

poi_features = []
pid = 1
for (code, level), units in G.P.items():
    if code not in ring_by_code:
        print(f"! no footprint for building {code} — skipping its POIs"); continue
    pts = grid(ring_by_code[code], len(units))
    for (label, notes), pt in zip(units, pts):
        poi_features.append({
            "type": "Feature",
            "properties": {
                "id": f"poi-{pid:03d}", "poi_type": "hvac", "kind": G.kind(label),
                "label": label, "building": name_by_code[code], "building_code": code,
                "level": level, "level_name": level_name[(code, level)],
                "linked_asset_id": None, "icon": "hvac", "notes": notes,
            },
            "geometry": {"type": "Point", "coordinates": pt},
        })
        pid += 1

floors = []
for f in buildings:
    code = f["properties"]["code"]
    x0, y0, x1, y1 = bbox(f["geometry"]["coordinates"][0])
    quad = {"type": "Polygon", "coordinates": [[
        [x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]}
    for lvl in f["properties"]["levels"]:
        floors.append({
            "building_code": code, "building": f["properties"]["name"],
            "name": level_name.get((code, lvl), str(lvl)), "level": lvl,
            "floorplan_image_url": None, "geo_corners_geojson": quad, "rotation_deg": 0,
        })

all_pois = poi_features + kept   # generated HVAC + preserved manual features
json.dump({"type": "FeatureCollection", "features": all_pois},
          open(pois_path, "w"), indent=2)
json.dump(floors, open(os.path.join(FDIR, "floors.json"), "w"), indent=2)
print(f"wrote pois.geojson ({len(poi_features)} HVAC + {len(kept)} kept) "
      f"+ floors.json ({len(floors)} floors) for facility '{FACILITY}'")
