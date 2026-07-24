/**
 * Client-side mirror of the backend's insurance-bet.ts calculation - used
 * for the bet slip's live payout preview only. The backend recomputes and
 * locks in the real cost percent at placement time, so this is a UI
 * convenience, not the authoritative number.
 */
export interface InsuranceBetConfig {
  costPercent: number;
  enabled: boolean;
}

export interface InsuranceBetPricing {
  costPercent: number;
  insuredPayoutCents: number;
}

export function calculateInsuredPayout(
  rawPayoutCents: number,
  optIn: boolean,
  config: InsuranceBetConfig,
): InsuranceBetPricing {
  const applies = optIn && config.enabled;
  if (!applies) {
    return { costPercent: 0, insuredPayoutCents: rawPayoutCents };
  }

  const insuredPayoutCents = Math.round(rawPayoutCents * (1 - config.costPercent / 100));
  return { costPercent: config.costPercent, insuredPayoutCents };
}
