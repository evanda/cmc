#!/usr/bin/env node
/**
 * Local helper for the guided asset-placement tool (place.html).
 *
 * Serves the map-data/ directory (so place.html, the vendored MapLibre, and each
 * facility's GeoJSON load) AND exposes POST /save?facility=<id>, which writes the
 * edited POI FeatureCollection straight back to
 * facilities/<id>/pois.geojson — the single source of truth. The web app picks
 * it up on the next `pnpm dev` / `pnpm build` (scripts/sync-map-data.mjs).
 *
 *   node map-data/place-server.mjs            # then open the printed URL
 *   PORT=8123 node map-data/place-server.mjs
 *
 * Binds to localhost only. A one-deep backup (pois.geojson.bak) is written before
 * each overwrite; git is your real safety net.
 */
import http from 'node:http';
import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url)); // map-data/
const PORT = Number(process.env.PORT || 8000);
const FACILITY_RE = /^[a-z0-9_-]+$/i;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ── write-back endpoint ──────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/save') {
    const facility = url.searchParams.get('facility') || '';
    if (!FACILITY_RE.test(facility)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'bad facility id' }));
    }
    try {
      const body = await readBody(req);
      const fc = JSON.parse(body);
      if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
        throw new Error('not a FeatureCollection');
      }
      const dest = join(ROOT, 'facilities', facility, 'pois.geojson');
      await access(dest).then(
        () => copyFile(dest, dest + '.bak'),
        () => {}, // first write — nothing to back up
      );
      await writeFile(dest, JSON.stringify(fc, null, 2) + '\n');
      console.log(`saved ${fc.features.length} features → facilities/${facility}/pois.geojson`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, count: fc.features.length }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
  }

  // ── static files ─────────────────────────────────────────────────────────
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/place.html';
  const filePath = normalize(join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Asset placement tool:  http://localhost:${PORT}/place.html`);
  console.log(`  (saves write back to map-data/facilities/<id>/pois.geojson)\n`);
});
