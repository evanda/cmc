# Campus indoor map data (generated preview)

Generated MapLibre-ready map data for the church campus, derived from the rough
HVAC layout slides and the satellite shape. This is **sample/preview content**,
not wired into the app — it lets you *see the indoor-map model in MapLibre*
(building footprints + a level switcher + per-floor POIs) before the Phase 2
loader tool exists. It does not change any existing code.

## Files

| File | What it is |
|------|------------|
| `buildings.geojson` | 4 building footprints (Polygon features) → `buildings.footprint_geojson` (plan §6). |
| `pois.geojson` | 52 HVAC POIs (Point features) tagged with `level`, `poi_type:"hvac"`, `kind`, `label`, `notes` (plan §5.4). |
| `floors.json` | 7 floor records (building × level) with a `geo_corners_geojson` quad placeholder (plan §6 `floors`). |
| `viewer.html` | Standalone MapLibre GL JS viewer with a **level switcher** (Site · 2 · 1 · B1). |
| `authoring/` | Tools to redraw this accurately at real coordinates — QGIS bootstrap, geojson.io template, field reference, and a 52-unit CSV checklist. See `authoring/README.md`. |

## View it

```sh
cd map-data
python3 -m http.server 8000
# open http://localhost:8000/viewer.html
```

(Needs internet for the MapLibre lib + glyphs from the CDN. The map data itself
is local; the basemap is a blank schematic background — no tiles/API key.)

Switch levels with the top-left control; click any HVAC dot for its
controls/location notes. Colors group units by family (AC / HP / AH / packaged /
wall unit / boiler).

## Buildings & levels

- **2009 Building (Church)** — Basement (-1), Main (1), Upper (2)
- **Fellowship Hall** — Main (1)
- **1987 Building (School)** — Lower (-1), Main (1)
- **Gym / Middle School** — Main (1)

## Coordinate status

- **Building footprints — REAL.** Traced on satellite imagery in geojson.io and
  imported via `authoring/import_buildings.py`. The viewer auto-fits to them.
- **HVAC POI points — APPROXIMATE.** Auto-distributed as a tidy per-floor grid
  *inside* each real footprint by `gen_pois.py`; they are not yet surveyed spots.
  Per plan §5.3 these are navigational aids ("where's the unit?"), not drawings —
  nudge each to its true position next (geojson.io, or the Phase 2 loader §10).
- **Floor overlays (`floors.json`) — placeholder quad** = each building's bbox.
  Replace `geo_corners_geojson` by georeferencing the floorplan drawings
  (QGIS Georeferencer / Allmaps — see `authoring/README.md`).

## Regenerate

`gen_map.py` (in this folder) produced these from the slide content. Re-run it
(`python3 gen_map.py`) to tweak layout, POI groupings, or notes.
