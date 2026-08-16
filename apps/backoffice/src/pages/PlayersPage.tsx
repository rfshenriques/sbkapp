import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import * as backendApi from '../lib/backendApi';

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function PlayersPage() {
  const [query, setQuery] = useState('');

  const {
    data: players,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['players', query],
    queryFn: () => backendApi.searchPlayers(query),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Players</h1>

      <div className="mt-4">
        <label htmlFor="player-search" className="block text-xs text-text-secondary">
          Search by email, username, or phone
        </label>
        <input
          id="player-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Leave empty to list the most recent players"
          className="mt-1 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {isPending && (
        <div className="mt-4 space-y-2" aria-label="Loading players" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
      {isError && <p className="mt-4 text-sm text-danger">Failed to load players.</p>}

      {players && (
        <Card className="mt-4">
          {players.length === 0 ? (
            <p className="text-sm text-text-secondary">No players match this search.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="py-2 font-medium">Player</th>
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Phone</th>
                  <th className="py-2 font-medium">Balance</th>
                  <th className="py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <Link to={`/players/${player.id}`} className="font-medium text-brand hover:underline">
                        {player.username}
                      </Link>
                    </td>
                    <td className="py-2 text-text-secondary">{player.email}</td>
                    <td className="py-2 text-text-secondary">{player.phone}</td>
                    <td className="py-2">{formatCents(player.balanceCents)}</td>
                    <td className="py-2 text-text-secondary">
                      {new Date(player.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
