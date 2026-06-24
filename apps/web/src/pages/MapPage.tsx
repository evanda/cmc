import { useMemo } from 'react';
import { MapView } from './MapView';
import { useAssets, useAllWorkOrders, useBuildings, useLocations, useOrgSettings } from '../lib/queries';
import { countOpenWosByBuilding } from '../lib/map-utils';

export function MapPage() {
  const { data: org } = useOrgSettings();
  const { data: assets } = useAssets();
  const { data: buildings } = useBuildings();
  const { data: locations } = useLocations();
  const { data: allWorkOrders } = useAllWorkOrders();

  const openWoCountByBuilding = useMemo(
    () => countOpenWosByBuilding(allWorkOrders ?? [], locations ?? []),
    [allWorkOrders, locations],
  );

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-2xl font-semibold text-slate-800">Campus Map</h1>
        <p className="text-sm text-slate-500">
          {org?.facility_name ?? 'Campus'} — building footprints and equipment POIs. Click a POI to
          open its asset, or click a building to see its open work orders.
        </p>
      </div>
      <MapView
        facility="midwaypca"
        assets={(assets ?? []).map((a) => ({ id: a.id, name: a.name }))}
        buildings={(buildings ?? []).map((b) => ({ id: b.id, name: b.name }))}
        openWoCountByBuilding={openWoCountByBuilding}
      />
    </div>
  );
}
