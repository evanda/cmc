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
  safety: '#f59e0b',
  security: '#6366f1',
  door_controller: '#8b5cf6',
  thermostat: '#10b981',
};

const POI_LABELS: Record<string, string> = {
  hvac: 'HVAC',
  shutoff: 'Shutoff',
  network_hardware: 'Network',
  sound_system: 'Sound/AV',
  fountain: 'Fountain',
  fire_extinguisher: 'Fire Extinguisher',
  safety: 'Safety/AED',
  security: 'Security/Alarm',
  door_controller: 'Door Controller',
  thermostat: 'Thermostat',
};

function buildPoiFilter(level: Level, hiddenTypes: Set<string>) {
  const parts: unknown[] = [];
  const lf = poiLevelFilter(level);
  if (lf) parts.push(lf);
  if (hiddenTypes.size > 0)
    parts.push(['!', ['in', ['get', 'poi_type'], ['literal', [...hiddenTypes]]]]);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return ['all', ...parts];
}

export function MapView({
  facility = 'midwaypca',
  assets = [],
  buildings = [],
  openWoCountByBuilding = {},
  onCreateWorkOrder,
  highlightAssetId,
  highlightCoords,
  poisGeoJSON,
  buildingsGeoJSON,
  floorsGeoJSON,
}: {
  facility?: string;
  assets?: { id: string; name: string }[];
  buildings?: { id: string; name: string }[];
  openWoCountByBuilding?: Record<string, number>;
  /** Open a new work order pre-linked to this asset (plan §5.4, #37). */
  onCreateWorkOrder?: (assetId: string) => void;
  /** If set, fly to the POI linked to this asset id and open its card. */
  highlightAssetId?: string;
  /** Fallback coordinates [lng, lat] when highlightAssetId has no linked POI. */
  highlightCoords?: [number, number];
  poisGeoJSON?: GeoJSON.FeatureCollection;
  /** DB-backed building footprints — merged with the bundled buildings.geojson. */
  buildingsGeoJSON?: GeoJSON.FeatureCollection;
  /** DB-backed floor outlines — merged with the bundled floors.json. */
  floorsGeoJSON?: GeoJSON.FeatureCollection;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const highlightMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [level, setLevel] = useState<Level>('site');
  const [levels, setLevels] = useState<number[]>([]);
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const levelRef = useRef<Level>('site');
  levelRef.current = level;
  const hiddenTypesRef = useRef<Set<string>>(new Set());
  hiddenTypesRef.current = hiddenTypes;
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
  const floorsGeoJSONRef = useRef(floorsGeoJSON);
  floorsGeoJSONRef.current = floorsGeoJSON;
  // Cache static files once fetched so live-update effects can re-merge without re-fetching.

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
      // Only meta.json is loaded from the static facility directory — it carries
      // the optional basemap tile URL. All geographic data (buildings, floors, POIs)
      // comes exclusively from the DB via props.
      const meta = await fetch(`${base}/meta.json`).then((r) => r.json()).catch(() => ({}));

      const pois: GeoJSON.FeatureCollection =
        poisGeoJSONRef.current ?? { type: 'FeatureCollection', features: [] };

      const buildings: GeoJSON.FeatureCollection =
        buildingsGeoJSONRef.current ?? { type: 'FeatureCollection', features: [] };

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

      const floors: GeoJSON.FeatureCollection =
        floorsGeoJSONRef.current ?? { type: 'FeatureCollection', features: [] };
      map.addSource('floors', { type: 'geojson', data: floors });
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

      floorImageLayersRef.current = [];

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

      // Discover levels from DB POIs and DB floors.
      const poiLevels = [
        ...new Set(pois.features.map((f: GeoJSON.Feature) => f.properties?.level)),
      ].filter((x): x is number => typeof x === 'number');
      const floorLevels = floors.features
        .map((f: GeoJSON.Feature) => f.properties?.level)
        .filter((x): x is number => typeof x === 'number');
      setLevels(buildLevels(poiLevels, floorLevels));
      setMapLoaded(true);

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

  // When a highlight asset id is requested and POIs are loaded, fly to and select it.
  // Falls back to highlightCoords if the asset has no linked POI.
  useEffect(() => {
    if (!highlightAssetId || !mapLoaded) return;
    if (poisGeoJSON) {
      const feature = poisGeoJSON.features.find(
        (f) => f.properties?.linked_asset_id === highlightAssetId,
      );
      if (feature && feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates as [number, number];
        const p = feature.properties!;
        setSelected({
          label: p.label ?? p.poi_type,
          poi_type: p.poi_type,
          building: p.building ?? null,
          level_name: p.level_name ?? null,
          notes: p.notes ?? null,
          linked_asset_id: p.linked_asset_id ?? null,
        });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 19, duration: 800 });
        return;
      }
    }
    // No linked POI — fly to the asset's own coordinates and drop a highlight marker.
    if (highlightCoords && mapRef.current) {
      highlightMarkerRef.current?.remove();
      const el = document.createElement('div');
      el.style.cssText = [
        'width:20px', 'height:20px', 'border-radius:50%',
        'background:#f59e0b', 'border:3px solid #fff',
        'box-shadow:0 0 0 3px #f59e0b,0 2px 6px rgba(0,0,0,.4)',
        'animation:cmc-pulse 1.5s ease-in-out infinite',
      ].join(';');
      if (!document.getElementById('cmc-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'cmc-pulse-style';
        style.textContent = '@keyframes cmc-pulse{0%,100%{box-shadow:0 0 0 3px #f59e0b,0 2px 6px rgba(0,0,0,.4)}50%{box-shadow:0 0 0 8px rgba(245,158,11,.2),0 2px 6px rgba(0,0,0,.4)}}';
        document.head.appendChild(style);
      }
      highlightMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(highlightCoords)
        .addTo(mapRef.current);
      mapRef.current.flyTo({ center: highlightCoords, zoom: 19, duration: 800 });
    }
    return () => { highlightMarkerRef.current?.remove(); highlightMarkerRef.current = null; };
  }, [highlightAssetId, poisGeoJSON, highlightCoords, mapLoaded]);

  // When DB building footprints arrive, push them to the map source (if it exists yet).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('buildings');
    if (!src || !('setData' in src)) return;
    (src as { setData(d: GeoJSON.FeatureCollection): void }).setData(
      buildingsGeoJSON ?? { type: 'FeatureCollection', features: [] },
    );
  }, [buildingsGeoJSON]);

  // When DB floor outlines arrive, push them to the map source (if it exists yet).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('floors');
    if (!src || !('setData' in src)) return;
    (src as { setData(d: GeoJSON.FeatureCollection): void }).setData(
      floorsGeoJSON ?? { type: 'FeatureCollection', features: [] },
    );
  }, [floorsGeoJSON]);

  // Apply the level filter to POIs, floor outlines, and image overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('poi')) return;

    map.setFilter('poi', buildPoiFilter(level, hiddenTypesRef.current) as Parameters<typeof map.setFilter>[1]);

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

  // Re-apply the POI filter when hidden types change (level read from ref to avoid re-running floor logic).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('poi')) return;
    map.setFilter('poi', buildPoiFilter(levelRef.current, hiddenTypes) as Parameters<typeof map.setFilter>[1]);
  }, [hiddenTypes]);

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

      {/* POI category filter panel */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-xs shadow">
        <div className="mb-1.5 font-semibold text-slate-600">Show on map</div>
        {Object.entries(POI_COLORS).map(([type, color]) => {
          const hidden = hiddenTypes.has(type);
          return (
            <label key={type} className="flex cursor-pointer items-center gap-1.5 py-0.5 text-slate-600 hover:text-slate-900">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-opacity"
                style={{ background: color, opacity: hidden ? 0.25 : 1 }}
              />
              <input
                type="checkbox"
                className="sr-only"
                checked={!hidden}
                onChange={() => {
                  setHiddenTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    return next;
                  });
                }}
              />
              <span className={hidden ? 'line-through opacity-40' : ''}>
                {POI_LABELS[type] ?? type}
              </span>
            </label>
          );
        })}
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
