# Campus map authoring — QGIS project bootstrap.
#
# Run this INSIDE QGIS (Plugins → Python Console → "Show Editor" → open this
# file → Run, or paste it). It builds a ready-to-edit project:
#   • Esri World Imagery satellite basemap (XYZ)
#   • the slide-imported Buildings + HVAC POIs layers (../buildings.geojson,
#     ../pois.geojson), styled (POIs colored by unit family, labeled)
#   • project CRS set to Web Mercator for editing over the imagery
# then saves campus_authoring.qgz next to this script.
#
# No plugins required. Tested against QGIS 3.28+ (LTR) APIs.

import os
from qgis.core import (
    QgsProject, QgsRasterLayer, QgsVectorLayer, QgsCoordinateReferenceSystem,
    QgsCategorizedSymbolRenderer, QgsRendererCategory, QgsMarkerSymbol,
    QgsFillSymbol, QgsPalLayerSettings, QgsTextFormat,
    QgsVectorLayerSimpleLabeling,
)
from qgis.PyQt.QtGui import QColor

# --- locate this script's folder (fallback: edit BASE by hand) ----------------
try:
    BASE = os.path.dirname(os.path.abspath(__file__))
except NameError:
    BASE = "/path/to/cmc/map-data/authoring"   # <-- set this if __file__ is undefined
MD = os.path.dirname(BASE)  # map-data/

proj = QgsProject.instance()
proj.clear()
proj.setCrs(QgsCoordinateReferenceSystem("EPSG:3857"))  # display CRS over imagery

# --- 1. Esri World Imagery satellite basemap (XYZ) ----------------------------
esri = ("type=xyz&zmin=0&zmax=19&url="
        "https://server.arcgisonline.com/ArcGIS/rest/services/"
        "World_Imagery/MapServer/tile/%7Bz%7D/%7By%7D/%7Bx%7D")
base = QgsRasterLayer(esri, "Esri World Imagery", "wms")
if base.isValid():
    proj.addMapLayer(base)
    print("✓ satellite basemap added")
else:
    print("! basemap failed — add it manually: Browser → XYZ Tiles")

# --- 2. slide-imported vector layers ------------------------------------------
def add_vec(fname, name):
    path = os.path.join(MD, fname)
    lyr = QgsVectorLayer(path, name, "ogr")
    if not lyr.isValid():
        print("! could not load", path); return None
    proj.addMapLayer(lyr)
    print(f"✓ {name}: {lyr.featureCount()} features")
    return lyr

buildings = add_vec("buildings.geojson", "Buildings")
pois = add_vec("pois.geojson", "HVAC POIs")

# --- 3. styling ---------------------------------------------------------------
KIND_COLORS = {
    "air_conditioner": "#2563eb", "heat_pump": "#16a34a",
    "air_handler": "#9333ea", "packaged_unit": "#ea580c",
    "wall_unit": "#0891b2", "boiler": "#dc2626",
}

if buildings:
    sym = QgsFillSymbol.createSimple({
        "color": "30,41,59,90", "outline_color": "148,163,184",
        "outline_width": "0.5"})
    buildings.renderer().setSymbol(sym)
    buildings.triggerRepaint()

if pois:
    cats = []
    for kind, hexc in KIND_COLORS.items():
        s = QgsMarkerSymbol.createSimple({
            "name": "circle", "size": "3",
            "color": hexc, "outline_color": "white", "outline_width": "0.4"})
        cats.append(QgsRendererCategory(kind, s, kind))
    pois.setRenderer(QgsCategorizedSymbolRenderer("kind", cats))
    # label by unit name
    s = QgsPalLayerSettings(); s.fieldName = "label"; s.enabled = True
    s.placement = QgsPalLayerSettings.OverPoint if hasattr(QgsPalLayerSettings, "OverPoint") else 0
    tf = QgsTextFormat(); tf.setSize(8)
    s.setFormat(tf)
    pois.setLabeling(QgsVectorLayerSimpleLabeling(s))
    pois.setLabelsEnabled(True)
    pois.triggerRepaint()

# --- 4. save reusable project -------------------------------------------------
out = os.path.join(BASE, "campus_authoring.qgz")
proj.write(out)
print("✓ saved project:", out)
print("\nNEXT: in the layer panel right-click a layer → 'Filter…' by `level` to "
      "edit one floor at a time. When done: right-click → Export → Save Features "
      "As… → GeoJSON, CRS = EPSG:4326, overwrite ../buildings.geojson / ../pois.geojson.")
