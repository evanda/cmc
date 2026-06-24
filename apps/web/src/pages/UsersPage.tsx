import { useState } from 'react';
import { USER_ROLES, type UserRole } from '@cmc/shared';
import { useDeactivateUser, useInviteUser, useUpdateUserRole, useUsers } from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState } from '../components/ui';

// Admin-only people directory + role management (plan §7.5). RLS lets admins
// update any user's role; the signup trigger creates the public.users row.
const roleHelp: Record<UserRole, string> = {
  admin: 'Full access — config, reports, costs',
  technician: 'Manage assets & work orders, log work',
  requester: 'Submit requests, see their own',
  trustee: 'Read-only dashboards & reports',
  vendor: 'See only their assigned work (v1: unused)',
};

export function UsersPage() {
  const { role, session } = useAuth();
  const users = useUsers();
  const updateRole = useUpdateUserRole();
  const inviteUser = useInviteUser();
  const deactivateUser = useDeactivateUser();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('requester');
  const [inviteError, setInviteError] = useState('');
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null);

  if (role !== 'admin') {
    return <EmptyState>Only admins can manage users.</EmptyState>;
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    try {
      await inviteUser.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setInviteRole('requester');
      setShowInvite(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    }
  }

  async function handleDeactivate(userId: string) {
    setDeactivateConfirm(null);
    try {
      await deactivateUser.mutateAsync(userId);
    } catch {
      // error visible in mutation state
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-slate-800">Users</h1>
          <p className="text-sm text-slate-500">
            People who can sign in, and what they can do. New people get the{' '}
            <span className="font-medium">requester</span> role on first sign-in; promote them here.
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteError(''); }}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Invite user
        </button>
      </div>

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
        >
          <h2 className="mb-3 text-sm font-semibold text-blue-900">Invite a new user</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} — {roleHelp[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviteUser.isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {inviteUser.isPending ? 'Sending…' : 'Send invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
          {inviteError && <p className="mt-2 text-xs text-red-600">{inviteError}</p>}
          <p className="mt-2 text-xs text-blue-700">
            The invited person receives a sign-in link by email. Their account is created with the
            role you select; you can change it later from this list.
          </p>
        </form>
      )}

      {users.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : users.data && users.data.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.data.map((u) => {
                const isSelf = u.id === session?.user.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {u.name ?? <span className="italic text-slate-400">pending invite</span>}
                      {isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
                        value={u.role}
                        disabled={isSelf || updateRole.isPending}
                        title={isSelf ? "You can't change your own role" : roleHelp[u.role]}
                        onChange={(e) =>
                          updateRole.mutate({ id: u.id, role: e.target.value as UserRole })
                        }
                      >
                        {USER_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <span className="ml-2 text-xs text-slate-400">{roleHelp[u.role]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!isSelf && (
                        deactivateConfirm === u.id ? (
                          <span className="inline-flex gap-1">
                            <button
                              onClick={() => handleDeactivate(u.id)}
                              disabled={deactivateUser.isPending}
                              className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeactivateConfirm(null)}
                              className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeactivateConfirm(u.id)}
                            className="text-xs text-slate-400 hover:text-red-600"
                          >
                            Deactivate
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No users yet.</EmptyState>
      )}
    </div>
  );
}
