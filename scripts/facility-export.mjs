#!/usr/bin/env node
/**
 * Export a facility folder to a portable zip bundle.
 *
 *   node scripts/facility-export.mjs <facility-id> [--out <path>]
 *
 * Bundles map-data/facilities/<id>/ into a self-contained zip:
 *   <id>-facility.zip (or the path given by --out)
 *
 * The bundle includes all GeoJSON/JSON files and any tile caches or
 * floorplan images referenced by floors.json — making it suitable as
 * a backup, a support-repro artefact, or a starter-campus hand-off.
 *
 * Import with: node scripts/facility-import.mjs <bundle.zip>
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const facilityId = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

if (!facilityId) {
  const available = readdirSync(join(ROOT, 'map-data', 'facilities')).filter((d) =>
    statSync(join(ROOT, 'map-data', 'facilities', d)).isDirectory(),
  );
  fail(
    `Usage: node scripts/facility-export.mjs <facility-id> [--out <path>]\n` +
      `Available facilities: ${available.join(', ')}`,
  );
}

const srcDir = join(ROOT, 'map-data', 'facilities', facilityId);
if (!existsSync(srcDir)) {
  fail(`Facility not found: ${srcDir}`);
}

// Verify this looks like a real facility (has meta.json).
if (!existsSync(join(srcDir, 'meta.json'))) {
  fail(`${srcDir} is missing meta.json — not a valid facility directory.`);
}

const bundleName = outPath ? resolve(outPath) : join(ROOT, `${facilityId}-facility.zip`);

// Remove existing bundle so zip doesn't append to stale content.
if (existsSync(bundleName)) {
  execSync(`rm -f ${JSON.stringify(bundleName)}`);
}

// Collect what to include: JSON/GeoJSON files + tiles/ dir + any image files.
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.pmtiles'];
const entries = [];

function collectEntries(dir, relBase) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      collectEntries(join(dir, entry.name), rel);
    } else if (
      entry.name.endsWith('.json') ||
      entry.name.endsWith('.geojson') ||
      IMAGE_EXTS.some((ext) => entry.name.endsWith(ext))
    ) {
      entries.push(rel);
    }
  }
}

collectEntries(srcDir, null);

if (entries.length === 0) {
  fail(`No bundleable files found in ${srcDir}`);
}

// zip works relative to the facilities directory so paths inside the zip are
// <facilityId>/meta.json etc. — the same layout facility-import.mjs expects.
const facilitiesDir = join(ROOT, 'map-data', 'facilities');
const zipEntries = entries.map((e) => `${facilityId}/${e}`).join(' ');
execSync(`cd ${JSON.stringify(facilitiesDir)} && zip -r ${JSON.stringify(bundleName)} ${zipEntries}`, {
  stdio: 'inherit',
});

console.log(`\n✓ exported ${entries.length} files → ${basename(bundleName)}`);
console.log(`  import with: node scripts/facility-import.mjs ${basename(bundleName)}`);
