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
const outDir = join(repoRoot, 'screenshots');
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
  { name: '01-dashboard', path: '/' },
  { name: '02-requests', path: '/requests' },
  { name: '03-work-orders-board', path: '/work-orders' },
  { name: '04-work-order-new', path: '/work-orders', clicks: ['New work order'] },
  { name: '05-work-order-triage', path: '/work-orders', clicks: ['Sanctuary AC short-cycling'] },
  { name: '06-assets', path: '/assets' },
  { name: '07-asset-detail', path: '/assets', clicks: ['RTU-1 Rooftop Unit'] },
  { name: '08-asset-log-work', path: '/assets', clicks: ['RTU-1 Rooftop Unit', 'Log work'] },
  {
    name: '09-work-order-photos',
    path: '/assets',
    clicks: ['RTU-1 Rooftop Unit', 'Annual HVAC service'],
  },
  { name: '10-buildings', path: '/buildings' },
];

async function clickByText(page, text) {
  const clicked = await page.evaluate((t) => {
    // Prefer a button/link; fall back to any element (e.g. a clickable table
    // row cell) — a real DOM click bubbles to React's delegated handler.
    const all = [...document.querySelectorAll('button, a, td, [role=button]')];
    let el = all.find(
      (e) => (e.tagName === 'BUTTON' || e.tagName === 'A') && (e.textContent || '').trim().includes(t),
    );
    if (!el) el = all.find((e) => (e.textContent || '').includes(t));
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, text);
  if (!clicked) throw new Error(`clickable "${text}" not found`);
  await new Promise((r) => setTimeout(r, 450));
}

async function main() {
  await new Promise((r) => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}`;

  const puppeteer = (await import('puppeteer-core')).default;
  let executablePath = process.env.CHROMIUM_PATH;
  let extraArgs = ['--no-sandbox'];
  if (!executablePath) {
    const chromium = (await import('@sparticuz/chromium')).default;
    executablePath = await chromium.executablePath();
    extraArgs = [...chromium.args, '--no-sandbox'];
  }

  const browser = await puppeteer.launch({ executablePath, args: extraArgs, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 3 });

  for (const shot of shots) {
    await page.goto(base + shot.path, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400)); // let React Query settle
    for (const text of shot.clicks || []) await clickByText(page, text);
    const file = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file });
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
