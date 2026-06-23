import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type ExpressionSpecification,
  type Map as MlMap,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Single-map, level-switchable indoor model (plan §5). No external tiles — a
// neutral background + georeferenced footprints/POIs renders fully offline.
const POI_COLORS: Record<string, string> = {
  hvac: '#0d9488',
  shutoff: '#dc2626',
  network_hardware: '#2563eb',
  sound_system: '#7c3aed',
  fountain: '#0891b2',
  fire_extinguisher: '#ea580c',
};

type Level = 'site' | number;

export function MapView({ facility = 'midwaypca' }: { facility?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [level, setLevel] = useState<Level>('site');
  const [levels, setLevels] = useState<number[]>([]);
  const base = `${import.meta.env.BASE_URL}facilities/${facility}`;

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
      const [buildings, areas, pois] = await Promise.all([
        fetch(`${base}/buildings.geojson`).then((r) => r.json()),
        fetch(`${base}/areas.geojson`).then((r) => r.json()),
        fetch(`${base}/pois.geojson`).then((r) => r.json()),
      ]);

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

      // POI popups on click.
      map.on('click', 'poi', (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat((e.features![0].geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font:13px sans-serif;max-width:220px">
               <strong>${p.label ?? p.poi_type}</strong><br/>
               <span style="color:#64748b">${p.building ?? ''}${p.level_name ? ' · ' + p.level_name : ''}</span>
               ${p.notes ? `<div style="margin-top:4px;color:#475569">${p.notes}</div>` : ''}
             </div>`,
          )
          .addTo(map);
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
    });

    return () => map.remove();
  }, [base]);

  // Apply the level filter to POIs (and areas show only at Site).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('poi')) return;
    map.setFilter('poi', level === 'site' ? null : ['==', ['get', 'level'], level]);
    const areaVis = level === 'site' ? 'visible' : 'none';
    if (map.getLayer('area-fill')) map.setLayoutProperty('area-fill', 'visibility', areaVis);
    if (map.getLayer('area-line')) map.setLayoutProperty('area-line', 'visibility', areaVis);
  }, [level]);

  const levelLabel = (n: number) => (n < 0 ? `B${-n}` : String(n));

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
    </div>
  );
}
