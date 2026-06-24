import { describe, expect, it } from 'vitest';
import { demoDataSource as ds } from './demo';

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
