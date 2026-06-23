#!/usr/bin/env python3
"""Download the satellite basemap tiles covering a facility's campus ONCE into
the repo, so the viewer serves them locally instead of re-fetching every load.

It reads the facility's building bbox, downloads Esri World Imagery XYZ tiles for
the zoom range into facilities/<id>/tiles/{z}/{x}/{y}.jpg, and points
meta.json at them (basemap_tiles). The campus area never changes, so this is a
one-time cache.

  python3 authoring/fetch_basemap.py [facility] [--min 16] [--max 19] [--pad 0.0008]

Run it on a machine with internet (the imagery host must be reachable).

⚠️  Licensing: Esri World Imagery is meant to be displayed live with attribution;
caching tiles may exceed its terms for anything beyond local/offline convenience.
For a basemap you truly own and check in, the plan's path (§10) is to tile your
OWN georeferenced aerial photo to PMTiles — license-clean and a single file.
"""
import argparse, json, math, os, time, urllib.request

MD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

def deg2tile(lng, lat, z):
    n = 2 ** z
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y

def bbox_of(facility):
    fc = json.load(open(os.path.join(MD, "facilities", facility, "buildings.geojson")))
    xs, ys = [], []
    for f in fc["features"]:
        for ring in f["geometry"]["coordinates"]:
            for lng, lat in ring:
                xs.append(lng); ys.append(lat)
    return min(xs), min(ys), max(xs), max(ys)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("facility", nargs="?", default="midwaypca")
    ap.add_argument("--min", type=int, default=16)
    ap.add_argument("--max", type=int, default=19)
    ap.add_argument("--pad", type=float, default=0.0008, help="bbox padding in degrees")
    a = ap.parse_args()

    fdir = os.path.join(MD, "facilities", a.facility)
    minx, miny, maxx, maxy = bbox_of(a.facility)
    minx -= a.pad; miny -= a.pad; maxx += a.pad; maxy += a.pad
    total = 0
    for z in range(a.min, a.max + 1):
        x0, y1 = deg2tile(minx, miny, z)   # note: y inverted (lat↓ => y↑)
        x1, y0 = deg2tile(maxx, maxy, z)
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                dst = os.path.join(fdir, "tiles", str(z), str(x), f"{y}.jpg")
                if os.path.exists(dst):
                    continue
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                url = ESRI.format(z=z, x=x, y=y)
                req = urllib.request.Request(url, headers={"User-Agent": "cmc-basemap-cache"})
                with urllib.request.urlopen(req, timeout=20) as r, open(dst, "wb") as fh:
                    fh.write(r.read())
                total += 1
                time.sleep(0.05)
        print(f"  z{z}: done")
    print(f"downloaded {total} new tiles into {fdir}/tiles/")

    # point the facility at the local cache
    meta_path = os.path.join(fdir, "meta.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    meta["basemap_tiles"] = "tiles/{z}/{x}/{y}.jpg"
    meta["basemap_minzoom"] = a.min
    meta["basemap_maxzoom"] = a.max
    meta["basemap_attribution"] = "Imagery © Esri, Maxar, Earthstar Geographics"
    json.dump(meta, open(meta_path, "w"), indent=2)
    print(f"updated {meta_path}: basemap_tiles -> tiles/{{z}}/{{x}}/{{y}}.jpg")

if __name__ == "__main__":
    main()
