import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import * as backendApi from '../lib/backendApi';

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: player,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['player', id],
    queryFn: () => backendApi.getPlayerDetail(id!),
    enabled: Boolean(id),
  });

  return (
    <div>
      <Link to="/players" className="text-sm text-text-secondary hover:text-text-primary">
        ← Players
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{player?.username ?? 'Player'}</h1>

      {isPending && (
        <div className="mt-4 space-y-2" aria-label="Loading player" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {isError && <p className="mt-4 text-sm text-danger">Failed to load player.</p>}

      {player && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs text-text-secondary">Cash balance</p>
              <p className="text-xl font-semibold">{formatCents(player.balanceCents)}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Freebets balance</p>
              <p className="text-xl font-semibold text-brand">{formatCents(player.freebetsCents)}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Passkeys enrolled</p>
              <p className="text-xl font-semibold">{player.webauthnCredentialCount}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Push subscriptions</p>
              <p className="text-xl font-semibold">{player.pushSubscriptionCount}</p>
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Profile</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-text-secondary">Email</dt>
                <dd>{player.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Phone</dt>
                <dd>
                  {player.phone}{' '}
                  {player.phoneVerifiedAt ? (
                    <span className="text-xs text-brand">Verified</span>
                  ) : (
                    <span className="text-xs text-text-muted">Unverified</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Joined</dt>
                <dd>{new Date(player.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Segments</dt>
                <dd>
                  {player.segments.length === 0 ? (
                    <span className="text-text-muted">None</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {player.segments.map((segment) => (
                        <span
                          key={segment.id}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-xs"
                          style={segment.colorHex ? { color: segment.colorHex } : undefined}
                        >
                          {segment.name}
                        </span>
                      ))}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Recent bets</h2>
            {player.recentBets.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No bets placed yet.</p>
            ) : (
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="py-2 font-medium">Selections</th>
                    <th className="py-2 font-medium">Stake</th>
                    <th className="py-2 font-medium">Odds</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {player.recentBets.map((bet) => (
                    <tr key={bet.id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        {bet.selections.map((selection) => selection.selectionName).join(', ')}
                      </td>
                      <td className="py-2">{formatCents(bet.stakeCents)}</td>
                      <td className="py-2 text-text-secondary">{bet.combinedOdds}</td>
                      <td className="py-2">{bet.status}</td>
                      <td className="py-2 text-text-secondary">{new Date(bet.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Deposits</h2>
            {player.deposits.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No recorded deposits.</p>
            ) : (
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {player.deposits.map((deposit) => (
                    <tr key={deposit.id} className="border-b border-border last:border-0">
                      <td className="py-2">{formatCents(deposit.amountCents)}</td>
                      <td className="py-2 text-text-secondary">{new Date(deposit.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
