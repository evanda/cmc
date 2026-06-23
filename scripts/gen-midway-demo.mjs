/**
 * Generates apps/web/src/data/midwaypca.json — a demo dataset for the real
 * Midway PCA campus, derived from map-data/facilities/midwaypca/*. Lets
 * VITE_DEMO=midway render the app populated with the actual buildings, floors,
 * and HVAC/utility assets (from the map POIs). Re-run if the map data changes:
 *   node scripts/gen-midway-demo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = `${root}/map-data/facilities/midwaypca`;
const rd = (f) => JSON.parse(readFileSync(`${src}/${f}`, 'utf8'));

const meta = rd('meta.json');
const buildingsGeo = rd('buildings.geojson');
const floorsRaw = rd('floors.json');
const pois = rd('pois.geojson');

const buildings = buildingsGeo.features.map((f) => ({
  code: f.properties.code,
  name: f.properties.name,
  description: f.properties.description ?? null,
  footprint: f.geometry,
}));

const floors = floorsRaw.map((fl) => ({
  building: fl.building,
  name: fl.name,
  level: fl.level,
  geo_corners: fl.geo_corners_geojson ?? null,
}));

// One "General" location per building so assets can be placed.
const locations = buildings.map((b) => ({ building: b.name, name: 'General' }));

// Each map POI becomes an asset (HVAC unit / utility shutoff).
const assets = pois.features.map((f) => {
  const p = f.properties;
  const isShutoff = p.poi_type === 'shutoff';
  return {
    name: p.label ?? p.id,
    category: isShutoff ? 'Utility/Infrastructure' : 'HVAC',
    building: p.building,
    criticality: isShutoff ? 'high' : 'medium',
    make: p.kind === 'heat_pump' ? 'Heat pump' : p.kind === 'air_conditioner' ? 'AC unit' : null,
    notes: p.notes ?? null,
  };
});

const out = {
  org: {
    facility_name: meta.name,
    address: 'Powder Springs, GA',
    maintenance_contact_email: 'maintenance@midwaypca.org',
    timezone: 'America/New_York',
    distance_unit: 'mi',
    currency: 'USD',
  },
  buildings,
  floors,
  locations,
  assets,
};

const dest = `${root}/apps/web/src/data/midwaypca.json`;
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(
  `✓ wrote ${dest}: ${buildings.length} buildings, ${floors.length} floors, ${assets.length} assets`,
);
