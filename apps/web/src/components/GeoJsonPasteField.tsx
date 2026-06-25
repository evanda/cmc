import { useState } from 'react';
import { Button, Field, inputClass } from './ui';

/**
 * Two-step spatial field:
 * 1. A link opens geojson.io pre-seeded with existing geometry (if any).
 * 2. The user pastes the GeoJSON back; we validate and call onChange.
 *
 * Accepts any GeoJSON object but callers can enforce shape via `validate`.
 */
export function GeoJsonPasteField({
  label,
  hint,
  value,
  onChange,
  validate,
}: {
  label: string;
  hint?: string;
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
  /** Return an error string if the parsed GeoJSON is wrong shape, or null if ok. */
  validate?: (v: Record<string, unknown>) => string | null;
}) {
  const [raw, setRaw] = useState(value ? JSON.stringify(value, null, 2) : '');
  const [error, setError] = useState<string | null>(null);

  const geojsonIoUrl = value
    ? `https://geojson.io/#data=data:application/json,${encodeURIComponent(JSON.stringify(value))}`
    : 'https://geojson.io/';

  function handleChange(text: string) {
    setRaw(text);
    if (!text.trim()) {
      onChange(null);
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
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
          placeholder='Paste GeoJSON here after drawing on geojson.io…'
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
    </Field>
  );
}
