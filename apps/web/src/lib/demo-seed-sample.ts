// Sample campus seed — 4 buildings, assets, work history, vendors, contacts.
// Called once at startup in demo.ts (before any optional midway reseed).

import {
  assetByName,
  base,
  buildWO,
  contacts,
  id,
  locId,
  seedAsset,
  seedBuilding,
  seedPhoto,
  seedRequest,
  seedWO,
  seedWOPhoto,
  serviceContracts,
  userId,
  vendorId,
  vendors,
  workOrders,
} from './demo-store';

export function seedSampleCampus() {
  seedBuilding(
    'Main Church',
    'Sanctuary, narthex, offices, basement fellowship hall.',
    [
      { name: 'Basement', level: -1 },
      { name: 'Ground', level: 1 },
      { name: 'Balcony', level: 2 },
    ],
    [
      { name: 'Sanctuary', type: 'area', floor: 'Ground' },
      { name: 'Narthex', type: 'area', floor: 'Ground' },
      { name: 'Church Office', type: 'room', floor: 'Ground' },
      { name: 'Fellowship Hall', type: 'area', floor: 'Basement' },
      { name: 'Boiler Room', type: 'room', floor: 'Basement' },
      { name: 'Choir Loft', type: 'area', floor: 'Balcony' },
    ],
  );
  seedBuilding(
    'School',
    'Two-story classroom building with gymnasium.',
    [
      { name: 'First Floor', level: 1 },
      { name: 'Second Floor', level: 2 },
    ],
    [
      { name: 'Room 101', type: 'room', floor: 'First Floor' },
      { name: 'Room 102', type: 'room', floor: 'First Floor' },
      { name: 'Cafeteria', type: 'area', floor: 'First Floor' },
      { name: 'Room 201', type: 'room', floor: 'Second Floor' },
      { name: 'Science Lab', type: 'room', floor: 'Second Floor' },
    ],
  );
  seedBuilding(
    'Gymnasium',
    null,
    [{ name: 'Court Level', level: 1 }],
    [
      { name: 'Main Court', type: 'area', floor: 'Court Level' },
      { name: 'Locker Room A', type: 'room', floor: 'Court Level' },
      { name: 'Equipment Storage', type: 'room', floor: 'Court Level' },
    ],
  );
  seedBuilding(
    'Grounds',
    'Outdoor areas: playground, cemetery, parking.',
    [],
    [
      { name: 'Playground', type: 'area' },
      { name: 'Cemetery', type: 'area' },
      { name: 'North Parking Lot', type: 'area' },
    ],
  );

  seedAsset('RTU-1 Rooftop Unit', 'HVAC', 'Sanctuary', {
    make: 'Carrier',
    model: '48TC',
    serial: 'C1234',
    criticality: 'high',
    contact_name: 'HVAC Systems Lead',
    contact_email: 'hvac@midwaypca.org',
    install_date: '2014-05-01',
    expected_life_years: 15,
    replacement_cost: 9000,
  });
  seedAsset('Main Water Shutoff', 'Utility/Infrastructure', 'Boiler Room', { criticality: 'high' });
  seedAsset('Boiler', 'HVAC', 'Boiler Room', {
    make: 'Weil-McLain',
    criticality: 'high',
    install_date: '2008-01-01',
    expected_life_years: 20,
    replacement_cost: 12000,
  });
  seedAsset('Sanctuary Sound Board', 'Sound/AV', 'Sanctuary', { make: 'Yamaha', model: 'TF5' });
  seedAsset('Network Rack', 'Network/IT', 'Church Office', { criticality: 'medium' });
  seedAsset('Gym Scoreboard', 'Sound/AV', 'Main Court', {});
  seedAsset('Leaf Blower', 'Tools/Equipment', null, { make: 'Stihl', model: 'BR700' });
  seedAsset('Extension Ladder (24ft)', 'Tools/Equipment', null, {});
  seedAsset('Playground Structure', 'Grounds/Playground', 'Playground', {
    criticality: 'medium',
    install_date: '2016-04-01',
    expected_life_years: 12,
    replacement_cost: 15000,
  });
  seedAsset('Walk-in Cooler', 'Fixtures', 'Cafeteria', {
    status: 'retired',
    install_date: '2012-01-01',
    expected_life_years: 12,
    replacement_cost: 6000,
  });

  seedPhoto('RTU-1 Rooftop Unit', 'RTU-1 — nameplate', '#0f766e', true);
  seedPhoto('RTU-1 Rooftop Unit', 'RTU-1 — install', '#334155');
  seedPhoto('Playground Structure', 'Playground — overview', '#9333ea', true);

  const hvacWO = seedWO('RTU-1 Rooftop Unit', {
    title: 'Annual HVAC service + filter',
    type: 'preventive',
    completed_date: '2026-04-12',
    vendor_name: 'Acme Mechanical',
    coordinated_by_user_id: userId('Sam Tech'),
    authorized_by_user_id: userId('Pat Director'),
    actual_vendor_cost: 480,
    actual_parts_cost: 65,
    labor_hours: 2.5,
    invoice_number: 'ACM-10482',
    payment_reference: 'Check #2041',
    completion_notes: 'Replaced filters, checked refrigerant charge, cleaned coils.',
  });
  seedWO('RTU-1 Rooftop Unit', {
    title: 'Compressor capacitor replacement',
    completed_date: '2026-02-03',
    vendor_name: 'Acme Mechanical',
    coordinated_by_user_id: userId('Sam Tech'),
    authorized_by_user_id: userId('Pat Director'),
    actual_vendor_cost: 220,
    actual_parts_cost: 38,
    invoice_number: 'ACM-10110',
    payment_reference: 'Check #1998',
    completion_notes: 'No-cool call; capacitor failed. Replaced and verified operation.',
  });
  seedWO('Boiler', {
    title: 'Boiler inspection & low-water cutoff test',
    type: 'inspection',
    completed_date: '2026-03-20',
    assignee_user_id: userId('Sam Tech'),
    authorized_by_user_id: userId('Pat Director'),
    actual_labor_cost: 0,
    labor_hours: 1,
    completion_notes: 'Passed. Next test due in 6 months.',
  });
  seedWO('Playground Structure', {
    title: 'Replace cracked slide bolt set',
    completed_date: '2026-05-09',
    assignee_user_id: userId('Sam Tech'),
    actual_parts_cost: 24.5,
    labor_hours: 0.75,
    payment_reference: 'Card ****1234',
  });

  seedWOPhoto(hvacWO, 'before', 'Before — clogged filter', '#b45309');
  seedWOPhoto(hvacWO, 'after', 'After — new filter', '#15803d');

  vendors.push(
    {
      id: id(),
      ...base(),
      name: 'Acme Mechanical',
      category: 'HVAC',
      contact_name: 'Dana Cruz',
      phone: '555-0101',
      email: 'service@acmemech.example',
      address: '12 Trade St',
      rate: 125,
      coi_expiry: '2026-09-30',
      contract_expiry: '2026-12-31',
      notes: null,
    },
    {
      id: id(),
      ...base(),
      name: 'Bright Spark Electric',
      category: 'Electrical',
      contact_name: 'Lee Park',
      phone: '555-0144',
      email: 'office@brightspark.example',
      address: null,
      rate: 110,
      coi_expiry: '2026-07-15',
      contract_expiry: null,
      notes: null,
    },
    {
      id: id(),
      ...base(),
      name: 'GreenScape Lawn',
      category: 'Landscaping',
      contact_name: 'Maria Gomez',
      phone: '555-0190',
      email: null,
      address: null,
      rate: null,
      coi_expiry: '2026-06-30',
      contract_expiry: '2027-03-01',
      notes: null,
    },
  );

  serviceContracts.push(
    {
      id: id(),
      ...base(),
      vendor_id: vendorId('GreenScape Lawn'),
      description: 'Weekly lawn mowing & trimming',
      cadence: 'weekly',
      cost: 320,
      period_unit: 'month',
      start_date: '2026-04-01',
      end_date: '2026-10-31',
      renewal_reminder_days: 30,
    },
    {
      id: id(),
      ...base(),
      vendor_id: null,
      description: 'Garbage & recycling pickup',
      cadence: 'weekly',
      cost: 145,
      period_unit: 'month',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      renewal_reminder_days: 45,
    },
  );

  contacts.push(
    {
      id: id(),
      ...base(),
      name: 'City Power & Light',
      org: 'Utility',
      role: 'Electric utility',
      phone: '800-555-0123',
      email: null,
      account_number: 'ACCT-44821',
      notes: 'Outage line: 800-555-0000',
    },
    {
      id: id(),
      ...base(),
      name: 'Jordan Pipes',
      org: 'Rapid Plumbing',
      role: 'Emergency plumber',
      phone: '555-0177',
      email: 'jordan@rapidplumb.example',
      account_number: null,
      notes: null,
    },
    {
      id: id(),
      ...base(),
      name: 'Sam Rivera',
      org: 'Faithful Mutual',
      role: 'Insurance agent',
      phone: '555-0166',
      email: 'srivera@faithfulmutual.example',
      account_number: 'POL-99812',
      notes: null,
    },
  );

  // In-flight work orders so the board has cards across status columns.
  workOrders.push(
    buildWO({
      title: 'Sanctuary AC short-cycling',
      status: 'open',
      priority: 'high',
      linked_asset_id: assetByName('RTU-1 Rooftop Unit').id,
      location_id: locId('Sanctuary'),
      assignee_user_id: userId('Sam Tech'),
      vendor_id: vendorId('Acme Mechanical'),
      due_date: '2026-06-28',
    }),
    buildWO({
      title: 'Boiler pressure gauge replacement',
      status: 'in_progress',
      priority: 'medium',
      linked_asset_id: assetByName('Boiler').id,
      location_id: locId('Boiler Room'),
      assignee_user_id: userId('Sam Tech'),
    }),
    buildWO({
      title: 'Repaint gym foul lines',
      status: 'on_hold',
      priority: 'low',
      location_id: locId('Main Court'),
    }),
  );

  // Requests awaiting triage (work orders in 'requested' status — plan §3.1).
  seedRequest({
    title: 'AC not cooling in the Sanctuary',
    description: 'Warm during the 9am service.',
    linked_asset_id: assetByName('RTU-1 Rooftop Unit').id,
    location_id: locId('Sanctuary'),
  });
  seedRequest({ title: 'Flickering lights in Room 101', location_id: locId('Room 101') });
  seedRequest({ title: 'Loose handrail by the Narthex steps', location_id: locId('Narthex') });
}
