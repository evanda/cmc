/**
 * seed-assets-from-pois — back the map's equipment POIs with real asset records,
 * carrying intrinsic map coordinates (plan §5.4; issues #37, #38).
 *
 *   pnpm assets:seed [facility]      (default: midwaypca)
 *
 * For each Point feature in map-data/facilities/<id>/pois.geojson it upserts an
 * `assets` row: name = the POI label, category by poi_type, criticality by type,
 * and geometry_geojson + level copied straight from the POI. Idempotent — matches
 * an existing (non-deleted) asset by name and updates it, else inserts.
 *
 * Why a script and not the reset-seed fixture: the fixtures seed only
 * org/buildings/floors/locations, and the live DB the web app talks to has no
 * asset rows for the 52 HVAC units. This makes "click AC1 on the map → open its
 * asset / file a work order" (#37) work against the real backend, not just demo.
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role bypasses
 * RLS for seeding) — auto-loaded from the repo-root .env like reset-seed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCmcClient } from '@cmc/shared';

if (!process.env.SUPABASE_URL) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* no .env — rely on the ambient environment */
  }
}

// supabase-js constructs a Realtime client needing a global WebSocket; Node < 22
// ships none. Seeding never opens a channel — this just satisfies the constructor.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (globalThis as { WebSocket?: unknown }).WebSocket = require('ws').WebSocket;
}

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// poi_type → seeded asset_categories.name (migration 0003); criticality default.
const CATEGORY_BY_POI_TYPE: Record<string, string> = {
  hvac: 'HVAC',
  shutoff: 'Plumbing',
  network_hardware: 'Network/IT',
  sound_system: 'Sound/AV',
  fountain: 'Plumbing',
  fire_extinguisher: 'Utility/Infrastructure',
};
const CRITICALITY_BY_POI_TYPE: Record<string, 'low' | 'medium' | 'high'> = {
  shutoff: 'high',
  fire_extinguisher: 'high',
  hvac: 'medium',
};

const facility = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'midwaypca';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');

const poisPath = resolve('map-data/facilities', facility, 'pois.geojson');
let pois: { features: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }[] };
try {
  pois = JSON.parse(readFileSync(poisPath, 'utf8'));
} catch {
  fail(`Could not read ${poisPath}`);
}

const db = createCmcClient({ url, key });

async function seed() {
  console.log(`→ seeding assets from ${facility}/pois.geojson (${pois.features.length} POIs)…`);

  // category name → id (seeded by migration 0003).
  const { data: cats, error: catErr } = await db.from('asset_categories').select('id, name');
  if (catErr) fail(`asset_categories read failed: ${catErr.message}`);
  const catIdByName = new Map((cats ?? []).map((c) => [c.name, c.id]));

  let inserted = 0;
  let updated = 0;
  for (const f of pois.features) {
    const label = (f.properties.label as string) ?? null;
    if (!label) continue;
    const poiType = (f.properties.poi_type as string) ?? 'hvac';
    const row = {
      name: label,
      category_id: catIdByName.get(CATEGORY_BY_POI_TYPE[poiType] ?? 'Utility/Infrastructure') ?? null,
      criticality: CRITICALITY_BY_POI_TYPE[poiType] ?? 'low',
      status: 'active' as const,
      notes: (f.properties.notes as string) ?? null,
      geometry_geojson: { type: 'Point', coordinates: f.geometry.coordinates },
      level: typeof f.properties.level === 'number' ? f.properties.level : null,
    };

    const { data: existing, error: exErr } = await db
      .from('assets')
      .select('id')
      .eq('name', label)
      .is('deleted_at', null)
      .maybeSingle();
    if (exErr) fail(`lookup "${label}" failed: ${exErr.message}`);

    if (existing) {
      const { error } = await db.from('assets').update(row).eq('id', existing.id);
      if (error) fail(`update "${label}" failed: ${error.message}`);
      updated++;
    } else {
      const { error } = await db.from('assets').insert(row);
      if (error) fail(`insert "${label}" failed: ${error.message}`);
      inserted++;
    }
  }

  console.log(`✓ assets seeded for "${facility}": ${inserted} inserted, ${updated} updated.`);

  // ── Phase 2: seed the `pois` table, linking each row to its seeded asset ──
  console.log(`→ seeding pois table from ${facility}/pois.geojson…`);

  const { data: seededAssets, error: asErr } = await db
    .from('assets')
    .select('id, name')
    .is('deleted_at', null);
  if (asErr) fail(`assets read failed: ${asErr.message}`);
  const assetIdByName = new Map((seededAssets ?? []).map((a) => [a.name, a.id]));

  // Best-effort: match buildings by exact name so building_id FK resolves when
  // buildings were seeded with names matching the GeoJSON `building` property.
  const { data: seededBuildings, error: bldErr } = await db
    .from('buildings')
    .select('id, name')
    .is('deleted_at', null);
  if (bldErr) fail(`buildings read failed: ${bldErr.message}`);
  const buildingIdByName = new Map((seededBuildings ?? []).map((b) => [b.name, b.id]));

  let poisInserted = 0;
  let poisUpdated = 0;
  for (const f of pois.features) {
    const label = (f.properties.label as string) ?? null;
    if (!label) continue;

    const poiType = (f.properties.poi_type as string) ?? 'hvac';
    const buildingName = (f.properties.building as string) ?? null;
    const level = typeof f.properties.level === 'number' ? f.properties.level : null;

    const row = {
      geometry_geojson: { type: 'Point', coordinates: f.geometry.coordinates },
      poi_type: poiType,
      label,
      icon: (f.properties.icon as string) ?? null,
      notes: (f.properties.notes as string) ?? null,
      level,
      building_id: buildingName ? (buildingIdByName.get(buildingName) ?? null) : null,
      floor_id: null as string | null,
      linked_asset_id: assetIdByName.get(label) ?? null,
    };

    const { data: existing, error: exErr } = await db
      .from('pois')
      .select('id')
      .eq('label', label)
      .is('deleted_at', null)
      .maybeSingle();
    if (exErr) fail(`pois lookup "${label}" failed: ${exErr.message}`);

    if (existing) {
      const { error } = await db.from('pois').update(row).eq('id', existing.id);
      if (error) fail(`pois update "${label}" failed: ${error.message}`);
      poisUpdated++;
    } else {
      const { error } = await db.from('pois').insert(row);
      if (error) fail(`pois insert "${label}" failed: ${error.message}`);
      poisInserted++;
    }
  }

  console.log(`✓ pois seeded for "${facility}": ${poisInserted} inserted, ${poisUpdated} updated.`);
}

seed().catch((e) => fail(String(e)));
