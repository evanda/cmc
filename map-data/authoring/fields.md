# Field reference (data dictionary)

Keep these property keys exactly — `viewer.html`, the loader (plan §10), and the
`pois`/`buildings` schema (plan §6) all read them. Geometry is GeoJSON in
**EPSG:4326 (lng, lat)** per RFC 7946.

## Buildings (`buildings.geojson`, Polygon)

| key | type | required | notes |
|-----|------|----------|-------|
| `kind` | string | yes | always `"building"` |
| `code` | string | yes | short id: `09`, `FH`, `87`, `GYM` |
| `name` | string | yes | display name |
| `description` | string | no | what's inside |
| `levels` | int[] | yes | floor levels present, e.g. `[-1, 1, 2]` |
| `label_lnglat` | [lng,lat] | no | where the name label is drawn (defaults to bbox center) |

## HVAC POIs (`pois.geojson`, Point)

| key | type | required | notes |
|-----|------|----------|-------|
| `id` | string | yes | stable id, `poi-001`… |
| `poi_type` | string | yes | `"hvac"` (plan §5.4 vocab: shutoff, hvac, fountain, …) |
| `kind` | enum | yes | unit family → marker color (see below) |
| `label` | string | yes | unit name from the slides, e.g. `AC16A` |
| `building` | string | yes | parent building name |
| `building_code` | string | yes | `09` / `FH` / `87` / `GYM` |
| `level` | int | yes | **−1** = basement/lower, **1** = main, **2** = upper (plan §5.2) |
| `level_name` | string | yes | `Basement` / `Lower` / `Main` / `Upper` |
| `linked_asset_id` | string\|null | no | FK to `assets` once tagged |
| `icon` | string | no | `"hvac"` |
| `notes` | string | no | controls / physical location from the slides |

### `kind` values → color (matches the viewer legend)

| kind | name prefix | color |
|------|-------------|-------|
| `air_conditioner` | AC / ACG | `#2563eb` blue |
| `heat_pump` | HP / HPG / MHP | `#16a34a` green |
| `air_handler` | AH | `#9333ea` purple |
| `packaged_unit` | BG / BGF | `#ea580c` orange |
| `wall_unit` | WU | `#0891b2` teal |
| `boiler` | Boiler | `#dc2626` red |

## Floors (`floors.json`, plan §6 `floors`)

`building_code`, `building`, `name`, `level`, `floorplan_image_url`,
`geo_corners_geojson` (4-corner Polygon quad for the MapLibre `image` overlay),
`rotation_deg`. Capture `geo_corners_geojson` by georeferencing each floorplan
drawing (QGIS Georeferencer / Allmaps) — see the README.
