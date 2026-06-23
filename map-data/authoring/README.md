# Authoring kit — draw the campus accurately

Tools to draw/edit a facility's footprints, floors, POIs, and areas at their
**real** coordinates, then drop the result back into `../viewer.html` (and later
the Phase 2 loader / `pois` schema, plan §6/§10).

Data lives **per facility** under `../facilities/<id>/`. All scripts honor a
`FACILITY` env var (default `midwaypca`), e.g. `FACILITY=stjohns python3 …`.

## What's here

| File | Purpose |
|------|---------|
| `import_buildings.py` | Normalize a raw **geojson.io** building export → `../facilities/<id>/buildings.geojson` (lifts top-level keys into `properties`, adds a label anchor). |
| `gen_authoring.py` | Writes `pois-<id>.csv` — a flat checklist of every POI with its notes. |
| `fetch_basemap.py` | Cache the satellite basemap tiles for a campus into the repo (see main README → "Basemap"). |
| `setup_qgis_project.py` | One-shot **QGIS** bootstrap: satellite basemap + the facility's layers, styled. |
| `template.geojson` | **geojson.io** starter — 1 building + 1 POI showing every field. |
| `fields.md` | Data dictionary: property keys, types, allowed values, colors (buildings, POIs, areas, meta). |

For Midway, the footprints are already real; `pois-midwaypca.csv` lists all 52
slide-derived HVAC units (+ any hand-added features) as your placement checklist.

---

## Track A — geojson.io (fast: footprints, points, areas)

Best for building outlines, the units you can see on the satellite, and exterior
areas (playground, cemetery, garden, carport).

1. Go to **geojson.io**; switch the basemap to satellite; pan to the campus.
2. Open `template.geojson` for the field structure (drag it in, or paste).
3. **Draw** polygons (buildings / areas) and **drop points** (units / shutoffs).
4. Fill properties per `fields.md` — for HVAC, copy `label` / `notes` from
   `pois-<id>.csv`. Tag points with a `poi_type`, areas with a `feature_type`.
5. **Save → GeoJSON**, then either:
   - buildings: `python3 import_buildings.py <export>.geojson` (normalizes +
     writes `../facilities/<id>/buildings.geojson`), or
   - points/areas: save as `../facilities/<id>/pois.geojson` /
     `areas.geojson`.
6. After footprints change, re-home the HVAC points + floors:
   `python3 ../gen_pois.py` (preserves your hand-added non-HVAC points). Reload
   `../viewer.html`.

## Track B — QGIS (accurate, incl. interior floorplans)

For surveyed-ish placement and to **georeference floorplan drawings** into
`geo_corners_geojson` (the MapLibre `image` overlay, plan §5.1).

1. Install **QGIS** (free, LTR). `Plugins → Python Console → Show Editor`, open
   `setup_qgis_project.py`, **Run** → Esri basemap + Buildings + HVAC POIs,
   styled, saved as `campus_authoring.qgz`. (Set `BASE` if it can't find files.)
2. Edit features over the imagery; filter to one floor at a time (right-click the
   POIs layer → `Filter…` → `"level" = 1`). Attributes follow `fields.md`.
3. **Georeference a floorplan:** export the slide as PNG →
   `Raster → Georeferencer…` → ≥4 GCPs (drawing corner ↔ satellite spot) →
   *Projective* → run. Capture the four corners as `geo_corners_geojson` in
   `floors.json`. *(Allmaps — allmaps.org — is the browser equivalent, the
   pattern plan §10 cites.)*
4. `Export → Save Features As…` → **GeoJSON**, CRS **EPSG:4326**, overwrite the
   facility files. Reload `../viewer.html`.

---

## Conventions to preserve

- Geometry in **EPSG:4326 (lng, lat)**.
- Don't rename property keys (`fields.md`); `level` drives the floor switcher
  (−1 lower · 1 main · 2 upper).
- One source of truth: edit the GeoJSON, then `python3 ../gen_pois.py` and
  `python3 gen_authoring.py` to refresh derived files.
