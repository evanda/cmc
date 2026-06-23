import type { Fixture } from './types.js';

// A minimal single-building campus — the fast smoke-test fixture.
export const tiny: Fixture = {
  key: 'tiny',
  org: {
    facility_name: 'Sample Chapel (tiny)',
    address: '1 Example Way, Springfield',
    timezone: 'America/Chicago',
  },
  buildings: [
    {
      name: 'Chapel',
      description: 'Single-room worship space.',
      floors: [{ name: 'Ground', level: 1 }],
      locations: [
        { name: 'Sanctuary', type: 'area', floor: 'Ground' },
        { name: 'Vestibule', type: 'area', floor: 'Ground' },
        { name: 'Mechanical Closet', type: 'room', floor: 'Ground' },
      ],
    },
  ],
};
