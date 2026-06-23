import { MapView } from './MapView';
import { useOrgSettings } from '../lib/queries';

export function MapPage() {
  const { data: org } = useOrgSettings();
  return (
    <div>
      <div className="mb-3">
        <h1 className="text-2xl font-semibold text-slate-800">Campus Map</h1>
        <p className="text-sm text-slate-500">
          {org?.facility_name ?? 'Campus'} — building footprints and equipment POIs. Use the level
          switcher to move between floors.
        </p>
      </div>
      <MapView facility="midwaypca" />
    </div>
  );
}
