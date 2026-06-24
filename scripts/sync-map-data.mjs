#!/usr/bin/env node
/**
 * Sync per-facility map data into the web app's served static dir.
 *
 * Single source of truth: map-data/facilities/<id>/   (version-controlled, authored)
 * Generated artifact:     apps/web/public/facilities/<id>/   (gitignored, what the app fetches)
 *
 * The browser can only fetch files under the web app's public/ root, so the
 * authored GeoJSON has to land there. Rather than keep a hand-copied second copy
 * in git (which silently drifts), we regenerate public/ from map-data/ on every
 * `dev` and `build`. Edit the GeoJSON in ONE place — map-data/ — and that's it.
 *
 * Copies only runtime files (*.geojson, *.json, and a tiles/ cache if present);
 * authoring scratch (CSVs, etc.) stays out of the shipped app.
 *
 * Usage: node scripts/sync-map-data.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'map-data', 'facilities');
const DST = join(ROOT, 'apps', 'web', 'public', 'facilities');

const RUNTIME_EXT = ['.geojson', '.json'];

if (!existsSync(SRC)) {
  console.error(`sync-map-data: source not found: ${SRC}`);
  process.exit(1);
}

// Rebuild the destination from scratch so deletions in the source propagate.
rmSync(DST, { recursive: true, force: true });

let facilities = 0;
let files = 0;
for (const id of readdirSync(SRC)) {
  const srcDir = join(SRC, id);
  if (!statSync(srcDir).isDirectory()) continue;
  const dstDir = join(DST, id);
  mkdirSync(dstDir, { recursive: true });
  facilities++;

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === 'tiles') {
      // Cached basemap tiles — copy the whole pyramid through.
      cpSync(join(srcDir, 'tiles'), join(dstDir, 'tiles'), { recursive: true });
      continue;
    }
    if (entry.isFile() && RUNTIME_EXT.some((ext) => entry.name.endsWith(ext))) {
      cpSync(join(srcDir, entry.name), join(dstDir, entry.name));
      files++;
    }
  }
}

console.log(`sync-map-data: ${files} files across ${facilities} facility(ies) → ${DST}`);
