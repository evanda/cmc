#!/usr/bin/env python3
"""Normalize a raw geojson.io building export into map-data/buildings.geojson.

geojson.io (and some editors) drop pasted keys at the Feature top level instead
of inside `properties`. This lifts kind/code/name/description/levels back into
`properties`, drops editor cruft (@id), and adds a `label_lnglat` name anchor.

Usage:  python3 authoring/import_buildings.py <raw_export.geojson>
"""
import json, os, sys

MD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # map-data/
FACILITY = os.environ.get("FACILITY", "midwaypca")
FDIR = os.path.join(MD, "facilities", FACILITY)
KEYS = ("kind", "code", "name", "description", "levels")

def main(src):
    raw = json.load(open(src))
    out = []
    for f in raw["features"]:
        if f.get("geometry", {}).get("type") != "Polygon":
            continue
        props = dict(f.get("properties") or {})
        props.pop("@id", None)
        for k in KEYS:                       # lift top-level keys into properties
            if k in f:
                props[k] = f[k]
        props.setdefault("kind", "building")
        ring = f["geometry"]["coordinates"][0]
        xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
        props["label_lnglat"] = [round((min(xs) + max(xs)) / 2, 7),
                                 round(max(ys) + (max(ys) - min(ys)) * 0.18, 7)]
        out.append({"type": "Feature", "properties": props, "geometry": f["geometry"]})
    os.makedirs(FDIR, exist_ok=True)
    dst = os.path.join(FDIR, "buildings.geojson")
    json.dump({"type": "FeatureCollection", "features": out}, open(dst, "w"), indent=2)
    print(f"wrote {dst}: {len(out)} buildings —",
          ", ".join(p['properties'].get('code', '?') for p in out))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: import_buildings.py <raw_export.geojson>")
    main(sys.argv[1])
