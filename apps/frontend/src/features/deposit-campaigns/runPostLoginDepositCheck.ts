import * as backendApi from '../../lib/backendApi';
import { useDepositCampaignModalStore } from './depositCampaignModalStore';

/**
 * Shared by every login path (password form, biometric/passkey) so a
 * player sees the same eligible-deposit-campaign popup regardless of how
 * they signed in. Best-effort - a failed eligibility check just means no
 * popup, not a broken login.
 */
export function runPostLoginDepositCheck(): void {
  backendApi
    .getEligibleDepositCampaign()
    .then((campaign) => {
      if (campaign) useDepositCampaignModalStore.getState().open(campaign);
    })
    .catch(() => {});
}
