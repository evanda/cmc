import { useState } from 'react';
import { Button, Field, inputClass } from './ui';

/** Compute [lng, lat] centroid of a GeoJSON Polygon's outer ring. */
function polygonCentroid(coords: number[][][]): [number, number] | null {
  const ring = coords[0];
  if (!ring?.length) return null;
  const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

/**
 * Two-step spatial field:
 * 1. A link opens geojson.io pre-seeded with existing geometry (if any),
 *    centered on the campus (or the existing geometry's centroid).
 * 2. The user pastes the GeoJSON back; we validate and call onChange.
 */
export function GeoJsonPasteField({
  label,
  hint,
  value,
  onChange,
  validate,
  center = [-80.428, 36.09],
  zoom = 17,
}: {
  label: string;
  hint?: string;
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
  /** Return an error string if the parsed GeoJSON is wrong shape, or null if ok. */
  validate?: (v: Record<string, unknown>) => string | null;
  /** [lng, lat] fallback map center when no geometry exists yet. */
  center?: [number, number];
  zoom?: number;
}) {
  const [raw, setRaw] = useState(value ? JSON.stringify(value, null, 2) : '');
  const [error, setError] = useState<string | null>(null);

  // Derive map center: use centroid of existing polygon, else the prop default.
  const mapCenter: [number, number] = (() => {
    if (value) {
      const geom = value['type'] === 'Feature'
        ? (value['geometry'] as Record<string, unknown> | undefined)
        : value;
      if (geom?.['type'] === 'Polygon') {
        const c = polygonCentroid(geom['coordinates'] as number[][][]);
        if (c) return c;
      }
    }
    return center;
  })();

  const mapFragment = `#map=${zoom}/${mapCenter[1]}/${mapCenter[0]}`;
  const geojsonIoUrl = value
    ? `https://geojson.io/${mapFragment}&data=data:application/json,${encodeURIComponent(JSON.stringify(value))}`
    : `https://geojson.io/${mapFragment}`;

  function handleChange(text: string) {
    setRaw(text);
    if (!text.trim()) {
      onChange(null);
      setError(null);
      return;
    }
    try {
      let parsed = JSON.parse(text) as Record<string, unknown>;
      // Auto-unwrap FeatureCollection → first Feature (what geojson.io copies)
      if (parsed['type'] === 'FeatureCollection') {
        const features = parsed['features'] as Record<string, unknown>[] | undefined;
        if (!features?.length) { setError('FeatureCollection is empty'); return; }
        parsed = features[0];
      }
      const validationError = validate ? validate(parsed) : null;
      if (validationError) {
        setError(validationError);
      } else {
        setError(null);
        onChange(parsed);
      }
    } catch {
      setError('Invalid JSON');
    }
  }

  return (
    <Field label={label} error={error ?? undefined}>
      <div className="space-y-1.5">
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        <div className="flex gap-2">
          <a
            href={geojsonIoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-600 hover:underline"
          >
            Open in geojson.io →
          </a>
          {value && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRaw('');
                onChange(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <textarea
          className={inputClass + ' font-mono text-xs'}
          rows={4}
          placeholder='Paste anything from geojson.io — FeatureCollection, Feature, or plain geometry. FeatureCollections are unwrapped to the first feature automatically.'
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
    </Field>
  );
}
