import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { Button, Field, inputClass } from '../components/ui';

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Still waiting for supabase-js to exchange the hash token for a session.
  // This only happens if getSession() returns null while #access_token is present.
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
          <p className="text-sm text-slate-700">Your invite link has expired or is invalid.</p>
          <p className="mt-2 text-sm text-slate-500">Ask an admin to send a new invitation.</p>
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
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Set your password</h1>
        <p className="mb-5 text-sm text-slate-500">
          Choose a password to complete your account setup.
        </p>
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
            {busy ? 'Saving…' : 'Set password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
