import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import maplibregl, {
  type ExpressionSpecification,
  type Map as MlMap,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { levelLabel, poiLevelFilter, type Level } from '../lib/map-utils';

interface SelectedPoi {
  label: string;
  poi_type: string;
  building: string | null;
  level_name: string | null;
  notes: string | null;
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
}: {
  facility?: string;
  assets?: { id: string; name: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [level, setLevel] = useState<Level>('site');
  const [levels, setLevels] = useState<number[]>([]);
  const [selected, setSelected] = useState<SelectedPoi | null>(null);
  const base = `${import.meta.env.BASE_URL}facilities/${facility}`;
  // POIs are named after their asset (e.g. "AC16A"); link by label.
  const assetIdByName = new Map(assets.map((a) => [a.name, a.id]));

  useEffect(() => {
    if (!containerRef.current) return;
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
      const [buildings, areas, pois, meta] = await Promise.all([
        fetch(`${base}/buildings.geojson`).then((r) => r.json()),
        fetch(`${base}/areas.geojson`).then((r) => r.json()),
        fetch(`${base}/pois.geojson`).then((r) => r.json()),
        fetch(`${base}/meta.json`)
          .then((r) => r.json())
          .catch(() => ({})),
      ]);

      // Optional subtle satellite basemap — grayscale + faded so it reads as
      // ground context behind the vectors, not a competing layer. Church-specific
      // (configured per facility in meta.json, plan §7.6); generic in code.
      if (meta?.basemap_tiles) {
        const tilesUrl: string = /^https?:\/\//.test(meta.basemap_tiles)
          ? meta.basemap_tiles
          : `${base}/${meta.basemap_tiles}`;
        map.addSource('satellite', {
          type: 'raster',
          tiles: [tilesUrl],
          tileSize: 256,
          minzoom: meta.basemap_minzoom ?? 0,
          maxzoom: meta.basemap_maxzoom ?? 22,
          attribution: meta.basemap_attribution ?? '',
        });
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
        el.textContent = f.properties.name;
        new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map);
      }

      // POI click → React detail card (links through to the asset record).
      map.on('click', 'poi', (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        setSelected({
          label: p.label ?? p.poi_type,
          poi_type: p.poi_type,
          building: p.building ?? null,
          level_name: p.level_name ?? null,
          notes: p.notes ?? null,
        });
      });
      map.on('mouseenter', 'poi', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'poi', () => (map.getCanvas().style.cursor = ''));

      // Fit to the campus.
      const b = new maplibregl.LngLatBounds();
      for (const f of buildings.features)
        for (const ring of f.geometry.coordinates) for (const c of ring) b.extend(c);
      map.fitBounds(b, { padding: 60, duration: 0 });

      // Discover levels present in the POI data.
      const lv = [...new Set(pois.features.map((f: GeoJSON.Feature) => f.properties?.level))]
        .filter((x): x is number => typeof x === 'number')
        .sort((a, b) => a - b);
      setLevels(lv);

      // Expose for the screenshot harness (project a POI → pixel to click it).
      if (import.meta.env.VITE_DEMO) {
        (window as unknown as { __cmcMap?: MlMap; __cmcPois?: unknown }).__cmcMap = map;
        (window as unknown as { __cmcMap?: MlMap; __cmcPois?: unknown }).__cmcPois = pois;
      }
    });

    return () => map.remove();
  }, [base]);

  // Apply the level filter to POIs (and areas show only at Site).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('poi')) return;
    map.setFilter('poi', poiLevelFilter(level) as Parameters<typeof map.setFilter>[1]);
    const areaVis = level === 'site' ? 'visible' : 'none';
    if (map.getLayer('area-fill')) map.setLayoutProperty('area-fill', 'visibility', areaVis);
    if (map.getLayer('area-line')) map.setLayoutProperty('area-line', 'visibility', areaVis);
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
            {l === 'site' ? 'Site' : levelLabel(l)}
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
          {assetIdByName.get(selected.label) ? (
            <Link
              to={`/assets/${assetIdByName.get(selected.label)}`}
              className="mt-3 inline-block rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              Open asset record →
            </Link>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No linked asset.</p>
          )}
        </div>
      )}
    </div>
  );
}
