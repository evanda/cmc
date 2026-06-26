import type { Asset, ServiceContract, Vehicle, Vendor } from '../types/domain.js';

export type ExpiryKind =
  | 'warranty'
  | 'vendor_coi'
  | 'vendor_contract'
  | 'service_contract'
  | 'vehicle_reg'
  | 'vehicle_insurance'
  | 'vehicle_inspection';

export type ExpiryItem = {
  id: string;
  name: string;
  expiry: string;    // YYYY-MM-DD
  daysUntil: number; // negative = already expired
  kind: ExpiryKind;
  link: string;      // app route
};

export type ExpiryReport = {
  warranties: ExpiryItem[];
  vendorCois: ExpiryItem[];
  vendorContracts: ExpiryItem[];
  serviceContracts: ExpiryItem[];
  vehicleReg: ExpiryItem[];
  vehicleInsurance: ExpiryItem[];
  vehicleInspection: ExpiryItem[];
  /** All items sorted by daysUntil ascending (most urgent first). */
  all: ExpiryItem[];
};

function days(dateStr: string, today: Date): number {
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86_400_000);
}

/**
 * Scan assets/vendors/service-contracts/vehicles for expiring items.
 * Items already expired (daysUntil < 0) are always returned.
 * Items with no expiry date are silently skipped.
 * `vehicles` entries should include the linked asset name in the `name` field.
 */
export function checkExpiries(
  data: {
    assets: Pick<Asset, 'id' | 'name' | 'warranty_expiry'>[];
    vendors: Pick<Vendor, 'id' | 'name' | 'coi_expiry' | 'contract_expiry'>[];
    serviceContracts: Pick<ServiceContract, 'id' | 'description' | 'end_date' | 'vendor_id'>[];
    vehicles?: Array<Pick<Vehicle, 'id' | 'asset_id' | 'registration_expiry' | 'insurance_expiry' | 'inspection_expiry'> & { name: string }>;
  },
  windowDays = 60,
  today = new Date(),
): ExpiryReport {
  const inWindow = (d: number) => d <= windowDays;

  const warranties: ExpiryItem[] = data.assets
    .filter((a) => a.warranty_expiry != null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      expiry: a.warranty_expiry!,
      daysUntil: days(a.warranty_expiry!, today),
      kind: 'warranty' as const,
      link: `/assets/${a.id}`,
    }))
    .filter((item) => inWindow(item.daysUntil));

  const vendorCois: ExpiryItem[] = data.vendors
    .filter((v) => v.coi_expiry != null)
    .map((v) => ({
      id: v.id,
      name: v.name,
      expiry: v.coi_expiry!,
      daysUntil: days(v.coi_expiry!, today),
      kind: 'vendor_coi' as const,
      link: `/vendors?vendor=${v.id}`,
    }))
    .filter((item) => inWindow(item.daysUntil));

  const vendorContracts: ExpiryItem[] = data.vendors
    .filter((v) => v.contract_expiry != null)
    .map((v) => ({
      id: v.id,
      name: `${v.name} — contract`,
      expiry: v.contract_expiry!,
      daysUntil: days(v.contract_expiry!, today),
      kind: 'vendor_contract' as const,
      link: `/vendors?vendor=${v.id}`,
    }))
    .filter((item) => inWindow(item.daysUntil));

  const serviceContracts: ExpiryItem[] = data.serviceContracts
    .filter((c) => c.end_date != null)
    .map((c) => ({
      id: c.id,
      name: c.description,
      expiry: c.end_date!,
      daysUntil: days(c.end_date!, today),
      kind: 'service_contract' as const,
      link: c.vendor_id ? `/vendors?vendor=${c.vendor_id}` : '/vendors',
    }))
    .filter((item) => inWindow(item.daysUntil));

  const vehicleList = data.vehicles ?? [];

  const vehicleReg: ExpiryItem[] = vehicleList
    .filter((v) => v.registration_expiry != null)
    .map((v) => ({
      id: v.id,
      name: `${v.name} — registration`,
      expiry: v.registration_expiry!,
      daysUntil: days(v.registration_expiry!, today),
      kind: 'vehicle_reg' as const,
      link: `/assets/${v.asset_id}`,
    }))
    .filter((item) => inWindow(item.daysUntil));

  const vehicleInsurance: ExpiryItem[] = vehicleList
    .filter((v) => v.insurance_expiry != null)
    .map((v) => ({
      id: v.id,
      name: `${v.name} — insurance`,
      expiry: v.insurance_expiry!,
      daysUntil: days(v.insurance_expiry!, today),
      kind: 'vehicle_insurance' as const,
      link: `/assets/${v.asset_id}`,
    }))
    .filter((item) => inWindow(item.daysUntil));

  const vehicleInspection: ExpiryItem[] = vehicleList
    .filter((v) => v.inspection_expiry != null)
    .map((v) => ({
      id: v.id,
      name: `${v.name} — inspection`,
      expiry: v.inspection_expiry!,
      daysUntil: days(v.inspection_expiry!, today),
      kind: 'vehicle_inspection' as const,
      link: `/assets/${v.asset_id}`,
    }))
    .filter((item) => inWindow(item.daysUntil));

  const all = [
    ...warranties,
    ...vendorCois,
    ...vendorContracts,
    ...serviceContracts,
    ...vehicleReg,
    ...vehicleInsurance,
    ...vehicleInspection,
  ].sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    warranties,
    vendorCois,
    vendorContracts,
    serviceContracts,
    vehicleReg,
    vehicleInsurance,
    vehicleInspection,
    all,
  };
}
