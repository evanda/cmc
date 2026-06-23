import type { Fixture } from './types.js';
import { tiny } from './tiny.js';
import { bigcampus } from './bigcampus.js';

export type { Fixture } from './types.js';

export const fixtures: Record<string, Fixture> = {
  [tiny.key]: tiny,
  [bigcampus.key]: bigcampus,
};

export const fixtureNames = Object.keys(fixtures);
