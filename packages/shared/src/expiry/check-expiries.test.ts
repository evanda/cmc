import { describe, expect, it } from 'vitest';
import { checkExpiries } from './check-expiries.js';

const TODAY = new Date('2026-06-25T12:00:00Z');

function d(offsetDays: number): string {
  const dt = new Date(TODAY);
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

const noVendors = [] as { id: string; name: string; coi_expiry: string | null; contract_expiry: string | null }[];
const noAssets = [] as { id: string; name: string; warranty_expiry: string | null }[];
const noContracts = [] as { id: string; description: string; end_date: string | null }[];

describe('checkExpiries', () => {
  it('includes items expiring within the window', () => {
    const result = checkExpiries(
      { assets: [{ id: 'a1', name: 'HVAC Unit', warranty_expiry: d(30) }], vendors: noVendors, serviceContracts: noContracts },
      60,
      TODAY,
    );
    expect(result.warranties).toHaveLength(1);
    expect(result.warranties[0].daysUntil).toBe(30);
    expect(result.warranties[0].kind).toBe('warranty');
    expect(result.warranties[0].link).toBe('/assets/a1');
  });

  it('excludes items expiring beyond the window', () => {
    const result = checkExpiries(
      { assets: [{ id: 'a1', name: 'HVAC', warranty_expiry: d(90) }], vendors: noVendors, serviceContracts: noContracts },
      60,
      TODAY,
    );
    expect(result.warranties).toHaveLength(0);
  });

  it('always includes already-expired items regardless of window', () => {
    const result = checkExpiries(
      { assets: [{ id: 'a1', name: 'HVAC', warranty_expiry: d(-5) }], vendors: noVendors, serviceContracts: noContracts },
      60,
      TODAY,
    );
    expect(result.warranties).toHaveLength(1);
    expect(result.warranties[0].daysUntil).toBe(-5);
  });

  it('skips items with null expiry dates', () => {
    const result = checkExpiries(
      {
        assets: [{ id: 'a1', name: 'HVAC', warranty_expiry: null }],
        vendors: [{ id: 'v1', name: 'ACME', coi_expiry: null, contract_expiry: null }],
        serviceContracts: [{ id: 'c1', description: 'Lawn', end_date: null }],
      },
      60,
      TODAY,
    );
    expect(result.all).toHaveLength(0);
  });

  it('handles all four expiry kinds', () => {
    const result = checkExpiries(
      {
        assets: [{ id: 'a1', name: 'Boiler', warranty_expiry: d(10) }],
        vendors: [{ id: 'v1', name: 'ACME Plumbing', coi_expiry: d(20), contract_expiry: d(5) }],
        serviceContracts: [{ id: 'c1', description: 'Pest Control', end_date: d(45) }],
      },
      60,
      TODAY,
    );
    expect(result.warranties).toHaveLength(1);
    expect(result.vendorCois).toHaveLength(1);
    expect(result.vendorContracts).toHaveLength(1);
    expect(result.serviceContracts).toHaveLength(1);
    expect(result.all).toHaveLength(4);
  });

  it('labels vendor contract entries with "— contract" suffix', () => {
    const result = checkExpiries(
      {
        assets: noAssets,
        vendors: [{ id: 'v1', name: 'ACME Plumbing', coi_expiry: null, contract_expiry: d(5) }],
        serviceContracts: noContracts,
      },
      60,
      TODAY,
    );
    expect(result.vendorContracts[0].name).toBe('ACME Plumbing — contract');
  });

  it('sorts all items by daysUntil ascending (most urgent first)', () => {
    const result = checkExpiries(
      {
        assets: [{ id: 'a1', name: 'Boiler', warranty_expiry: d(30) }],
        vendors: [{ id: 'v1', name: 'ACME', coi_expiry: d(-5), contract_expiry: null }],
        serviceContracts: [{ id: 'c1', description: 'Pest', end_date: d(10) }],
      },
      60,
      TODAY,
    );
    expect(result.all.map((i) => i.daysUntil)).toEqual([-5, 10, 30]);
  });

  it('uses 60-day default window when no windowDays supplied', () => {
    const nowDate = new Date();
    const in45 = new Date(nowDate);
    in45.setDate(in45.getDate() + 45);
    const in75 = new Date(nowDate);
    in75.setDate(in75.getDate() + 75);
    const result = checkExpiries({
      assets: [
        { id: 'a1', name: 'Near', warranty_expiry: in45.toISOString().slice(0, 10) },
        { id: 'a2', name: 'Far', warranty_expiry: in75.toISOString().slice(0, 10) },
      ],
      vendors: noVendors,
      serviceContracts: noContracts,
    });
    expect(result.warranties.map((w) => w.id)).toContain('a1');
    expect(result.warranties.map((w) => w.id)).not.toContain('a2');
  });
});
