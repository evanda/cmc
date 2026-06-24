#!/usr/bin/env node
/**
 * Import a facility bundle (produced by facility-export.mjs) back into
 * map-data/facilities/.
 *
 *   node scripts/facility-import.mjs <bundle.zip> [--force]
 *
 * The zip must contain a top-level directory named after the facility
 * (e.g. midwaypca/meta.json) — exactly the layout facility-export.mjs
 * produces.
 *
 * By default, the script refuses to overwrite an existing facility.
 * Pass --force to replace it.
 *
 * Use cases:
 *   - Restore a backup.
 *   - Reproduce a user's setup locally for support/debug.
 *   - Import a starter-campus bundle for a new church instance.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const bundlePath = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');

if (!bundlePath) {
  fail('Usage: node scripts/facility-import.mjs <bundle.zip> [--force]');
}

const absBundle = resolve(bundlePath);
if (!existsSync(absBundle)) {
  fail(`Bundle not found: ${absBundle}`);
}

if (!absBundle.endsWith('.zip')) {
  fail(`Expected a .zip file; got: ${basename(absBundle)}`);
}

// Peek at the zip to determine the facility ID (first directory component).
let listing;
try {
  listing = execSync(`unzip -Z1 ${JSON.stringify(absBundle)}`, { encoding: 'utf8' });
} catch {
  fail(`Cannot read zip: ${absBundle}`);
}

const entries = listing.trim().split('\n').filter(Boolean);
if (entries.length === 0) {
  fail('Bundle is empty.');
}

// The facility id is the first path component in every entry.
const ids = new Set(entries.map((e) => e.split('/')[0]));
if (ids.size !== 1) {
  fail(
    `Bundle must contain exactly one top-level directory (facility id). ` +
      `Found: ${[...ids].join(', ')}`,
  );
}
const [facilityId] = ids;

// Verify meta.json is present inside the bundle.
const hasMeta = entries.some((e) => e === `${facilityId}/meta.json`);
if (!hasMeta) {
  fail(`Bundle is missing ${facilityId}/meta.json — not a valid facility bundle.`);
}

const destDir = join(ROOT, 'map-data', 'facilities', facilityId);
if (existsSync(destDir)) {
  if (!force) {
    fail(
      `Facility "${facilityId}" already exists at ${destDir}.\n` +
        `  Re-run with --force to replace it.`,
    );
  }
  console.log(`  removing existing ${destDir} (--force)`);
  rmSync(destDir, { recursive: true, force: true });
}

mkdirSync(destDir, { recursive: true });

const facilitiesDir = join(ROOT, 'map-data', 'facilities');
execSync(`unzip -o ${JSON.stringify(absBundle)} -d ${JSON.stringify(facilitiesDir)}`, {
  stdio: 'inherit',
});

console.log(`\n✓ imported facility "${facilityId}" → ${destDir}`);
console.log(`  viewer: map-data/viewer.html?facility=${facilityId}`);
