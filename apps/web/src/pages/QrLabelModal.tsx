import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Asset } from '@cmc/shared';
import { useEnsureAssetQrToken } from '../lib/queries';
import { Button, Modal } from '../components/ui';

/**
 * Printable QR label for an asset (plan §3). Encodes a deep link
 * `<origin>/a/<qr_token>` so a phone's native camera opens the asset record.
 * The token is a stable, unguessable slug — generated on first use.
 */
export function QrLabelModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const ensure = useEnsureAssetQrToken(asset.id);
  const mutateRef = useRef(ensure.mutateAsync);
  mutateRef.current = ensure.mutateAsync;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [link, setLink] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = asset.qr_token ?? (await mutateRef.current());
      if (cancelled) return;
      const url = `${window.location.origin}/a/${token}`;
      setLink(url);
      setDataUrl(await QRCode.toDataURL(url, { width: 320, margin: 1 }));
    })();
    return () => { cancelled = true; };
  }, [asset.id, asset.qr_token]);

  return (
    <Modal title="QR label" onClose={onClose}>
      <div className="space-y-3 text-center print:space-y-2" id="qr-printable">
        <div className="text-lg font-semibold text-slate-800">{asset.name}</div>
        {dataUrl ? (
          <img src={dataUrl} alt="QR code" className="mx-auto h-56 w-56" />
        ) : (
          <p className="py-12 text-sm text-slate-500">Generating…</p>
        )}
        <div className="break-all text-xs text-slate-400">{link}</div>
        <p className="text-xs text-slate-500 print:hidden">
          Scan with a phone camera to open this asset. Print and stick on the equipment.
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-2 print:hidden">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => window.print()} disabled={!dataUrl}>
          Print
        </Button>
      </div>
    </Modal>
  );
}
