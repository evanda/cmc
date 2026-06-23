#!/usr/bin/env python3
"""Generate MapLibre-ready map data for the church campus from the HVAC slides
+ satellite shape. Output: building footprints (GeoJSON), POIs (GeoJSON),
floor/level records (JSON). Coordinates are a self-consistent PLACEHOLDER local
layout anchored at an arbitrary lat/lng — to be georeferenced for real in the
loader tool (plan §10). Schematic, not survey-accurate."""

import json, math, os

# Placeholder generator (legacy). Writes to a throwaway facility dir so it can
# never clobber a real, traced facility. The live data is per-facility under
# facilities/<id>/ — see gen_pois.py + authoring/import_buildings.py.
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "facilities", "_placeholder")
os.makedirs(OUT, exist_ok=True)

# Arbitrary placeholder anchor (round numbers => obviously not real coords).
LAT0, LNG0 = 35.000000, -80.000000
M_PER_DEG_LAT = 110900.0
M_PER_DEG_LNG = 111320.0 * math.cos(math.radians(LAT0))

def ll(x, y):
    """local meters (x=east, y=north) -> [lng, lat]."""
    return [round(LNG0 + x / M_PER_DEG_LNG, 7),
            round(LAT0 + y / M_PER_DEG_LAT, 7)]

def ring(pts):
    coords = [ll(x, y) for (x, y) in pts]
    coords.append(coords[0])
    return [coords]

# ── Buildings (footprints in local meters, matching satellite arrangement) ────
# 09 = 2009 church (L-shaped, gabled sanctuary). Fellowship Hall bridges toward
# the 1987 school (87). Gym / middle school sits separately to the WEST (left,
# north up) — see MIRROR_X below.
buildings = [
    {"code": "09", "name": "2009 Building (Church)",
     "description": "Sanctuary, narthex/front lobby, nurseries & children's ministry, choir/music offices.",
     "levels": [{"name": "Basement", "level": -1},
                {"name": "Main", "level": 1},
                {"name": "Upper", "level": 2}],
     "footprint": [(-82,-25),(-46,-25),(-46,6),(-28,6),(-28,40),(-82,40)],
     "label": (-55, 44)},
    {"code": "FH", "name": "Fellowship Hall",
     "description": "Fellowship hall, pastors' offices, Explorers/Harvesters/Light classrooms.",
     "levels": [{"name": "Main", "level": 1}],
     "footprint": [(-46,-52),(-2,-52),(-2,-28),(-46,-28)],
     "label": (-24, -57)},
    {"code": "87", "name": "1987 Building (School)",
     "description": "Kitchen/cafeteria, library, computer lab, 1987 sanctuary, K–5th grade classrooms.",
     "levels": [{"name": "Lower", "level": -1},
                {"name": "Main", "level": 1}],
     "footprint": [(2,-58),(48,-58),(48,-8),(2,-8)],
     "label": (25, -3)},
    {"code": "GYM", "name": "Gym / Middle School",
     "description": "Middle-school gym, locker rooms, concession stand, classrooms, Colloquium room.",
     "levels": [{"name": "Main", "level": 1}],
     "footprint": [(64,-30),(116,-30),(116,22),(64,22)],
     "label": (90, 26)},
]

# Mirror the whole campus left↔right (north stays up) so the gym reads as WEST.
# Reflect about the campus x-midpoint so the overall bounds are preserved.
MIRROR_X = True
_MID_X = 17.0  # midpoint of the campus x-extent (-82 … 116)
def _mx(x):
    return 2 * _MID_X - x if MIRROR_X else x
for _b in buildings:
    _b["footprint"] = [(_mx(x), y) for (x, y) in _b["footprint"]][::-1]  # keep ring orientation
    _b["label"] = (_mx(_b["label"][0]), _b["label"][1])

def bbox(fp):
    xs = [p[0] for p in fp]; ys = [p[1] for p in fp]
    return min(xs), min(ys), max(xs), max(ys)

# ── POIs: every HVAC unit from the slides, by building + level ────────────────
# (label, notes). poi_type = "hvac"; kind derived from the unit-name prefix.
P = {
    ("09", -1): [
        ("AC16A", "Sanctuary control (basement). In big white fencing outside the emergency-exit stairwell behind the 2009 pulpit."),
        ("AC16B", "Sanctuary control (basement). In big white fencing outside the emergency-exit stairwell behind the 2009 pulpit."),
        ("HP9",   "Narthex / front-lobby control. Basement: nursery playground, unit closest to the nursery entry."),
        ("HP11",  "Narthex / front-lobby control. Basement: nursery playground, unit closest to the nursery entry."),
        ("HP5",   "Children's ministry room & hallway control. Basement: nursery playground, unit closest to the main-level lobby entry."),
        ("AC5",   "Children's ministry room & hallway control. Basement: mechanical room, end of hall near the concession-style kitchen."),
    ],
    ("09", 1): [
        ("AC1",  "Special-needs nursery 1 control. Main level: catwalk behind the 2009 sanctuary pulpit."),
        ("AC2",  "Infant nursery 2 control. Main level: catwalk behind the 2009 sanctuary pulpit."),
        ("AC3",  "Children nursery 3 control. Main level: catwalk behind the 2009 sanctuary pulpit."),
        ("AC4",  "Youth ministry room 4 control. Main level: catwalk behind the 2009 sanctuary pulpit."),
        ("AC15", "Long hallway connecting church with school. Main level: in ceiling in front of the men's restroom by the 2009 sanctuary."),
        ("HP15", "Long hallway connecting church with school. Main level: outside the southern lobby entrance toward the nursery entrance."),
    ],
    ("09", 2): [
        ("HP12", "Choir practice room & music-ministry offices control. Upper level: roof access off the stairwell by the elevator."),
        ("HP13", "Choir practice room & music-ministry offices control. Upper level: roof access off the stairwell by the elevator."),
        ("AC12", "Choir practice room & music-ministry offices. Upper level: above the men's robing room (ladder entry)."),
        ("AC13", "Choir practice room & music-ministry offices. Upper level: above the men's robing room (ladder entry)."),
        ("AC9",  "Narthex / front-lobby control. Upper level: above the women's robing room in the choir practice room (ladder entry)."),
        ("AC11", "Narthex / front-lobby control. Upper level: above the women's robing room in the choir practice room (ladder entry)."),
        ("AH16A","Sanctuary air handler. Upper level: behind mechanical-room doors on the balcony, either side of the 2009 pulpit."),
        ("AH16B","Sanctuary air handler. Upper level: behind mechanical-room doors on the balcony, either side of the 2009 pulpit."),
    ],
    ("FH", 1): [
        ("HP7",   "Fellowship-hall classrooms. Main level: outside, next to the head pastor's office."),
        ("HP8",   "Fellowship-hall classrooms. Main level: outside, next to the head pastor's office."),
        ("HP10",  "Back-hallway access to Explorers/Harvesters/Light classrooms. Main level: outside, next to the head pastor's office."),
        ("HP14A", "Pastors' offices — Marc's office. Main level: outside, next to the head pastor's office."),
        ("HP14B", "Pastors' offices — David's office. Main level: outside, next to the head pastor's office."),
        ("AC7",   "Fellowship-hall classrooms. Main level: in ceiling, long drop tiles in the pastor-offices hallway."),
        ("AC8",   "Fellowship-hall classrooms. Main level: in ceiling, long drop tiles in the pastor-offices hallway."),
        ("AC10",  "Explorers/Harvesters/Light classrooms. Main level: Light classroom storage closet, back-left corner."),
        ("AC6",   "Fellowship-hall center. Roof unit: on the roof over the cafeteria kitchen."),
    ],
    ("87", 1): [
        ("BG",    "Kitchen, cafeteria, Latin room, computer lab, library, (main) music room, intern office, Sheri Purdue's office. Outside, behind the kitchen and dumpster."),
        ("AC17",  "Beverage station / pantry hallway. Roof unit: on the roof over the cafeteria kitchen."),
        ("BG2",   "1987 sanctuary. Fenced-in elementary playground; air handler in the boiler room."),
        ("BGF4",  "Matt Ross office (main level). Unit in the elementary-playground corner behind some bushes; AC in the Matt Ross office."),
    ],
    ("87", -1): [
        ("BGF1",  "Lower-level music room. Outside, behind the kitchen and dumpster (smaller than BG)."),
        ("BGF2",  "Lower-level classrooms, kindergarten–3rd grade. Outside, behind the kitchen and dumpster."),
        ("BGF3",  "Lower-level classrooms, kindergarten–3rd grade. Outside, behind the kitchen and dumpster."),
        ("BGF5",  "Stairway & teachers'-lounge rooms (lower level). Fenced-in elementary playground."),
        ("BGF6",  "Lower-level classrooms: kindergarten, 4th & 5th grade. North side, just past the elementary playground; AC in ceiling of the school hallway (sticker-labeled tiles)."),
        ("BGF7",  "Lower-level classrooms: kindergarten, 4th & 5th grade. North side, just past the elementary playground; AC in ceiling of the school hallway (sticker-labeled tiles)."),
        ("BGF8",  "Lower-level classrooms: kindergarten, 4th & 5th grade. North side, just past the elementary playground; AC in ceiling of the school hallway (sticker-labeled tiles)."),
        ("Boiler","Boiler. In the boiler room (serves the BG2 air handler)."),
    ],
    ("GYM", 1): [
        ("HPG1", "Middle-school gym, locker rooms, concession stand. Outside, farthest side of the building from the church."),
        ("HPG2", "Middle-school gym, locker rooms, concession stand. Outside, farthest side of the building from the church."),
        ("HPG3", "Middle-school gym, locker rooms, concession stand. Outside, farthest side of the building from the church."),
        ("HPG4", "Gym / locker rooms / concession. Outside, corner closest to the church nursery."),
        ("ACG1", "Locker room 1. In ceiling."),
        ("ACG2", "Locker room 2. In ceiling."),
        ("ACG4", "Above the concession room. In ceiling."),
        ("MHPG1","All classrooms except the far end of the building. Outside, side closest to the pavilion and field."),
        ("MHPG2","All classrooms except the far end of the building. Outside, side closest to the pavilion and field."),
        ("MHPG3","All classrooms except the far end of the building. Outside, side closest to the pavilion and field."),
        ("WU1",  "Colloquium classroom. Wall unit attached to the wall closest to the church."),
    ],
}

def kind(label):
    u = label.upper()
    if u.startswith("AH"): return "air_handler"
    if u.startswith("AC") or u.startswith("ACG"): return "air_conditioner"
    if u.startswith("HP") or u.startswith("HPG") or u.startswith("MHP"): return "heat_pump"
    if u.startswith("WU"): return "wall_unit"
    if u.startswith("BOILER"): return "boiler"
    return "packaged_unit"  # BG, BGF, BG2

by_code = {b["code"]: b for b in buildings}

def grid_points(fp, n, inset=4.0):
    """Lay n points in a tidy grid inside the footprint bbox."""
    x0, y0, x1, y1 = bbox(fp)
    x0 += inset; y0 += inset; x1 -= inset; y1 -= inset
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    out = []
    for i in range(n):
        r, c = divmod(i, cols)
        gx = x0 if cols == 1 else x0 + (x1 - x0) * c / (cols - 1)
        gy = y1 if rows == 1 else y1 - (y1 - y0) * r / (rows - 1)
        out.append((gx, gy))
    return out

# ── Build GeoJSON ─────────────────────────────────────────────────────────────
bldg_features = []
for b in buildings:
    bldg_features.append({
        "type": "Feature",
        "properties": {
            "kind": "building", "code": b["code"], "name": b["name"],
            "description": b["description"],
            "levels": [l["level"] for l in b["levels"]],
            "label_lnglat": ll(*b["label"]),
        },
        "geometry": {"type": "Polygon", "coordinates": ring(b["footprint"])},
    })

poi_features = []
floors = []
pid = 1
seen_floor = set()
for (code, level), units in P.items():
    b = by_code[code]
    lvl_name = next(l["name"] for l in b["levels"] if l["level"] == level)
    pts = grid_points(b["footprint"], len(units))
    for (label, notes), (x, y) in zip(units, pts):
        poi_features.append({
            "type": "Feature",
            "properties": {
                "id": f"poi-{pid:03d}",
                "poi_type": "hvac",
                "kind": kind(label),
                "label": label,
                "building": b["name"], "building_code": code,
                "level": level, "level_name": lvl_name,
                "linked_asset_id": None,
                "icon": "hvac",
                "notes": notes,
            },
            "geometry": {"type": "Point", "coordinates": ll(x, y)},
        })
        pid += 1

# floor records (one per building level) with geo_corners quad = footprint bbox
for b in buildings:
    x0, y0, x1, y1 = bbox(b["footprint"])
    quad = {"type": "Polygon", "coordinates": [[
        ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1), ll(x0, y0)]]}
    for l in b["levels"]:
        floors.append({
            "building_code": b["code"], "building": b["name"],
            "name": l["name"], "level": l["level"],
            "floorplan_image_url": None,
            "geo_corners_geojson": quad,
            "rotation_deg": 0,
        })

def write(name, obj):
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, indent=2)
    print("wrote", name)

# Only (re)write the PLACEHOLDER dataset when run directly. Importing this module
# (e.g. from gen_pois.py) just exposes the slide POI data (P, kind, by_code) and
# must NOT clobber buildings.geojson once it holds real, traced footprints.
if __name__ == "__main__":
    write("buildings.geojson", {"type": "FeatureCollection", "features": bldg_features})
    write("pois.geojson", {"type": "FeatureCollection", "features": poi_features})
    write("floors.json", floors)
    print(f"buildings={len(bldg_features)} pois={len(poi_features)} floors={len(floors)}")
    print("center:", ll(15, -5))
