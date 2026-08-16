import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { SidePanel } from '../components/ui/SidePanel';
import * as backendApi from '../lib/backendApi';
import type { PlayerRecentBet } from '../lib/backendApi';

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [openBet, setOpenBet] = useState<PlayerRecentBet | null>(null);

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

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs text-text-secondary">Turnover staked</p>
              <p className="text-xl font-semibold">{formatCents(player.stats.turnoverCents)}</p>
              <p className="text-xs text-text-muted">{player.stats.betCount} bets</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">GGR</p>
              <p className={`text-xl font-semibold ${player.stats.ggrCents < 0 ? 'text-danger' : ''}`}>
                {formatCents(player.stats.ggrCents)}
              </p>
              <p className="text-xs text-text-muted">Settled bets only</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Avg stake / bet</p>
              <p className="text-xl font-semibold">{formatCents(player.stats.avgStakeCents)}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-secondary">Avg selections / bet</p>
              <p className="text-xl font-semibold">{player.stats.avgSelectionsPerBet.toFixed(1)}</p>
              <p className="text-xs text-text-muted">
                {player.stats.singleBetCount} singles · {player.stats.accumulatorBetCount} accas
              </p>
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="text-sm font-medium text-text-secondary">Preferences</h2>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-text-secondary">Top sports</p>
                {player.stats.topSports.length === 0 ? (
                  <p className="mt-1 text-sm text-text-muted">No data yet.</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {player.stats.topSports.map((row) => (
                      <li key={row.sport} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                        {row.sport} <span className="text-text-muted">({row.count})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs text-text-secondary">Top leagues/competitions</p>
                {player.stats.topCompetitions.length === 0 ? (
                  <p className="mt-1 text-sm text-text-muted">No data yet.</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {player.stats.topCompetitions.map((row) => (
                      <li key={row.competition} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                        {row.competition} <span className="text-text-muted">({row.count})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

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
                    <th className="py-2 font-medium">Ticket</th>
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
                        <button
                          type="button"
                          onClick={() => setOpenBet(bet)}
                          className="font-mono text-xs text-brand hover:underline"
                        >
                          #{shortId(bet.id)}
                        </button>
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

      <SidePanel title={openBet ? `Ticket #${shortId(openBet.id)}` : ''} isOpen={openBet !== null} onClose={() => setOpenBet(null)}>
        {openBet && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-text-secondary">Stake</dt>
                <dd>{formatCents(openBet.stakeCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Combined odds</dt>
                <dd>{openBet.combinedOdds}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Potential payout</dt>
                <dd>{formatCents(openBet.potentialPayoutCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Settled payout</dt>
                <dd>{openBet.settledPayoutCents === null ? '—' : formatCents(openBet.settledPayoutCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Status</dt>
                <dd>{openBet.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Placed</dt>
                <dd>{new Date(openBet.createdAt).toLocaleString()}</dd>
              </div>
            </dl>

            {(openBet.fundedByFreebets || openBet.insuranceCostPercent > 0 || openBet.accaBoostPercent > 0 || openBet.campaignName) && (
              <div className="flex flex-wrap gap-1">
                {openBet.fundedByFreebets && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">Funded by freebets</span>
                )}
                {openBet.insuranceCostPercent > 0 && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                    Insured ({openBet.insuranceCostPercent}%)
                  </span>
                )}
                {openBet.accaBoostPercent > 0 && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                    Boosted (+{openBet.accaBoostPercent}%)
                  </span>
                )}
                {openBet.campaignName && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{openBet.campaignName}</span>
                )}
              </div>
            )}

            <div>
              <h3 className="text-xs font-medium text-text-secondary">Selections</h3>
              <ul className="mt-2 space-y-2">
                {openBet.selections.map((selection, index) => (
                  <li key={index} className="rounded-md border border-border p-2">
                    <p className="font-medium">{selection.matchLabel}</p>
                    <p className="text-text-secondary">
                      {selection.marketName}: {selection.selectionName}
                    </p>
                    <p className="mt-1 flex items-center justify-between text-xs text-text-muted">
                      <span>Odds {selection.odds}</span>
                      <span>{selection.status}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
