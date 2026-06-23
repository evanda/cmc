import { USER_ROLES, type UserRole } from '@cmc/shared';
import { useUpdateUserRole, useUsers } from '../lib/queries';
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

  if (role !== 'admin') {
    return <EmptyState>Only admins can manage users.</EmptyState>;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Users</h1>
      <p className="mb-4 text-sm text-slate-500">
        People who can sign in, and what they can do. New people get the{' '}
        <span className="font-medium">requester</span> role on first sign-in; promote them here.
      </p>

      <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        Inviting brand-new users (sending a sign-in link) needs a server-side admin action — tracked
        in issue #13. Today: people sign in once to create their account, then an admin sets their
        role below.
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.data.map((u) => {
                const isSelf = u.id === session?.user.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {u.name ?? '—'}
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
