import json, csv, os
MD = "/home/user/cmc/map-data"
A = os.path.join(MD, "authoring")
pois = json.load(open(os.path.join(MD, "pois.geojson")))["features"]

# Flat CSV checklist of every HVAC unit imported from the slides.
cols = ["id","label","kind","poi_type","building_code","building",
        "level","level_name","linked_asset_id","notes","lng","lat"]
with open(os.path.join(A, "pois.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(cols)
    for ft in pois:
        p = ft["properties"]; lng, lat = ft["geometry"]["coordinates"]
        w.writerow([p["id"], p["label"], p["kind"], p["poi_type"],
                    p["building_code"], p["building"], p["level"], p["level_name"],
                    p.get("linked_asset_id") or "", p["notes"], lng, lat])
print("wrote authoring/pois.csv rows:", len(pois))
