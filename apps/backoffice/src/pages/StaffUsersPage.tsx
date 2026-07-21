import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import * as backendApi from '../lib/backendApi';
import type { StaffRole } from '../lib/backendApi';

const STAFF_ROLES: StaffRole[] = ['ADMIN', 'TRADING', 'RISK', 'CRM', 'FRAUD', 'CMS'];

const staffUsersQueryKey = ['staff-users'] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default function StaffUsersPage() {
  const queryClient = useQueryClient();
  const {
    data: staffUsers,
    isPending,
    isError,
  } = useQuery({
    queryKey: staffUsersQueryKey,
    queryFn: backendApi.listStaffUsers,
  });

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('TRADING');

  const createMutation = useMutation({
    mutationFn: backendApi.createStaffUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffUsersQueryKey });
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('TRADING');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({ username, email, password, role });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Staff users</h1>

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-text-secondary">Add staff user</h2>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="new-username" className="block text-xs text-text-secondary">
              Username
            </label>
            <input
              id="new-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="new-email" className="block text-xs text-text-secondary">
              Email
            </label>
            <input
              id="new-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-xs text-text-secondary">
              Password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="new-role" className="block text-xs text-text-secondary">
              Role
            </label>
            <select
              id="new-role"
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {STAFF_ROLES.map((candidateRole) => (
                <option key={candidateRole} value={candidateRole}>
                  {candidateRole}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add staff user'}
          </Button>
        </form>
        {createMutation.isError && (
          <p className="mt-2 text-sm text-danger">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : 'Failed to create staff user.'}
          </p>
        )}
      </Card>

      <Card className="mt-4">
        {isPending && <p className="text-sm text-text-secondary">Loading staff users…</p>}
        {isError && <p className="text-sm text-danger">Failed to load staff users.</p>}
        {staffUsers && (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 font-medium">Username</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.map((staffUser) => (
                <tr key={staffUser.id} className="border-b border-border last:border-0">
                  <td className="py-2">{staffUser.username}</td>
                  <td className="py-2 text-text-secondary">{staffUser.email}</td>
                  <td className="py-2">{staffUser.role}</td>
                  <td className="py-2 text-text-secondary">{formatDate(staffUser.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}
