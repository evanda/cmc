import type { Fixture, FixturePmSchedule } from './types.js';

// Example PM schedules drawn from plan §4.3 seed list.
const PM_SCHEDULES: FixturePmSchedule[] = [
  {
    name: 'HVAC Filter Replacement',
    instructions:
      'Replace all HVAC air filters. Check for signs of mold or blockage. Log filter size and brand.',
    trigger_type: 'calendar',
    interval_value: 3,
    interval_unit: 'month',
    lead_time_days: 14,
    category: 'HVAC',
    building: 'Main Church',
    location: 'Boiler Room',
  },
  {
    name: 'HVAC Semi-Annual Service',
    instructions:
      'Service all HVAC units: clean coils, check refrigerant levels, test thermostat, lubricate moving parts, inspect belts.',
    trigger_type: 'calendar',
    interval_value: 6,
    interval_unit: 'month',
    lead_time_days: 21,
    category: 'HVAC',
    building: 'Main Church',
    location: 'Boiler Room',
  },
  {
    name: 'Backflow Preventer Test',
    instructions:
      'Have a licensed plumber test and certify the backflow preventer. File the certification with the water authority.',
    trigger_type: 'fixed_date',
    fixed_month: 4,
    fixed_day: 1,
    lead_time_days: 30,
    advance_from: 'scheduled',
    is_compliance: true,
    category: 'Plumbing',
    building: 'Main Church',
    location: 'Boiler Room',
  },
  {
    name: 'Fire Extinguisher Inspection',
    instructions:
      'Inspect all fire extinguishers. Check pressure gauge is in the green, pin intact, tamper seal unbroken. Tag with inspection date.',
    trigger_type: 'calendar',
    interval_value: 1,
    interval_unit: 'month',
    lead_time_days: 7,
    is_compliance: true,
    category: 'Safety',
  },
  {
    name: 'Annual Roof Inspection',
    instructions:
      'Walk all roof surfaces. Check for missing or curled shingles, ponding water, damaged flashing, and gutter condition. Photo-document any issues.',
    trigger_type: 'calendar',
    interval_value: 1,
    interval_unit: 'year',
    lead_time_days: 14,
    category: 'Roofing',
  },
  {
    name: 'Gutter Cleaning',
    instructions:
      'Clear all gutters and downspouts of debris. Check for damaged sections, improper pitch, and loose hangers.',
    trigger_type: 'calendar',
    interval_value: 6,
    interval_unit: 'month',
    lead_time_days: 14,
    category: 'Grounds',
  },
  {
    name: 'Playground Safety Inspection',
    instructions:
      'Inspect all playground equipment for wear, sharp edges, loose hardware, and splintering. Check fall-zone surfacing depth. Log pass/fail per item.',
    trigger_type: 'calendar',
    interval_value: 1,
    interval_unit: 'month',
    lead_time_days: 7,
    is_compliance: true,
    category: 'Grounds',
    building: 'Grounds',
    location: 'Playground',
  },
  {
    name: 'Generator Run Test',
    instructions:
      'Run the generator under load for 20 minutes. Check oil and coolant levels, fuel quantity, and battery condition. Log runtime hours.',
    trigger_type: 'calendar',
    interval_value: 1,
    interval_unit: 'month',
    lead_time_days: 7,
    category: 'Electrical',
  },
  {
    name: 'Carpet Cleaning',
    instructions:
      'Professional hot-water extraction cleaning of all carpeted areas. Allow 4–6 hours drying time before use.',
    trigger_type: 'calendar',
    interval_value: 6,
    interval_unit: 'month',
    lead_time_days: 21,
    category: 'Flooring',
  },
];

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
  pmSchedules: PM_SCHEDULES,
};
