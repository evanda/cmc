// Pure helpers for the MapLibre level-switcher and building summaries (plan §5.2, §4.6).
// Extracted here so they can be unit-tested without a browser/map instance.

import type { Location, WorkOrder } from '@cmc/shared';
import { ACTIVE_WORK_ORDER_STATUSES } from '@cmc/shared';

export type Level = 'site' | number;

/** MapLibre filter expression for a given level, or null to show all POIs. */
export function poiLevelFilter(level: Level): null | unknown[] {
  return level === 'site' ? null : ['==', ['get', 'level'], level];
}

/** Button label for a numeric floor level (negative = basement). */
export function levelLabel(n: number): string {
  return n < 0 ? `B${-n}` : String(n);
}

/** Merge POI levels and floor levels into a sorted, deduped list. */
export function buildLevels(poiLevels: number[], floorLevels: number[]): number[] {
  return [...new Set([...poiLevels, ...floorLevels])].sort((a, b) => a - b);
}

/**
 * Resolve a `meta.json` basemap_tiles value into a MapLibre source descriptor.
 *
 * Returns `null` when `basemapTiles` is absent — no satellite source should be added.
 * Returns `{ isPMTiles: true, url }` for `pmtiles://…` archives (use MapLibre `url`
 * property so the protocol handler reads zoom/bounds from the archive header).
 * Returns `{ isPMTiles: false, url }` for XYZ tile templates (use `tiles: [url]`).
 *
 * Relative paths (no scheme) are resolved against `base` (the facility dir URL).
 */
export function resolveBasemapUrl(
  basemapTiles: string | undefined,
  base: string,
): { isPMTiles: boolean; url: string } | null {
  if (!basemapTiles) return null;
  const isPMTiles = basemapTiles.startsWith('pmtiles://');
  const url =
    isPMTiles || /^https?:\/\//.test(basemapTiles)
      ? basemapTiles
      : `${base}/${basemapTiles}`;
  return { isPMTiles, url };
}

/**
 * Count active (non-completed/cancelled) work orders per building.
 * Joins via location_id → building_id (plan §4.6 — building map click).
 */
export function countOpenWosByBuilding(
  workOrders: Pick<WorkOrder, 'status' | 'location_id'>[],
  locations: Pick<Location, 'id' | 'building_id'>[],
): Record<string, number> {
  const locToBuilding = new Map(locations.map((l) => [l.id, l.building_id]));
  const counts: Record<string, number> = {};
  for (const wo of workOrders) {
    if (!(ACTIVE_WORK_ORDER_STATUSES as readonly string[]).includes(wo.status)) continue;
    if (!wo.location_id) continue;
    const bid = locToBuilding.get(wo.location_id);
    if (!bid) continue;
    counts[bid] = (counts[bid] ?? 0) + 1;
  }
  return counts;
}
