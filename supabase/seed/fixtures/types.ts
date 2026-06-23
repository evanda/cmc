// Shape of a seedable facility fixture (plan §7.6). A fixture is sample DATA
// only — distinct fictional campuses used in dev to exercise the map, hierarchy,
// and (later) the scheduler. NOTHING here is shipped as a real church's content.

export interface FixtureFloor {
  name: string;
  /** -1 = B1, 0/1 = ground, 2… (plan §5.2). */
  level: number;
}

export interface FixtureLocation {
  name: string;
  type?: string;
  /** Name of a floor within the same building (optional). */
  floor?: string;
}

export interface FixtureBuilding {
  name: string;
  description?: string;
  address?: string;
  floors: FixtureFloor[];
  locations: FixtureLocation[];
}

export interface FixtureOrg {
  facility_name: string;
  address?: string;
  locale?: string;
  distance_unit?: 'mi' | 'km';
  currency?: string;
  timezone?: string;
}

export interface Fixture {
  /** CLI key, e.g. `pnpm db:seed tiny`. */
  key: string;
  org: FixtureOrg;
  buildings: FixtureBuilding[];
}
