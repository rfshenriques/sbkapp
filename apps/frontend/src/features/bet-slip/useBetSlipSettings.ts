import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBetSlipSettings, updateBetSlipSettings, type UpdateBetSlipSettingsPayload } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';
import { DEFAULT_QUICK_STAKES, useBetSlipSettingsStore } from './betSlipSettingsStore';

export const betSlipSettingsQueryKey = ['bet-slip-settings'] as const;

function centsToMajor(cents: number[]): number[] {
  return cents.map((value) => value / 100);
}

/**
 * Loads the logged-in player's server-stored bet slip settings into
 * betSlipSettingsStore, and resets the store back to defaults on logout -
 * the store itself stays a plain zustand store so every existing reader
 * (BetSlipPanel, StakeField, ...) keeps working unchanged, this is just its
 * one writer besides BetSlipSettingsPanel's own save action. Mount once,
 * inside BetSlipPanel regardless of auth state - the query is simply
 * disabled while logged out, same pattern as useWallet/useFreebets.
 */
export function useBetSlipSettings() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: betSlipSettingsQueryKey,
    queryFn: getBetSlipSettings,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      useBetSlipSettingsStore.setState({ autoUpdateOdds: false, quickStakes: DEFAULT_QUICK_STAKES });
      return;
    }
    if (!Array.isArray(query.data?.quickStakeCents)) return;
    useBetSlipSettingsStore.setState({
      autoUpdateOdds: query.data.autoUpdateOdds,
      quickStakes: centsToMajor(query.data.quickStakeCents),
    });
  }, [isAuthenticated, query.data]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateBetSlipSettingsPayload) => updateBetSlipSettings(payload),
    onSuccess: (settings) => {
      if (!Array.isArray(settings?.quickStakeCents)) return;
      queryClient.setQueryData(betSlipSettingsQueryKey, settings);
      useBetSlipSettingsStore.setState({
        autoUpdateOdds: settings.autoUpdateOdds,
        quickStakes: centsToMajor(settings.quickStakeCents),
      });
    },
  });

  return {
    // Updates the store immediately, before the request resolves - a
    // settings toggle/save should feel instant, same as it did back when
    // this was plain synchronous localStorage. onSuccess above still
    // re-syncs from the server's own response right after.
    setAutoUpdateOdds: (value: boolean) => {
      useBetSlipSettingsStore.setState({ autoUpdateOdds: value });
      mutation.mutate({ autoUpdateOdds: value });
    },
    setQuickStakes: (stakes: number[]) => {
      useBetSlipSettingsStore.setState({ quickStakes: stakes });
      mutation.mutate({ quickStakeCents: stakes.map((amount) => Math.round(amount * 100)) });
    },
  };
}
