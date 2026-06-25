// First-run setup wizard (plan §7.6, issue #14).
// Shown when org_settings is null — guides an admin through creating the
// single org_settings row so the app is ready for use.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgSettingsFormSchema } from '@cmc/shared';
import { useSetupOrgSettings } from '../lib/queries';
import { Button, Field, inputClass } from '../components/ui';

type Step = 'basic' | 'branding' | 'done';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Australia/Sydney',
];

export function SetupWizardPage() {
  const navigate = useNavigate();
  const setup = useSetupOrgSettings();
  const [step, setStep] = useState<Step>('basic');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Basic info (step 1)
  const [facilityName, setFacilityName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [distanceUnit, setDistanceUnit] = useState<'mi' | 'km'>('mi');
  const [currency, setCurrency] = useState('USD');

  // Branding (step 2)
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1e293b');
  const [accentColor, setAccentColor] = useState('#0ea5e9');

  function validateBasic() {
    const result = orgSettingsFormSchema.safeParse({
      facility_name: facilityName,
      address,
      maintenance_contact_email: email || undefined,
      timezone,
      distance_unit: distanceUnit,
      currency,
      locale: 'en-US',
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        errs[key] = issue.message;
      }
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  }

  function handleBasicNext(e: React.FormEvent) {
    e.preventDefault();
    if (validateBasic()) setStep('branding');
  }

  function handleBrandingSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = orgSettingsFormSchema.safeParse({
      facility_name: facilityName,
      address,
      maintenance_contact_email: email || undefined,
      timezone,
      distance_unit: distanceUnit,
      currency,
      locale: 'en-US',
      logo_url: logoUrl || undefined,
      theme: { primaryColor, accentColor },
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        errs[key] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setup.mutate(result.data, {
      onSuccess: () => setStep('done'),
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800">Welcome to CMC</h1>
          <p className="mt-1 text-sm text-slate-500">
            Let's get your facility set up. This takes about a minute.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {(['basic', 'branding', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step === s
                    ? 'bg-slate-800 text-white'
                    : s === 'done' && step === 'done'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="h-px flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {step === 'basic' && (
            <form onSubmit={handleBasicNext} className="space-y-4">
              <h2 className="font-semibold text-slate-800">Basic information</h2>

              <Field label="Facility name *" error={errors.facility_name}>
                <input
                  className={inputClass}
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="e.g. First Baptist Church"
                  autoFocus
                />
              </Field>

              <Field label="Address" error={errors.address}>
                <input
                  className={inputClass}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Anytown, ST 12345"
                />
              </Field>

              <Field label="Maintenance contact email" error={errors.maintenance_contact_email}>
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maintenance@yourchurch.org"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Timezone" error={errors.timezone}>
                  <select
                    className={inputClass}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Distance unit" error={errors.distance_unit}>
                  <select
                    className={inputClass}
                    value={distanceUnit}
                    onChange={(e) => setDistanceUnit(e.target.value as 'mi' | 'km')}
                  >
                    <option value="mi">Miles</option>
                    <option value="km">Kilometres</option>
                  </select>
                </Field>
              </div>

              <Field label="Currency" error={errors.currency}>
                <select
                  className={inputClass}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                </select>
              </Field>

              <div className="pt-2">
                <Button type="submit" className="w-full">
                  Next: Branding →
                </Button>
              </div>
            </form>
          )}

          {step === 'branding' && (
            <form onSubmit={handleBrandingSubmit} className="space-y-4">
              <h2 className="font-semibold text-slate-800">Branding (optional)</h2>
              <p className="text-xs text-slate-500">
                These settings can be changed any time in Settings.
              </p>

              <Field label="Logo URL" error={errors.logo_url}>
                <input
                  type="url"
                  className={inputClass}
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://yourchurch.org/logo.png"
                />
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="mt-2 h-10 w-10 rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary colour" error={errors.theme}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-14 cursor-pointer rounded border border-slate-200 p-0.5"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                    <input
                      className={inputClass}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      maxLength={7}
                    />
                  </div>
                </Field>

                <Field label="Accent colour">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-14 cursor-pointer rounded border border-slate-200 p-0.5"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                    />
                    <input
                      className={inputClass}
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      maxLength={7}
                    />
                  </div>
                </Field>
              </div>

              {/* Live preview strip */}
              <div
                className="flex items-center gap-3 rounded-md p-3 text-sm text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <span className="font-medium">{facilityName || 'Your Facility'}</span>
                <span
                  className="rounded px-2 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: accentColor }}
                >
                  Preview
                </span>
              </div>

              {setup.error && (
                <p className="text-sm text-red-600">{String(setup.error)}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('basic')}
                  className="flex-1"
                >
                  ← Back
                </Button>
                <Button type="submit" className="flex-1" disabled={setup.isPending}>
                  {setup.isPending ? 'Saving…' : 'Finish setup'}
                </Button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
                ✓
              </div>
              <h2 className="font-semibold text-slate-800">You're all set!</h2>
              <p className="text-sm text-slate-500">
                <strong>{facilityName}</strong> is ready to go. Add your buildings, assets, and
                users from the admin pages — or just start filing work orders.
              </p>
              <div className="rounded-md bg-slate-50 p-3 text-left text-xs text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Next steps</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Add buildings and floors (Buildings → Floors)</li>
                  <li>Import or create assets (Assets)</li>
                  <li>Invite technicians and staff (Users)</li>
                  <li>Set up maintenance schedules (Assets → Maintenance Schedules)</li>
                </ul>
              </div>
              <Button className="w-full" onClick={() => navigate('/')}>
                Go to dashboard
              </Button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          These settings can be changed any time under Settings.
        </p>
      </div>
    </div>
  );
}
