import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Poi } from '@cmc/shared';
import { MapView } from './MapView';
import { useAssets, useAllWorkOrders, useBuildings, useLocations, useOrgSettings, usePois } from '../lib/queries';
import { countOpenWosByBuilding } from '../lib/map-utils';

function levelName(level: number): string {
  if (level === -1) return 'Basement';
  if (level === 0) return 'Ground';
  if (level === 1) return 'Main';
  if (level === 2) return 'Upper';
  return `Level ${level}`;
}

function poisToGeoJSON(
  pois: Poi[],
  buildingNameById: Map<string, string>,
): GeoJSON.FeatureCollection | undefined {
  if (pois.length === 0) return undefined;
  return {
    type: 'FeatureCollection',
    features: pois.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        label: p.label,
        poi_type: p.poi_type,
        icon: p.icon,
        level: p.level,
        level_name: p.level != null ? levelName(p.level) : null,
        building: p.building_id ? (buildingNameById.get(p.building_id) ?? null) : null,
        notes: p.notes,
        linked_asset_id: p.linked_asset_id,
      },
      geometry: p.geometry_geojson,
    })),
  };
}

export function MapPage() {
  const navigate = useNavigate();
  const { data: org } = useOrgSettings();
  const { data: assets } = useAssets();
  const { data: buildings } = useBuildings();
  const { data: locations } = useLocations();
  const { data: allWorkOrders } = useAllWorkOrders();
  const { data: pois } = usePois();

  const openWoCountByBuilding = useMemo(
    () => countOpenWosByBuilding(allWorkOrders ?? [], locations ?? []),
    [allWorkOrders, locations],
  );

  const buildingNameById = useMemo(
    () => new Map((buildings ?? []).map((b) => [b.id, b.name])),
    [buildings],
  );

  const poisGeoJSON = useMemo(
    () => poisToGeoJSON(pois ?? [], buildingNameById),
    [pois, buildingNameById],
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
        onCreateWorkOrder={(assetId) => navigate(`/work-orders?asset=${assetId}`)}
        poisGeoJSON={poisGeoJSON}
      />
    </div>
  );
}
