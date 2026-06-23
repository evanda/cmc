import { MapView } from './MapView';
import { useAssets, useOrgSettings } from '../lib/queries';

export function MapPage() {
  const { data: org } = useOrgSettings();
  const { data: assets } = useAssets();
  return (
    <div>
      <div className="mb-3">
        <h1 className="text-2xl font-semibold text-slate-800">Campus Map</h1>
        <p className="text-sm text-slate-500">
          {org?.facility_name ?? 'Campus'} — building footprints and equipment POIs. Click a POI to
          open its asset; use the level switcher to move between floors.
        </p>
      </div>
      <MapView
        facility="midwaypca"
        assets={(assets ?? []).map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
