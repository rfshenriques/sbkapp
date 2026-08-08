import { useMutation, useQueryClient } from '@tanstack/react-query';
import { joinLeaderboardCampaign } from '../../lib/backendApi';
import { useAuthModalStore } from '../auth/authModalStore';
import { useAuth } from '../auth/useAuth';
import { useMyLeaderboardEntry } from './useMyLeaderboardEntry';

interface JoinLeaderboardButtonProps {
  campaignId: string;
}

/**
 * "Participate" opt-in - a leaderboard never tracks a player's bets until
 * they've explicitly joined (see LeaderboardCampaignService.
 * resolveLinkableCampaigns), so this is the only way onto the board.
 * Idempotent both server-side and here: once joined, this permanently
 * renders as a plain confirmation rather than a repeatable action - there's
 * nothing to undo, and re-clicking would just no-op on the backend anyway.
 */
export function JoinLeaderboardButton({ campaignId }: JoinLeaderboardButtonProps) {
  const { isAuthenticated } = useAuth();
  const openAuthModal = useAuthModalStore((state) => state.open);
  const queryClient = useQueryClient();
  const { data: myEntry, isPending: myEntryPending } = useMyLeaderboardEntry(campaignId);

  const joinMutation = useMutation({
    mutationFn: () => joinLeaderboardCampaign(campaignId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-leaderboard-entry', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard-campaign-entries'] });
    },
  });

  if (!isAuthenticated) {
    return (
      <button type="button" className="btn-primary w-full" onClick={() => openAuthModal('login')}>
        Log in to participate
      </button>
    );
  }

  if (myEntryPending) {
    return (
      <div className="h-11 w-full animate-pulse rounded-xl bg-surface-2" aria-label="Checking entry status" role="status" />
    );
  }

  if (myEntry || joinMutation.isSuccess) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-highlight/40 bg-surface-2 py-2.5 text-sm font-semibold text-highlight">
        You're in - good luck!
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      disabled={joinMutation.isPending}
      onClick={() => joinMutation.mutate()}
    >
      {joinMutation.isPending ? 'Joining…' : 'Participate'}
    </button>
  );
}
