import type { ReactNode } from 'react';

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base = 'rounded px-3 py-1.5 text-sm font-medium transition disabled:opacity-50';
  const styles = {
    primary: 'bg-slate-800 text-white hover:bg-slate-700',
    ghost: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
    danger: 'text-red-600 hover:bg-red-50',
  }[variant];
  return (
    <button className={`${base} ${styles}`} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** A date with a colored countdown — red if past, amber within 30 days (plan §9). */
export function ExpiryBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-slate-400">—</span>;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  const style =
    days < 0 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  const suffix = days < 0 ? 'expired' : `${days}d`;
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${style}`}>
      {date} · {suffix}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
