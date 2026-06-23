# Campus indoor map data (generated preview)

MapLibre-ready map data + a standalone viewer for the indoor-map model (building
footprints, a level switcher, per-floor POIs, exterior area features), shown over
a satellite basemap. **Preview content — not wired into the app**, and it doesn't
change any existing code. It's **per-facility** so it scales to many churches.

## Layout (multi-facility, plan §7.6)

Each church is one folder under `facilities/`. Nothing church-specific lives in
code — only in these data files.

```
map-data/
  viewer.html                 # ?facility=<id> (default: midwaypca)
  vendor/maplibre-gl.{js,css} # vendored lib (no CDN needed for the library)
  gen_map.py  gen_pois.py     # generators (FACILITY env var, default midwaypca)
  authoring/                  # tools to draw/edit accurately (see authoring/README.md)
  facilities/
    midwaypca/
      meta.json               # facility identity + basemap config (church-as-config)
      buildings.geojson       # footprints (Polygon)            → buildings.footprint_geojson
      floors.json             # building × level + geo_corners   → floors (plan §6)
      pois.geojson            # points: HVAC + any poi_type       → pois (plan §5.4)
      areas.geojson           # exterior area polygons (playground, cemetery, …) [optional]
      tiles/                  # cached basemap tiles [optional, see "Basemap"]
```

Add another church = add `facilities/<id>/` with its own `meta.json` +
`buildings.geojson`, then open `viewer.html?facility=<id>`.

## View it

```sh
cd map-data
python3 -m http.server 8000
# open http://localhost:8000/viewer.html            (Midway PCA)
# or    http://localhost:8000/viewer.html?facility=<id>
```

Switch floors with the top-left control; click any point for its notes. The
library is vendored; the **satellite basemap** streams from Esri (needs internet)
unless you've cached it locally (below).

## What's easy to add

| Want to add | How | Code change? |
|-------------|-----|--------------|
| **Another building** | Draw a polygon in geojson.io, add to `buildings.geojson`, set `levels` | none |
| **A floor** | Add the `level` to that building's `levels`; add a `floors.json` row | none |
| **An HVAC unit / point feature** | Add a Point to `pois.geojson` with a `poi_type` (`hvac`, `shutoff`, `fountain`, `fire_extinguisher`, `network_hardware`, …) | none |
| **An area** (playground, cemetery, garden, carport, field, pavilion) | Add a Polygon to `areas.geojson` with a `feature_type` | none |
| **A whole new church** | New `facilities/<id>/` folder + `meta.json` | none |

The viewer styles points by `poi_type` (HVAC sub-colored by unit family) and
areas by `feature_type`, with a legend that lists whatever types are present —
so a new type shows up automatically. New colors: one line each in `viewer.html`
(`POI_TYPE_COLORS` / `AREA_COLORS`). Field definitions: `authoring/fields.md`.

## Basemap (cache it so it isn't re-fetched)

By default the viewer streams Esri World Imagery live. To check the imagery into
the repo so it loads instantly/offline and never re-fetches:

```sh
python3 authoring/fetch_basemap.py midwaypca --min 16 --max 19
```

This downloads just the campus tiles into `facilities/midwaypca/tiles/` and sets
`basemap_tiles` in `meta.json`; the viewer then serves them locally. Run it on a
machine with internet. **Licensing note:** Esri imagery is meant to be shown live
with attribution — caching is fine for local/offline convenience, but for a
basemap you fully own, tile your **own** georeferenced aerial to PMTiles (plan
§10). Either way set the source in `meta.json`.

## Coordinate status (Midway PCA)

- **Building footprints — REAL** (traced in geojson.io, imported via
  `authoring/import_buildings.py`).
- **HVAC points — APPROXIMATE**: auto-gridded per floor inside each real
  footprint by `gen_pois.py`; nudge to exact spots next (plan §5.3 — navigational
  aids, not drawings).
- **Example areas + the sample shutoff POI** are placeholders marked
  "(example — reposition)"; move/replace them with real ones.
- **Floor overlays (`floors.json`)** — placeholder bbox quad until you
  georeference the floorplan drawings (`authoring/README.md`).

## Regenerate

- `python3 gen_pois.py` — re-distributes the slide-derived HVAC units into the
  current footprints and rebuilds `floors.json`; **preserves** any hand-added
  non-HVAC features in `pois.geojson`. Honors `FACILITY=<id>`.
- `python3 authoring/gen_authoring.py` — refreshes the `authoring/pois-<id>.csv`
  checklist.
- `gen_map.py` — the original placeholder generator (writes to
  `facilities/_placeholder/`; superseded by the real traced data).
