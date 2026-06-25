#!/usr/bin/env node
/**
 * Import building footprints and floor geo_corners from static map-data files
 * into the live Supabase database, matching by name. Safe to re-run — updates
 * only the geometry columns and leaves everything else untouched.
 *
 *   node scripts/import-geo.mjs [facility]
 *
 * Defaults to "midwaypca". Reads:
 *   map-data/facilities/<facility>/buildings.geojson  → buildings.footprint_geojson
 *   map-data/facilities/<facility>/floors.json        → floors.geo_corners_geojson
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env or the environment.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js/dist/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load .env if not already set
if (!process.env.SUPABASE_URL) {
  try {
    const { readFileSync: rfs } = await import('node:fs');
    const env = rfs(join(ROOT, '.env'), 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* no .env */ }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✖ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const facility = process.argv[2] ?? 'midwaypca';
const facilityDir = join(ROOT, 'map-data', 'facilities', facility);

const db = createClient(url, key, { auth: { persistSession: false } });

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

async function run() {
  // --- Buildings ---
  const buildingsGeoJSON = JSON.parse(
    readFileSync(join(facilityDir, 'buildings.geojson'), 'utf8'),
  );

  // Fetch all buildings from DB (name → id)
  const { data: dbBuildings, error: bFetchErr } = await db.from('buildings').select('id, name');
  if (bFetchErr) fail(`fetch buildings: ${bFetchErr.message}`);

  const buildingIdByName = new Map(dbBuildings.map((b) => [b.name, b.id]));
  const buildingIdByCode = new Map(); // will fill if needed

  let bUpdated = 0, bSkipped = 0, bMissing = 0;
  for (const feature of buildingsGeoJSON.features) {
    const name = feature.properties?.name;
    const geometry = feature.geometry;
    if (!name || !geometry) continue;

    const id = buildingIdByName.get(name);
    if (!id) {
      console.log(`  ! building not in DB, skipping: "${name}"`);
      bMissing++;
      // Store code→id mapping for floor upsert
      continue;
    }
    // Store code for floor matching
    if (feature.properties?.code) buildingIdByCode.set(feature.properties.code, id);

    const { error } = await db
      .from('buildings')
      .update({ footprint_geojson: geometry })
      .eq('id', id);
    if (error) fail(`update building "${name}": ${error.message}`);
    console.log(`  ✓ building footprint: "${name}"`);
    bUpdated++;
  }

  // Also populate buildingIdByCode for buildings we found
  for (const feature of buildingsGeoJSON.features) {
    const name = feature.properties?.name;
    const code = feature.properties?.code;
    if (name && code) {
      const id = buildingIdByName.get(name);
      if (id) buildingIdByCode.set(code, id);
    }
  }

  console.log(`\nBuildings: ${bUpdated} updated, ${bSkipped} skipped, ${bMissing} not in DB\n`);

  // --- Floors ---
  const floors = JSON.parse(readFileSync(join(facilityDir, 'floors.json'), 'utf8'));

  // Fetch all floors from DB
  const { data: dbFloors, error: fFetchErr } = await db
    .from('floors')
    .select('id, building_id, name, level');
  if (fFetchErr) fail(`fetch floors: ${fFetchErr.message}`);

  let fUpdated = 0, fSkipped = 0, fMissing = 0;
  for (const floor of floors) {
    const { building: buildingName, building_code: code, name, level, geo_corners_geojson } = floor;
    if (!geo_corners_geojson) { fSkipped++; continue; }

    // Resolve building id by name first, then by code
    const buildingId = buildingIdByName.get(buildingName) ?? buildingIdByCode.get(code);
    if (!buildingId) {
      console.log(`  ! building not in DB for floor "${name}" (${buildingName}), skipping`);
      fMissing++;
      continue;
    }

    // Match floor by building_id + level (most reliable)
    const dbFloor = dbFloors.find(
      (f) => f.building_id === buildingId && f.level === level,
    ) ?? dbFloors.find(
      (f) => f.building_id === buildingId && f.name === name,
    );

    if (!dbFloor) {
      console.log(`  ! floor not in DB: "${buildingName} / ${name}" (level ${level}), skipping`);
      fMissing++;
      continue;
    }

    const { error } = await db
      .from('floors')
      .update({ geo_corners_geojson })
      .eq('id', dbFloor.id);
    if (error) fail(`update floor "${name}": ${error.message}`);
    console.log(`  ✓ floor corners: "${buildingName} / ${name}" (level ${level})`);
    fUpdated++;
  }

  console.log(`\nFloors: ${fUpdated} updated, ${fSkipped} skipped, ${fMissing} not in DB`);
  console.log('\nDone. Reload the map to see the updated geometry.');
}

run().catch((e) => fail(String(e)));
