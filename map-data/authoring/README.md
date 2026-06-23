# Authoring kit — draw the campus accurately

Tools + sample data to redraw the campus footprints, floors, and HVAC POIs at
their **real** coordinates, then drop the result straight back into
`../viewer.html` (and later the Phase 2 loader / `pois` schema, plan §6/§10).

## What's here

| File | Purpose |
|------|---------|
| `setup_qgis_project.py` | One-shot **QGIS** bootstrap: satellite basemap + the slide-imported layers, styled. |
| `template.geojson` | **geojson.io** starter — 1 building + 1 POI showing every field. |
| `fields.md` | The data dictionary (property keys, types, allowed values, colors). |
| `pois.csv` | All **52 HVAC units** imported from the slides — your checklist of what to place, with each unit's controls/location note. |
| `gen_authoring.py` | Regenerates `pois.csv` from `../pois.geojson`. |

The authoritative sample data is the parent `../buildings.geojson` /
`../pois.geojson` (the slide import). **It currently sits at placeholder
coordinates (~35.0, −80.0)**, so treat it as a *content checklist*, not
draggable-into-place geometry — you'll redraw the shapes at the true location and
carry the attributes (labels/notes) over from `pois.csv`.

---

## Track A — geojson.io (fast, footprints + outdoor POIs)

Best for the building outlines and the exterior units (condensers/heat pumps you
can see on the satellite).

1. Go to **geojson.io**. The basemap is already satellite-capable — pan/zoom to
   the real campus.
2. Open `template.geojson` (drag it onto the window, or paste into the JSON
   panel) to load the field structure + a sample building & POI.
3. **Draw** each building polygon over its roof; **drop points** for the units.
4. For every feature, fill the properties from `fields.md` (copy the `label` /
   `notes` for each unit out of `pois.csv`).
5. **Save → GeoJSON.** Replace `../buildings.geojson` and `../pois.geojson`,
   reload `../viewer.html` to check. Keep the `level` values so the floor
   switcher keeps working.

## Track B — QGIS (accurate, incl. interior floorplans)

Best when you want surveyed-ish placement and to **georeference the interior
floorplan drawings** into `geo_corners_geojson` (the MapLibre `image` overlay,
plan §5.1).

### Set up
1. Install **QGIS** (free, LTR build).
2. `Plugins → Python Console → Show Editor`, open `setup_qgis_project.py`, click
   **Run**. You get the Esri satellite basemap + Buildings + HVAC POIs layers,
   styled and labeled, saved as `campus_authoring.qgz`. (If it can't find the
   files, set `BASE` at the top of the script.)

### Edit footprints & POIs
3. Pan to the real campus. Toggle a layer editable (pencil icon) and move/redraw
   features onto the imagery. Filter to one floor at a time: right-click the
   **HVAC POIs** layer → `Filter…` → `"level" = 1` (then `2`, then `-1`).
4. Edit attributes in the table (`F6` / "Open Attribute Table"); values follow
   `fields.md`. `pois.csv` is your master list of all 52 units.

### Georeference an interior floorplan (per floor)
5. Export each floorplan slide as a PNG.
6. `Raster → Georeferencer…` → load the PNG → add ≥4 **GCPs** (click a wall
   corner on the drawing, then the matching spot on the satellite) → transform
   *Polynomial 1* / *Projective* → run. You now have the drawing placed in the
   world.
7. Trace interior POIs over the placed drawing; capture the floor's four corners
   as `geo_corners_geojson` for `floors.json`.
   *(Allmaps — allmaps.org — is a browser alternative to step 6 and is the
   pattern plan §10 cites.)*

### Export back out
8. Right-click each layer → `Export → Save Features As…` → **GeoJSON**, CRS
   **EPSG:4326**, overwrite `../buildings.geojson` / `../pois.geojson`. Reload
   `../viewer.html`.

---

## Conventions to preserve

- Geometry in **EPSG:4326 (lng, lat)**.
- Don't rename property keys (see `fields.md`); `level` drives the floor switcher
  (−1 lower · 1 main · 2 upper).
- One source of truth: edit the GeoJSON, regenerate `pois.csv` with
  `python3 gen_authoring.py` if you change the unit list.
