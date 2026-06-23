import type { Fixture } from './types.js';

// A larger multi-building campus exercising the building → floor → location
// hierarchy and multi-story level handling (plan §7.6).
export const bigcampus: Fixture = {
  key: 'bigcampus',
  org: {
    facility_name: 'Sample Campus (large)',
    address: '500 Campus Drive, Riverton',
    timezone: 'America/New_York',
  },
  buildings: [
    {
      name: 'Main Church',
      description: 'Sanctuary, narthex, offices, basement fellowship hall.',
      floors: [
        { name: 'Basement', level: -1 },
        { name: 'Ground', level: 1 },
        { name: 'Balcony', level: 2 },
      ],
      locations: [
        { name: 'Sanctuary', type: 'area', floor: 'Ground' },
        { name: 'Narthex', type: 'area', floor: 'Ground' },
        { name: 'Church Office', type: 'room', floor: 'Ground' },
        { name: 'Fellowship Hall', type: 'area', floor: 'Basement' },
        { name: 'Boiler Room', type: 'room', floor: 'Basement' },
        { name: 'Choir Loft', type: 'area', floor: 'Balcony' },
      ],
    },
    {
      name: 'School',
      description: 'Two-story classroom building with gymnasium.',
      floors: [
        { name: 'First Floor', level: 1 },
        { name: 'Second Floor', level: 2 },
      ],
      locations: [
        { name: 'Room 101', type: 'room', floor: 'First Floor' },
        { name: 'Room 102', type: 'room', floor: 'First Floor' },
        { name: 'Cafeteria', type: 'area', floor: 'First Floor' },
        { name: 'Room 201', type: 'room', floor: 'Second Floor' },
        { name: 'Science Lab', type: 'room', floor: 'Second Floor' },
      ],
    },
    {
      name: 'Gymnasium',
      floors: [{ name: 'Court Level', level: 1 }],
      locations: [
        { name: 'Main Court', type: 'area', floor: 'Court Level' },
        { name: 'Locker Room A', type: 'room', floor: 'Court Level' },
        { name: 'Equipment Storage', type: 'room', floor: 'Court Level' },
      ],
    },
    {
      name: 'Grounds',
      description: 'Outdoor areas: playground, cemetery, parking.',
      floors: [],
      locations: [
        { name: 'Playground', type: 'area' },
        { name: 'Cemetery', type: 'area' },
        { name: 'North Parking Lot', type: 'area' },
      ],
    },
  ],
};
