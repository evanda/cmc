import { Navigate, useParams } from 'react-router-dom';
import { useAssetByQrToken } from '../lib/queries';
import { EmptyState } from '../components/ui';

/** Resolves a QR deep link `/a/:token` to the asset detail page (plan §3). */
export function AssetByTokenPage() {
  const { token = '' } = useParams();
  const { data, isLoading } = useAssetByQrToken(token);

  if (isLoading) return <p className="text-sm text-slate-500">Looking up asset…</p>;
  if (!data) return <EmptyState>No asset found for this QR code.</EmptyState>;
  return <Navigate to={`/assets/${data.id}`} replace />;
}
