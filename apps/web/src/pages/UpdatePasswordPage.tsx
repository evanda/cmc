import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { Button, Field, inputClass } from '../components/ui';

/**
 * Protected "set a new password" page — the landing route for the recovery link.
 *
 * The reset email's redirectTo points here (see ForgotPasswordPage). When the
 * user arrives, supabase-js exchanges the recovery token in the URL hash for an
 * authenticated session (detectSessionInUrl, on by default), then we update the
 * password via supabase.auth.updateUser.
 *
 * This route requires an authenticated session: with no recovery session there is
 * nothing to update, so we show an "expired link" message instead of the form.
 *
 * Note: this app is a Vite SPA, so there is no server-side /auth/confirm handler —
 * that's only needed for SSR frameworks (Next.js/Remix) that establish the session
 * in cookies. Here the browser client handles the token exchange client-side.
 */
export function UpdatePasswordPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Still waiting for supabase-js to exchange the recovery hash token for a
  // session. The recovery link lands here as /account/update-password#access_token=…
  if (!session && typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow text-center">
          <p className="text-sm text-slate-700">
            Your password reset link has expired or is invalid.
          </p>
          <Link to="/forgot-password" className="mt-3 inline-block text-sm text-sky-600 hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setBusy(false);
    } else {
      // Session is now a full authenticated session — land on the dashboard.
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Set a new password</h1>
        <p className="mb-5 text-sm text-slate-500">Choose a new password for your account.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="New password">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
