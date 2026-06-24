import { useState, useEffect } from 'react';
import { orgSettingsFormSchema } from '@cmc/shared';
import { useOrgSettings, useUpdateOrgSettings } from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, Field, inputClass } from '../components/ui';

// Admin settings page (plan §7.6): edit the single org_settings row.
// Non-admins see a read-only summary.
export function SettingsPage() {
  const { role } = useAuth();
  const { data: org, isLoading } = useOrgSettings();
  const update = useUpdateOrgSettings();
  const canEdit = role === 'admin';

  const [facilityName, setFacilityName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [locale, setLocale] = useState('en-US');
  const [distanceUnit, setDistanceUnit] = useState<'mi' | 'km'>('mi');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/New_York');
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (org) {
      setFacilityName(org.facility_name);
      setAddress(org.address ?? '');
      setEmail(org.maintenance_contact_email ?? '');
      setLocale(org.locale);
      setDistanceUnit(org.distance_unit as 'mi' | 'km');
      setCurrency(org.currency);
      setTimezone(org.timezone);
    }
  }, [org]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = orgSettingsFormSchema.safeParse({
      facility_name: facilityName,
      address,
      maintenance_contact_email: email,
      locale,
      distance_unit: distanceUnit,
      currency,
      timezone,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errs[issue.path[0] as string] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    update.mutate(result.data, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    });
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Church identity and locale defaults (plan §7.6). Changes apply to all users immediately.
      </p>

      {!canEdit && (
        <div className="mb-6 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Only admins can edit settings.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Facility name *" error={errors.facility_name}>
          <input
            className={inputClass}
            value={facilityName}
            onChange={(e) => setFacilityName(e.target.value)}
            disabled={!canEdit}
            placeholder="Grace Community Church"
          />
        </Field>

        <Field label="Address" error={errors.address}>
          <textarea
            className={inputClass}
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!canEdit}
            placeholder="123 Main St, City, ST 00000"
          />
        </Field>

        <Field label="Maintenance contact email" error={errors.maintenance_contact_email}>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canEdit}
            placeholder="maintenance@example.org"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Distance unit" error={errors.distance_unit}>
            <select
              className={inputClass}
              value={distanceUnit}
              onChange={(e) => setDistanceUnit(e.target.value as 'mi' | 'km')}
              disabled={!canEdit}
            >
              <option value="mi">Miles (mi)</option>
              <option value="km">Kilometres (km)</option>
            </select>
          </Field>

          <Field label="Currency" error={errors.currency}>
            <input
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              disabled={!canEdit}
              maxLength={3}
              placeholder="USD"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Locale" error={errors.locale}>
            <input
              className={inputClass}
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={!canEdit}
              placeholder="en-US"
            />
          </Field>

          <Field label="Timezone" error={errors.timezone}>
            <input
              className={inputClass}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!canEdit}
              placeholder="America/New_York"
            />
          </Field>
        </div>

        {canEdit && (
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save settings'}
            </Button>
            {saved && <span className="text-sm text-green-600">Saved.</span>}
            {update.isError && (
              <span className="text-sm text-red-600">
                {(update.error as Error).message}
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
