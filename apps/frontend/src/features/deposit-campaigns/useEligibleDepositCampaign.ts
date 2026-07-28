import { useQuery } from '@tanstack/react-query';
import { getEligibleDepositCampaign } from '../../lib/backendApi';
import { useAuth } from '../auth/useAuth';

export const eligibleDepositCampaignQueryKey = ['deposit-campaigns', 'eligible'] as const;

/**
 * The same eligibility check runPostLoginDepositCheck fires once at login,
 * wrapped as a live query so the header balance pill can show a badge for
 * as long as the player has an unredeemed deposit campaign available - not
 * just in the instant right after they log in.
 */
export function useEligibleDepositCampaign() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: eligibleDepositCampaignQueryKey,
    queryFn: getEligibleDepositCampaign,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}
