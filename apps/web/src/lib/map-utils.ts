// Pure helpers for the MapLibre level-switcher (plan §5.2).
// Extracted here so they can be unit-tested without a browser/map instance.

export type Level = 'site' | number;

/** MapLibre filter expression for a given level, or null to show all POIs. */
export function poiLevelFilter(level: Level): null | unknown[] {
  return level === 'site' ? null : ['==', ['get', 'level'], level];
}

/** Button label for a numeric floor level (negative = basement). */
export function levelLabel(n: number): string {
  return n < 0 ? `B${-n}` : String(n);
}
