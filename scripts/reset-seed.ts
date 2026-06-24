/**
 * reset && seed <name> — dev facility-fixture loader (plan §7.6).
 *
 *   pnpm db:seed <fixture> [--no-reset]
 *
 * Steps:
 *   1. (unless --no-reset) `supabase db reset` — drops & re-applies all
 *      migrations to a clean local DB, re-seeding default asset categories.
 *   2. Loads the named fixture (org_settings + buildings → floors → locations)
 *      via a SERVICE-ROLE client (bypasses RLS for seeding).
 *
 * Requires a reachable Supabase + env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (see .env.example). `supabase db reset` additionally needs the Supabase CLI
 * + Docker (the local stack).
 */
import { execSync } from 'node:child_process';
import { createCmcClient } from '@cmc/shared';
import { fixtures, fixtureNames } from '../supabase/seed/fixtures/index.js';

// Auto-load the repo-root .env so `pnpm db:seed` Just Works without exporting
// vars into the shell. process.loadEnvFile (Node ≥ 20.12) doesn't override vars
// already in the environment, so an explicit `export` still wins. Missing file
// (CI / local stack) is fine — ignore and rely on the ambient environment.
if (!process.env.SUPABASE_URL) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* no .env — use whatever is already in the environment */
  }
}

// supabase-js builds a Realtime client whose constructor needs a global
// WebSocket. Node < 22 ships none (Node 20 only behind --experimental-websocket),
// so polyfill from the `ws` package when it's absent. Seeding never opens a
// realtime channel — this just satisfies the constructor. Synchronous require:
// these scripts transpile to CommonJS, where top-level await isn't allowed.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (globalThis as { WebSocket?: unknown }).WebSocket = require('ws').WebSocket;
}

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const noReset = args.includes('--no-reset');

if (!name) {
  fail(`Usage: pnpm db:seed <fixture> [--no-reset]\nAvailable fixtures: ${fixtureNames.join(', ')}`);
}
const fixture = fixtures[name];
if (!fixture) {
  fail(`Unknown fixture "${name}". Available: ${fixtureNames.join(', ')}`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
}

if (!noReset) {
  console.log('→ supabase db reset (re-applying migrations)…');
  try {
    execSync('supabase db reset', { stdio: 'inherit' });
  } catch {
    fail('`supabase db reset` failed (needs the Supabase CLI + Docker). Re-run with --no-reset to seed only.');
  }
}

const db = createCmcClient({ url, key });

async function seed() {
  console.log(`→ seeding fixture "${fixture.key}"…`);

  // Single-row org identity (plan §7.6).
  const { error: orgErr } = await db.from('org_settings').insert({
    facility_name: fixture.org.facility_name,
    address: fixture.org.address ?? null,
    locale: fixture.org.locale ?? 'en-US',
    distance_unit: fixture.org.distance_unit ?? 'mi',
    currency: fixture.org.currency ?? 'USD',
    timezone: fixture.org.timezone ?? 'America/New_York',
  });
  if (orgErr) fail(`org_settings insert failed: ${orgErr.message}`);

  let buildingCount = 0;
  let floorCount = 0;
  let locationCount = 0;

  // "BuildingName::LocationName" → location_id; used when seeding PM schedules.
  const locationIdByKey = new Map<string, string>();

  for (const b of fixture.buildings) {
    const { data: building, error: bErr } = await db
      .from('buildings')
      .insert({ name: b.name, description: b.description ?? null, address: b.address ?? null })
      .select()
      .single();
    if (bErr || !building) fail(`building "${b.name}" insert failed: ${bErr?.message}`);
    buildingCount++;

    const floorIdByName = new Map<string, string>();
    for (const f of b.floors) {
      const { data: floor, error: fErr } = await db
        .from('floors')
        .insert({ building_id: building.id, name: f.name, level: f.level })
        .select()
        .single();
      if (fErr || !floor) fail(`floor "${f.name}" insert failed: ${fErr?.message}`);
      floorIdByName.set(f.name, floor.id);
      floorCount++;
    }

    for (const l of b.locations) {
      const { data: loc, error: lErr } = await db
        .from('locations')
        .insert({
          building_id: building.id,
          floor_id: l.floor ? (floorIdByName.get(l.floor) ?? null) : null,
          name: l.name,
          type: l.type ?? null,
        })
        .select()
        .single();
      if (lErr || !loc) fail(`location "${l.name}" insert failed: ${lErr?.message}`);
      locationIdByKey.set(`${b.name}::${l.name}`, loc.id);
      locationCount++;
    }
  }

  // PM schedules (plan §4.3): task_template + pm_schedule pairs.
  let pmCount = 0;
  const today = new Date().toISOString().split('T')[0];
  for (const pm of fixture.pmSchedules ?? []) {
    let taskTemplateId: string | null = null;
    if (pm.instructions) {
      const { data: tmpl, error: tmplErr } = await db
        .from('task_templates')
        .insert({ name: pm.name, instructions: pm.instructions })
        .select()
        .single();
      if (tmplErr || !tmpl) fail(`task_template "${pm.name}" insert failed: ${tmplErr?.message}`);
      taskTemplateId = tmpl.id;
    }

    const locationId =
      pm.building && pm.location
        ? (locationIdByKey.get(`${pm.building}::${pm.location}`) ?? null)
        : null;

    const { error: pmErr } = await db.from('pm_schedules').insert({
      name: pm.name,
      task_template_id: taskTemplateId,
      trigger_type: pm.trigger_type,
      interval_value: pm.interval_value ?? null,
      interval_unit: pm.interval_unit ?? null,
      fixed_month: pm.fixed_month ?? null,
      fixed_day: pm.fixed_day ?? null,
      lead_time_days: pm.lead_time_days ?? 14,
      advance_from: pm.advance_from ?? 'completion',
      is_compliance: pm.is_compliance ?? false,
      category: pm.category ?? null,
      location_id: locationId,
      anchor_date: today,
      active: true,
    });
    if (pmErr) fail(`pm_schedule "${pm.name}" insert failed: ${pmErr.message}`);
    pmCount++;
  }

  const pmMsg = pmCount > 0 ? `, ${pmCount} PM schedules` : '';
  console.log(
    `✓ seeded "${fixture.key}": ${buildingCount} buildings, ${floorCount} floors, ${locationCount} locations${pmMsg}.`,
  );
}

seed().catch((e) => fail(String(e)));
