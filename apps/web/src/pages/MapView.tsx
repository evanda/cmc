import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import maplibregl, {
  type ExpressionSpecification,
  type Map as MlMap,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { buildLevels, levelLabel, poiLevelFilter, resolveBasemapUrl, type Level } from '../lib/map-utils';

interface SelectedPoi {
  label: string;
  poi_type: string;
  building: string | null;
  level_name: string | null;
  notes: string | null;
  /** DB-sourced asset id — preferred over name-matching for navigation. */
  linked_asset_id: string | null;
}


interface FloorData {
  building_code: string;
  building: string;
  name: string;
  level: number;
  floorplan_image_url: string | null;
  geo_corners_geojson: GeoJSON.Polygon | null;
  rotation_deg: number;
}

// Single-map, level-switchable indoor model (plan §5). A neutral background +
// georeferenced footprints/POIs renders fully offline; an optional subtle
// grayscale satellite basemap (meta.json → basemap_tiles) adds ground context.
const POI_COLORS: Record<string, string> = {
  hvac: '#0d9488',
  shutoff: '#dc2626',
  network_hardware: '#2563eb',
  sound_system: '#7c3aed',
  fountain: '#0891b2',
  fire_extinguisher: '#ea580c',
};

export function MapView({
  facility = 'midwaypca',
  assets = [],
  buildings = [],
  openWoCountByBuilding = {},
  onCreateWorkOrder,
  poisGeoJSON,
  buildingsGeoJSON,
}: {
  facility?: string;
  assets?: { id: string; name: string }[];
  buildings?: { id: string; name: string }[];
  openWoCountByBuilding?: Record<string, number>;
  /** Open a new work order pre-linked to this asset (plan §5.4, #37). */
  onCreateWorkOrder?: (assetId: string) => void;
  /**
   * DB-backed POIs as a GeoJSON FeatureCollection (plan §5.4, #5).
   * When provided, the map uses this instead of fetching the bundled pois.geojson.
   * Undefined/empty → fall back to the bundled static file (demo mode or unseeded DB).
   */
  poisGeoJSON?: GeoJSON.FeatureCollection;
  /**
   * DB-backed building footprints as a GeoJSON FeatureCollection.
   * When provided, merged with (or replaces) the bundled buildings.geojson.
   */
  buildingsGeoJSON?: GeoJSON.FeatureCollection;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [level, setLevel] = useState<Level>('site');
  const [levels, setLevels] = useState<number[]>([]);
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  // Store just the GeoJSON feature name; derive id/count from current props on render
  // so the map-load closure never sees stale buildings/openWoCountByBuilding values.
  const [selectedBuildingName, setSelectedBuildingName] = useState<string | null>(null);
  const buildingIdByName = new Map(buildings.map((b) => [b.name, b.id]));
  // Tracks floor image overlay layer IDs + their level for visibility toggling.
  const floorImageLayersRef = useRef<{ layerId: string; level: number }[]>([]);
  const base = `${import.meta.env.BASE_URL}facilities/${facility}`;
  // POIs are named after their asset (e.g. "AC16A"); link by label.
  const assetIdByName = new Map(assets.map((a) => [a.name, a.id]));
  // Ref so the map.on('load') closure always reads the latest poisGeoJSON without
  // triggering a map recreation (the effect deps only include `base`).
  const poisGeoJSONRef = useRef(poisGeoJSON);
  poisGeoJSONRef.current = poisGeoJSON;
  const buildingsGeoJSONRef = useRef(buildingsGeoJSON);
  buildingsGeoJSONRef.current = buildingsGeoJSON;

  useEffect(() => {
    if (!containerRef.current) return;
    // Register PMTiles protocol once per page load so pmtiles:// basemap URLs work.
    const pmProtocol = new Protocol();
    maplibregl.addProtocol('pmtiles', pmProtocol.tile);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eaeef3' } }],
      },
      center: [-84.6879, 33.9441],
      zoom: 17,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      const [staticBuildings, areas, meta, floorsData] = await Promise.all([
        fetch(`${base}/buildings.geojson`).then((r) => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
        fetch(`${base}/areas.geojson`).then((r) => r.json()),
        fetch(`${base}/meta.json`)
          .then((r) => r.json())
          .catch(() => ({})),
        fetch(`${base}/floors.json`)
          .then((r) => r.json())
          .catch(() => []),
      ]);
      // Use DB-sourced pois if available (seeded via `pnpm assets:seed`), otherwise
      // fall back to the bundled static file (demo mode or unseeded instance).
      const pois: GeoJSON.FeatureCollection =
        poisGeoJSONRef.current ?? (await fetch(`${base}/pois.geojson`).then((r) => r.json()));

      // Merge DB building footprints with the bundled static file. DB features
      // (identified by a 'db_id' property) override any static feature with the
      // same name so hand-drawn footprints win over the seeded GeoJSON.
      const dbBuildings = buildingsGeoJSONRef.current;
      const buildings: GeoJSON.FeatureCollection = dbBuildings
        ? {
            type: 'FeatureCollection',
            features: [
              ...staticBuildings.features.filter(
                (sf: GeoJSON.Feature) =>
                  !dbBuildings.features.some(
                    (df) => df.properties?.name === sf.properties?.name,
                  ),
              ),
              ...dbBuildings.features,
            ],
          }
        : staticBuildings;

      // Optional subtle satellite basemap — grayscale + faded so it reads as
      // ground context behind the vectors, not a competing layer. Church-specific
      // (configured per facility in meta.json, plan §7.6); generic in code.
      // Supports pmtiles:// archives (no tile server needed) and https:// XYZ templates.
      const basemap = resolveBasemapUrl(meta?.basemap_tiles, base);
      if (basemap) {
        map.addSource(
          'satellite',
          basemap.isPMTiles
            ? {
                type: 'raster',
                url: basemap.url,
                tileSize: 256,
                attribution: meta.basemap_attribution ?? '',
              }
            : {
                type: 'raster',
                tiles: [basemap.url],
                tileSize: 256,
                minzoom: meta.basemap_minzoom ?? 0,
                maxzoom: meta.basemap_maxzoom ?? 22,
                attribution: meta.basemap_attribution ?? '',
              },
        );
        map.addLayer({
          id: 'satellite',
          type: 'raster',
          source: 'satellite',
          paint: {
            'raster-saturation': -1, // grayscale
            'raster-contrast': -0.15, // flatten so it recedes
            'raster-brightness-min': 0.35, // lift shadows → lighter
            'raster-opacity': 0.35, // very subtle; fades into the background
          },
        });
        map.addControl(new maplibregl.AttributionControl({ compact: true }));
      }

      map.addSource('areas', { type: 'geojson', data: areas });
      map.addLayer({
        id: 'area-fill',
        type: 'fill',
        source: 'areas',
        paint: { 'fill-color': '#86efac', 'fill-opacity': 0.35 },
      });
      map.addLayer({
        id: 'area-line',
        type: 'line',
        source: 'areas',
        paint: { 'line-color': '#16a34a', 'line-dasharray': [2, 1] },
      });

      map.addSource('buildings', { type: 'geojson', data: buildings });
      map.addLayer({
        id: 'building-fill',
        type: 'fill',
        source: 'buildings',
        paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.25 },
      });
      map.addLayer({
        id: 'building-line',
        type: 'line',
        source: 'buildings',
        paint: { 'line-color': '#475569', 'line-width': 2 },
      });

      // Per-level floor outlines from floors.json geo_corners_geojson (plan §5.2).
      // At site level: hidden (building footprints are shown instead).
      // At a numbered level: only the floors matching that level appear.
      const validFloors = (floorsData as FloorData[]).filter((f) => f.geo_corners_geojson);
      const floorsGeoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: validFloors.map((f) => ({
          type: 'Feature' as const,
          geometry: f.geo_corners_geojson as GeoJSON.Polygon,
          properties: {
            level: f.level,
            building: f.building,
            building_code: f.building_code,
            name: f.name,
          },
        })),
      };
      map.addSource('floors', { type: 'geojson', data: floorsGeoJSON });
      map.addLayer({
        id: 'floor-fill',
        type: 'fill',
        source: 'floors',
        paint: { 'fill-color': '#bfdbfe', 'fill-opacity': 0.25 },
        layout: { visibility: 'none' },
      });
      map.addLayer({
        id: 'floor-line',
        type: 'line',
        source: 'floors',
        paint: { 'line-color': '#3b82f6', 'line-width': 1.5, 'line-dasharray': [4, 2] },
        layout: { visibility: 'none' },
      });

      // Floorplan image overlays: one image source + raster layer per floor that
      // has a drawing (floorplan_image_url is non-null). Shown only when the
      // matching level is active (plan §5.1 — image source with 4 corner coords).
      const imageOverlays: { layerId: string; level: number }[] = [];
      for (const floor of floorsData as FloorData[]) {
        if (!floor.floorplan_image_url || !floor.geo_corners_geojson) continue;
        const coords = floor.geo_corners_geojson.coordinates[0];
        if (coords.length < 4) continue;
        const sourceId = `floor-img-src-${floor.building_code}-${floor.level}`;
        const layerId = `floor-img-${floor.building_code}-${floor.level}`;
        const url = /^https?:\/\//.test(floor.floorplan_image_url)
          ? floor.floorplan_image_url
          : `${base}/${floor.floorplan_image_url}`;
        // MapLibre image source takes [topLeft, topRight, bottomRight, bottomLeft].
        map.addSource(sourceId, {
          type: 'image',
          url,
          coordinates: [
            coords[0] as [number, number],
            coords[1] as [number, number],
            coords[2] as [number, number],
            coords[3] as [number, number],
          ],
        });
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: { 'raster-opacity': 0.8 },
          layout: { visibility: 'none' },
        });
        imageOverlays.push({ layerId, level: floor.level });
      }
      floorImageLayersRef.current = imageOverlays;

      map.addSource('pois', { type: 'geojson', data: pois });
      map.addLayer({
        id: 'poi',
        type: 'circle',
        source: 'pois',
        paint: {
          'circle-radius': 5,
          'circle-color': [
            'match',
            ['get', 'poi_type'],
            ...Object.entries(POI_COLORS).flat(),
            '#64748b',
          ] as unknown as ExpressionSpecification,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });

      // Building name labels as HTML markers (no glyph server needed).
      for (const f of buildings.features) {
        const ll = f.properties?.label_lnglat;
        if (!ll) continue;
        const el = document.createElement('div');
        el.className =
          'rounded bg-white/85 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm';
        el.textContent = f.properties?.name ?? '';
        new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map);
      }

      // POI click → React detail card (links through to the asset record).
      map.on('click', 'poi', (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        setSelectedBuildingName(null);
        setSelected({
          label: p.label ?? p.poi_type,
          poi_type: p.poi_type,
          building: p.building ?? null,
          level_name: p.level_name ?? null,
          notes: p.notes ?? null,
          linked_asset_id: p.linked_asset_id ?? null,
        });
      });
      map.on('mouseenter', 'poi', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'poi', () => (map.getCanvas().style.cursor = ''));

      // Building click → summary card (plan §4.6: click a building → open WOs + assets).
      // Skip if a POI was also at the clicked point (POI handler takes precedence).
      // Only store the name in state; id + WO count derived from current props on render
      // to avoid stale closure over buildings / openWoCountByBuilding.
      map.on('click', 'building-fill', (e) => {
        const pois = map.queryRenderedFeatures(e.point, { layers: ['poi'] });
        if (pois.length > 0) return;
        const p = e.features?.[0]?.properties;
        if (!p) return;
        setSelected(null);
        setSelectedBuildingName(p.name as string);
      });
      map.on('mouseenter', 'building-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'building-fill', () => (map.getCanvas().style.cursor = ''));

      // Fit to the campus.
      const b = new maplibregl.LngLatBounds();
      for (const f of buildings.features) {
        const geom = f.geometry as GeoJSON.Polygon | null;
        if (geom?.coordinates)
          for (const ring of geom.coordinates) for (const c of ring) b.extend(c as [number, number]);
      }
      map.fitBounds(b, { padding: 60, duration: 0 });

      // Discover levels: union of POI levels + floor levels (plan §5.2).
      const poiLevels = [
        ...new Set(pois.features.map((f: GeoJSON.Feature) => f.properties?.level)),
      ].filter((x): x is number => typeof x === 'number');
      const floorLevels = (floorsData as FloorData[])
        .map((f) => f.level)
        .filter((x): x is number => typeof x === 'number');
      setLevels(buildLevels(poiLevels, floorLevels));

      // Expose for the screenshot harness (project a POI → pixel to click it).
      if (import.meta.env.VITE_DEMO) {
        (window as unknown as { __cmcMap?: MlMap; __cmcPois?: unknown }).__cmcMap = map;
        (window as unknown as { __cmcMap?: MlMap; __cmcPois?: unknown }).__cmcPois = pois;
      }
    });

    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
    };
  }, [base]);

  // When DB pois arrive after the map has already loaded (common timing), update
  // the 'pois' GeoJSON source in place so the map reflects the DB-linked data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !poisGeoJSON) return;
    const src = map.getSource('pois');
    if (src && 'setData' in src) {
      (src as { setData(d: GeoJSON.FeatureCollection): void }).setData(poisGeoJSON);
    }
  }, [poisGeoJSON]);

  // When DB building footprints arrive after load, update the buildings source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !buildingsGeoJSON) return;
    const src = map.getSource('buildings');
    if (src && 'setData' in src) {
      (src as { setData(d: GeoJSON.FeatureCollection): void }).setData(buildingsGeoJSON);
    }
  }, [buildingsGeoJSON]);

  // Apply the level filter to POIs, floor outlines, and image overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('poi')) return;

    map.setFilter('poi', poiLevelFilter(level) as Parameters<typeof map.setFilter>[1]);

    // Areas only visible at site level (exterior features).
    const areaVis = level === 'site' ? 'visible' : 'none';
    if (map.getLayer('area-fill')) map.setLayoutProperty('area-fill', 'visibility', areaVis);
    if (map.getLayer('area-line')) map.setLayoutProperty('area-line', 'visibility', areaVis);

    // Floor outlines: visible only for a specific level, filtered to that level.
    if (level !== 'site') {
      const lvFilter = poiLevelFilter(level) as Parameters<typeof map.setFilter>[1];
      if (map.getLayer('floor-fill')) {
        map.setLayoutProperty('floor-fill', 'visibility', 'visible');
        map.setFilter('floor-fill', lvFilter);
      }
      if (map.getLayer('floor-line')) {
        map.setLayoutProperty('floor-line', 'visibility', 'visible');
        map.setFilter('floor-line', lvFilter);
      }
    } else {
      if (map.getLayer('floor-fill')) map.setLayoutProperty('floor-fill', 'visibility', 'none');
      if (map.getLayer('floor-line')) map.setLayoutProperty('floor-line', 'visibility', 'none');
    }

    // Floorplan image overlays: show only the overlay matching the active level.
    for (const { layerId, level: overlayLevel } of floorImageLayersRef.current) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          'visibility',
          overlayLevel === level ? 'visible' : 'none',
        );
      }
    }
  }, [level]);

  return (
    <div className="relative h-[calc(100vh-9rem)] overflow-hidden rounded-lg border border-slate-200">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Level switcher (plan §5.2) */}
      <div className="absolute left-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow">
        {(['site', ...levels] as Level[]).map((l) => (
          <button
            key={String(l)}
            onClick={() => setLevel(l)}
            className={`px-3 py-1.5 text-sm ${
              level === l ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {l === 'site' ? 'Site' : levelLabel(l as number)}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs shadow">
        <div className="mb-1 font-semibold text-slate-600">POIs</div>
        {Object.entries(POI_COLORS)
          .filter(([k]) => k === 'hvac' || k === 'shutoff')
          .map(([k, c]) => (
            <div key={k} className="flex items-center gap-1.5 text-slate-600">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              {k}
            </div>
          ))}
      </div>

      {/* Selected POI card (plan §5.4 — click a POI → its asset record) */}
      {selected && (
        <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="font-semibold text-slate-800">{selected.label}</div>
            <button
              className="text-slate-400 hover:text-slate-700"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {selected.poi_type}
            {selected.building ? ` · ${selected.building}` : ''}
            {selected.level_name ? ` · ${selected.level_name}` : ''}
          </div>
          {selected.notes && <p className="mt-2 text-xs text-slate-600">{selected.notes}</p>}
          {/* Use DB-sourced linked_asset_id when available; fall back to name
              matching for the bundled static pois.geojson (demo / unseeded). */}
          {(selected.linked_asset_id ?? assetIdByName.get(selected.label)) ? (
            <div className="mt-3 flex flex-col gap-1.5">
              <Link
                to={`/assets/${selected.linked_asset_id ?? assetIdByName.get(selected.label)}`}
                className="rounded bg-slate-800 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-slate-700"
              >
                Open asset record →
              </Link>
              {onCreateWorkOrder && (
                <button
                  onClick={() =>
                    onCreateWorkOrder(
                      (selected.linked_asset_id ?? assetIdByName.get(selected.label))!,
                    )
                  }
                  className="rounded border border-slate-300 px-3 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  + Create work order
                </button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No linked asset.</p>
          )}
        </div>
      )}

      {/* Selected building card (plan §4.6 — click a building → open WOs + assets).
          Derive id + WO count from current props so we never read stale closure state. */}
      {selectedBuildingName && (() => {
        const bid = buildingIdByName.get(selectedBuildingName);
        const openWoCount = bid ? (openWoCountByBuilding[bid] ?? 0) : 0;
        return (
          <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
            <div className="flex items-start justify-between">
              <div className="font-semibold text-slate-800">{selectedBuildingName}</div>
              <button
                className="text-slate-400 hover:text-slate-700"
                onClick={() => setSelectedBuildingName(null)}
              >
                ✕
              </button>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {openWoCount > 0 ? (
                <span className="font-medium text-amber-700">
                  {openWoCount} open work order{openWoCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-slate-400">No open work orders</span>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <Link
                to={
                  bid
                    ? `/work-orders?building=${bid}&buildingName=${encodeURIComponent(selectedBuildingName)}`
                    : '/work-orders'
                }
                className="rounded bg-slate-800 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-slate-700"
              >
                Work orders →
              </Link>
              <Link
                to={
                  bid
                    ? `/assets?building=${bid}&buildingName=${encodeURIComponent(selectedBuildingName)}`
                    : '/assets'
                }
                className="rounded border border-slate-300 px-3 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Assets →
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
