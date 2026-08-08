import { useQuery } from '@tanstack/react-query';
import { getMyLeaderboardEntry } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';

/** The logged-in player's own opt-in row, or null if they haven't joined yet - drives JoinLeaderboardButton's state. */
export function useMyLeaderboardEntry(campaignId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['my-leaderboard-entry', campaignId],
    queryFn: () => getMyLeaderboardEntry(campaignId as string),
    enabled: isAuthenticated && Boolean(campaignId),
  });
}
