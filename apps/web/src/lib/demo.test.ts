import { describe, expect, it } from 'vitest';
import { demoDataSource as ds } from './demo';
import { buildLevels, countOpenWosByBuilding, levelLabel, poiLevelFilter } from './map-utils';

// The in-memory demo DataSource backs offline mode + screenshots. These guard
// the seed shape and the core write flows the UI relies on.

describe('demo data source — seed', () => {
  it('seeds the sample campus (4 buildings) and PM schedules', async () => {
    expect((await ds.listBuildings()).length).toBe(4);
    expect((await ds.listPmSchedules()).length).toBeGreaterThanOrEqual(5);
    expect((await ds.listAssetCategories()).length).toBe(18);
  });

  it('exposes the org identity', async () => {
    const org = await ds.getOrgSettings();
    expect(org?.facility_name).toBeTruthy();
  });
});

describe('demo data source — updateOrgSettings', () => {
  it('updates the facility name and address', async () => {
    const updated = await ds.updateOrgSettings({
      facility_name: 'New Name Church',
      address: '999 Test Ave',
      locale: 'en-US',
      distance_unit: 'km',
      currency: 'USD',
      timezone: 'America/Chicago',
    });
    expect(updated.facility_name).toBe('New Name Church');
    expect(updated.distance_unit).toBe('km');
    expect(updated.timezone).toBe('America/Chicago');

    const fetched = await ds.getOrgSettings();
    expect(fetched?.facility_name).toBe('New Name Church');
  });

  it('stores maintenance_contact_email', async () => {
    const updated = await ds.updateOrgSettings({
      facility_name: 'Test Church',
      maintenance_contact_email: 'maint@test.org',
      locale: 'en-US',
      distance_unit: 'mi',
      currency: 'USD',
      timezone: 'America/New_York',
    });
    expect(updated.maintenance_contact_email).toBe('maint@test.org');
  });

  it('clears maintenance_contact_email when omitted', async () => {
    const updated = await ds.updateOrgSettings({
      facility_name: 'Test Church',
      locale: 'en-US',
      distance_unit: 'mi',
      currency: 'USD',
      timezone: 'America/New_York',
    });
    expect(updated.maintenance_contact_email).toBeNull();
  });
});

describe('demo data source — request intake + triage', () => {
  it('files a request as a "requested" work order', async () => {
    const req = await ds.createWorkRequest({ title: 'AC out in Room 12', description: 'hot' });
    expect(req.status).toBe('requested');

    const inbox = await ds.listWorkRequests();
    expect(inbox.find((r) => r.id === req.id)).toBeTruthy();
  });

  it('accepting advances the same WO to open and clears it from the inbox', async () => {
    const req = await ds.createWorkRequest({ title: 'Leaky faucet' });
    const wo = await ds.acceptWorkRequest(req.id);

    expect(wo.id).toBe(req.id); // in-place, no duplicate row
    expect(wo.status).toBe('open');
    expect((await ds.listWorkRequests()).find((r) => r.id === req.id)).toBeUndefined();
    expect((await ds.listAllWorkOrders()).find((w) => w.id === req.id)?.status).toBe('open');
  });

  it('declining cancels the request', async () => {
    const req = await ds.createWorkRequest({ title: 'Spider in the narthex' });
    await ds.declineWorkRequest(req.id);
    expect((await ds.listWorkRequests()).find((r) => r.id === req.id)).toBeUndefined();
  });
});

describe('demo data source — board work orders', () => {
  it('creates a WO that appears in the global list', async () => {
    const wo = await ds.createWorkOrderFromForm({
      title: 'Replace ballast',
      type: 'reactive',
      priority: 'high',
      status: 'open',
    });
    const all = await ds.listAllWorkOrders();
    expect(all.find((w) => w.id === wo.id)?.priority).toBe('high');
  });

  it('updateWorkOrder stamps completed_date when completed', async () => {
    const wo = await ds.createWorkOrderFromForm({ title: 'Fix door', type: 'reactive', priority: 'low', status: 'open' });
    const updated = await ds.updateWorkOrder(wo.id, {
      status: 'completed',
      priority: 'low',
      assignee_user_id: null,
    });
    expect(updated.status).toBe('completed');
    expect(updated.completed_date).toBeTruthy();
  });
});

describe('demo data source — QR token', () => {
  it('generates a stable token (same on repeat)', async () => {
    const asset = (await ds.listAssets())[0];
    const t1 = await ds.ensureAssetQrToken(asset.id);
    const t2 = await ds.ensureAssetQrToken(asset.id);
    expect(t1).toBeTruthy();
    expect(t1).toBe(t2);
    expect((await ds.getAssetByQrToken(t1))?.id).toBe(asset.id);
  });
});

describe('demo data source — work log (asset history)', () => {
  it('createWorkOrder logs a completed WO against the asset', async () => {
    const asset = (await ds.listAssets())[0];
    const wo = await ds.createWorkOrder(asset.id, {
      title: 'Belt replacement',
      type: 'reactive',
      completed_date: '2026-06-01',
      actual_parts_cost: 24,
      labor_hours: 0.5,
    });
    expect(wo.status).toBe('completed');
    expect(wo.linked_asset_id).toBe(asset.id);
    expect(wo.actual_parts_cost).toBe(24);

    const history = await ds.listWorkOrders(asset.id);
    expect(history.some((w) => w.id === wo.id)).toBe(true);
  });

  it('work log appears in the global WO list', async () => {
    const asset = (await ds.listAssets())[0];
    const wo = await ds.createWorkOrder(asset.id, {
      title: 'Filter swap',
      type: 'preventive',
      completion_notes: 'All good.',
    });
    const all = await ds.listAllWorkOrders();
    expect(all.some((w) => w.id === wo.id)).toBe(true);
  });
});

describe('demo data source — user management', () => {
  it('inviteUser adds a user visible in listUsers', async () => {
    const before = (await ds.listUsers()).length;
    await ds.inviteUser('newperson@test.org', 'technician');
    const after = await ds.listUsers();
    expect(after.length).toBe(before + 1);
    const invited = after.find((u) => u.email === 'newperson@test.org');
    expect(invited?.role).toBe('technician');
    expect(invited?.name).toBeNull();
  });

  it('deactivateUser removes the user from listUsers', async () => {
    await ds.inviteUser('todeactivate@test.org', 'requester');
    const before = await ds.listUsers();
    const target = before.find((u) => u.email === 'todeactivate@test.org')!;
    expect(target).toBeTruthy();

    await ds.deactivateUser(target.id);
    const after = await ds.listUsers();
    expect(after.find((u) => u.id === target.id)).toBeUndefined();
  });
});

describe('map-utils — level filter', () => {
  it('returns null for the site level (show all POIs)', () => {
    expect(poiLevelFilter('site')).toBeNull();
  });

  it('returns a MapLibre equality filter for a numeric floor', () => {
    expect(poiLevelFilter(1)).toEqual(['==', ['get', 'level'], 1]);
    expect(poiLevelFilter(2)).toEqual(['==', ['get', 'level'], 2]);
  });

  it('handles basement levels (negative numbers)', () => {
    expect(poiLevelFilter(-1)).toEqual(['==', ['get', 'level'], -1]);
  });
});

describe('map-utils — levelLabel', () => {
  it('formats positive floor numbers as plain strings', () => {
    expect(levelLabel(1)).toBe('1');
    expect(levelLabel(2)).toBe('2');
  });

  it('formats negative floor numbers as B-prefixed basement labels', () => {
    expect(levelLabel(-1)).toBe('B1');
    expect(levelLabel(-2)).toBe('B2');
  });
});

describe('map-utils — buildLevels', () => {
  it('merges poi and floor levels into a sorted list', () => {
    expect(buildLevels([1, 2], [-1, 1])).toEqual([-1, 1, 2]);
  });

  it('deduplicates levels present in both sources', () => {
    expect(buildLevels([1], [1])).toEqual([1]);
  });

  it('handles one empty source', () => {
    expect(buildLevels([], [-1, 1])).toEqual([-1, 1]);
    expect(buildLevels([2], [])).toEqual([2]);
  });

  it('returns all levels from midway campus (−1, 1, 2)', () => {
    // Matches the floors.json for midwaypca (Basement, Main, Upper across buildings)
    const floorLevels = [-1, 1, -1, 1, 1, 2, 1];
    expect(buildLevels([], floorLevels)).toEqual([-1, 1, 2]);
  });
});

describe('map-utils — countOpenWosByBuilding', () => {
  const locations = [
    { id: 'loc-1', building_id: 'bldg-A' },
    { id: 'loc-2', building_id: 'bldg-A' },
    { id: 'loc-3', building_id: 'bldg-B' },
  ];

  it('counts active WOs per building via location join', () => {
    const wos = [
      { status: 'open' as const, location_id: 'loc-1' },
      { status: 'in_progress' as const, location_id: 'loc-2' },
      { status: 'open' as const, location_id: 'loc-3' },
    ];
    expect(countOpenWosByBuilding(wos, locations)).toEqual({ 'bldg-A': 2, 'bldg-B': 1 });
  });

  it('excludes completed and cancelled WOs', () => {
    const wos = [
      { status: 'completed' as const, location_id: 'loc-1' },
      { status: 'cancelled' as const, location_id: 'loc-1' },
      { status: 'open' as const, location_id: 'loc-3' },
    ];
    const result = countOpenWosByBuilding(wos, locations);
    expect(result['bldg-A']).toBeUndefined();
    expect(result['bldg-B']).toBe(1);
  });

  it('ignores WOs with no location_id', () => {
    const wos = [{ status: 'open' as const, location_id: null }];
    expect(countOpenWosByBuilding(wos, locations)).toEqual({});
  });

  it('returns empty object when there are no active WOs', () => {
    expect(countOpenWosByBuilding([], locations)).toEqual({});
  });
});
