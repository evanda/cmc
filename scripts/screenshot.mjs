/**
 * Screenshot harness for async/headless review of the web app.
 *
 *   pnpm --filter @cmc/web build   # with VITE_DEMO=1 for populated screens
 *   VITE_DEMO=1 pnpm --filter @cmc/web build
 *   pnpm screenshots
 *
 * Serves apps/web/dist (SPA fallback) and drives a headless Chromium to capture
 * key screens into ./screenshots. Designed for restricted networks: it uses the
 * npm-delivered @sparticuz/chromium binary (no browser CDN download). Set
 * CHROMIUM_PATH to use a system Chrome/Chromium instead.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const distDir = join(repoRoot, 'apps/web/dist');
const SHOT_SET = process.env.SHOT_SET || 'sample';
const outDir = join(repoRoot, SHOT_SET === 'midway' ? 'screenshots/midway' : 'screenshots');
const PORT = Number(process.env.SHOT_PORT || 4178);

if (!existsSync(join(distDir, 'index.html'))) {
  console.error(`✖ ${distDir}/index.html not found. Build first:\n` +
    `    VITE_DEMO=1 pnpm --filter @cmc/web build`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

// Static server with SPA fallback to index.html.
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = join(distDir, urlPath);
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      filePath = join(distDir, 'index.html');
      body = await readFile(filePath);
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

// Screens to capture. `clicks` are button texts pressed (in order) before the shot.
const shots = [
  { name: '00-map-site', path: '/map', wait: 3000 },
  { name: '00-map-basement', path: '/map', wait: 2500, clicks: ['B1'] },
  { name: '01-dashboard', path: '/' },
  { name: '02-requests', path: '/requests' },
  { name: '03-work-orders-board', path: '/work-orders' },
  { name: '04-work-orders-list', path: '/work-orders', clicks: ['list'] },
  { name: '05-work-orders-calendar', path: '/work-orders', clicks: ['calendar'] },
  { name: '06-vendors', path: '/vendors' },
  { name: '07-assets', path: '/assets' },
  { name: '08-asset-detail', path: '/assets', clicks: ['RTU-1 Rooftop Unit'] },
  { name: '09-qr-label', path: '/assets', clicks: ['RTU-1 Rooftop Unit', 'QR label'] },
];

// Real-instance shots for VITE_DEMO=midway.
const midwayShots = [
  { name: '01-map-site', path: '/map', wait: 4000 },
  { name: '02-map-basement', path: '/map', wait: 4500, clicks: ['B1'] },
  { name: '03-map-poi-card', path: '/map', wait: 4500, clicks: ['B1'], mapPoiLevel: -1 },
  { name: '03-dashboard', path: '/' },
  { name: '04-assets', path: '/assets' },
  { name: '05-buildings', path: '/buildings' },
  { name: '06-asset-detail', path: '/assets', clicks: ['HP9'] },
  { name: '07-users', path: '/users' },
];

const activeShots = SHOT_SET === 'midway' ? midwayShots : shots;

async function clickByText(page, text) {
  const tryClick = (t) =>
    page.evaluate((t) => {
      // Prefer a button/link; fall back to any element (e.g. a clickable table
      // row cell) — a real DOM click bubbles to React's delegated handler.
      const all = [...document.querySelectorAll('button, a, td, [role=button]')];
      let el = all.find(
        (e) =>
          (e.tagName === 'BUTTON' || e.tagName === 'A') && (e.textContent || '').trim() === t,
      );
      if (!el)
        el = all.find(
          (e) =>
            (e.tagName === 'BUTTON' || e.tagName === 'A') &&
            (e.textContent || '').trim().includes(t),
        );
      if (!el) el = all.find((e) => (e.textContent || '').includes(t));
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, t);

  // Poll up to ~12s so async loads (e.g. the map's level buttons) can appear.
  let clicked = false;
  for (let i = 0; i < 48 && !clicked; i++) {
    clicked = await tryClick(text);
    if (!clicked) await new Promise((r) => setTimeout(r, 250));
  }
  if (!clicked) throw new Error(`clickable "${text}" not found`);
  await new Promise((r) => setTimeout(r, 600));
}

async function main() {
  await new Promise((r) => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}`;

  const puppeteer = (await import('puppeteer-core')).default;
  // WebGL flags so MapLibre renders headless (SwiftShader).
  const webglArgs = ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
  let executablePath = process.env.CHROMIUM_PATH;
  let extraArgs = ['--no-sandbox', ...webglArgs];
  if (!executablePath) {
    const chromium = (await import('@sparticuz/chromium')).default;
    executablePath = await chromium.executablePath();
    extraArgs = [...chromium.args, '--no-sandbox', ...webglArgs];
  }

  const browser = await puppeteer.launch({ executablePath, args: extraArgs, headless: true });

  // Fresh page per shot — a MapLibre WebGL context per page avoids SwiftShader
  // context exhaustion across repeated map loads.
  for (const shot of activeShots) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 3 });
    await page.goto(base + shot.path, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, shot.wait ?? 400)); // settle (maps need longer)
    for (const text of shot.clicks || []) await clickByText(page, text);
    if (shot.mapPoiLevel !== undefined) {
      await new Promise((r) => setTimeout(r, 600));
      const pt = await page.evaluate((lvl) => {
        const w = window;
        const map = w.__cmcMap;
        const pois = w.__cmcPois;
        if (!map || !pois) return null;
        const f = pois.features.find((x) => x.properties.level === lvl);
        if (!f) return null;
        const p = map.project(f.geometry.coordinates);
        const r = map.getCanvas().getBoundingClientRect();
        return { x: r.left + p.x, y: r.top + p.y };
      }, shot.mapPoiLevel);
      if (pt) {
        await page.mouse.click(pt.x, pt.y);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    await page.close();
    console.log(`✓ ${shot.name}.png`);
  }

  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
