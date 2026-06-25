import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type PlacedPoint = { lng: number; lat: number; level: number };

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function LocationPicker({
  value,
  onChange,
  levels = [],
  center,
}: {
  value: PlacedPoint | null;
  onChange: (v: PlacedPoint | null) => void;
  levels?: number[];
  /** [lng, lat] fallback center when no pin is placed yet. */
  center?: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  // Ref so drag/click closures always see the latest onChange + activeLevel.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [activeLevel, setActiveLevel] = useState(value?.level ?? (levels[0] ?? 1));
  const activeLevelRef = useRef(activeLevel);
  activeLevelRef.current = activeLevel;

  useEffect(() => {
    if (!containerRef.current) return;
    const initialCenter: [number, number] = value
      ? [value.lng, value.lat]
      : (center ?? [-80.428, 36.09]);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: initialCenter,
      zoom: value ? 18 : 16,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    mapRef.current = map;

    function addMarker(lng: number, lat: number) {
      const m = new maplibregl.Marker({ draggable: true, color: '#0ea5e9' })
        .setLngLat([lng, lat])
        .addTo(map);
      m.on('dragend', () => {
        const p = m.getLngLat();
        onChangeRef.current({ lng: p.lng, lat: p.lat, level: activeLevelRef.current });
      });
      markerRef.current = m;
    }

    if (value) addMarker(value.lng, value.lat);

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      if (!markerRef.current) {
        addMarker(lng, lat);
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }
      onChangeRef.current({ lng, lat, level: activeLevelRef.current });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // mount-only — value/center used as initial state only

  function handleLevelChange(l: number) {
    setActiveLevel(l);
    activeLevelRef.current = l;
    if (markerRef.current) {
      const p = markerRef.current.getLngLat();
      onChangeRef.current({ lng: p.lng, lat: p.lat, level: l });
    }
  }

  function handleClear() {
    markerRef.current?.remove();
    markerRef.current = null;
    onChangeRef.current(null);
  }

  return (
    <div className="space-y-1.5">
      <div ref={containerRef} className="h-52 w-full rounded border border-slate-300" />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {value
            ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`
            : 'Click the map to place a pin'}
        </span>
        <div className="flex items-center gap-3">
          {levels.length > 0 && (
            <label className="flex items-center gap-1">
              Floor:
              <select
                className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                value={activeLevel}
                onChange={(e) => handleLevelChange(Number(e.target.value))}
              >
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l < 0 ? `B${-l}` : l === 0 ? 'Ground' : `Floor ${l}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-red-500 hover:text-red-700"
            >
              Clear pin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
