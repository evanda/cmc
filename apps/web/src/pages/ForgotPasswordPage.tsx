import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Button, Field, inputClass } from '../components/ui';

/**
 * Public "request password reset" page.
 *
 * Calls supabase.auth.resetPasswordForEmail with a redirectTo that points at the
 * /account/update-password route below. The path must match exactly — Supabase
 * only redirects to URLs on the project's allow-list, and the recovery link drops
 * the user on that route with a recovery token in the URL hash, which supabase-js
 * exchanges for a session (detectSessionInUrl, on by default).
 *
 * redirectTo is derived from window.location.origin so it works for every
 * single-tenant deployment without hardcoding a church-specific domain (plan §7.6).
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const redirectTo = `${window.location.origin}/account/update-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Always report success even if the email is unknown — don't leak which
    // addresses have accounts.
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Reset your password</h1>
        <p className="mb-5 text-sm text-slate-500">Campus Facilities Maintenance</p>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            Supabase isn’t configured. Copy <code>.env.example</code> to <code>.env</code> and set
            <code> VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>.
          </div>
        )}

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              If an account exists for <span className="font-medium">{email}</span>, we’ve sent a
              link to reset your password. Check your inbox and follow the link to choose a new
              password.
            </p>
            <Link to="/login" className="block text-sm text-sky-600 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={busy || !isSupabaseConfigured}>
              {busy ? 'Sending…' : 'Send reset link'}
            </Button>
            <Link to="/login" className="block text-center text-sm text-sky-600 hover:underline">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
