export interface InsuranceBetConfigValues {
  costPercent: number;
  enabled: boolean;
  /** Insurance only ever applies to a bet whose combined odds are at least this - see meetsInsuranceMinOdds. */
  minOdds: number;
}

/** Whether a bet's combined odds clear the brand's configured floor for insurance to even be offered. */
export function meetsInsuranceMinOdds(combinedOdds: number, config: InsuranceBetConfigValues): boolean {
  return combinedOdds >= config.minOdds;
}

export interface InsuranceBetPricing {
  /** The percent actually deducted - 0 when the player didn't opt in or the feature is off. */
  costPercent: number;
  /** rawPayoutCents after the cost percent reduction - what the player's stake actually buys if this bet wins. */
  insuredPayoutCents: number;
}

/**
 * Applies only when the player opts in AND the brand has insurance enabled -
 * otherwise the raw payout passes straight through unchanged. Works for
 * both a single bet and an accumulator; there's no minimum leg count the
 * way acca boost/rollback have, since insurance is priced per-bet, not
 * per-leg.
 */
export function calculateInsuredPayout(
  rawPayoutCents: number,
  optIn: boolean,
  config: InsuranceBetConfigValues,
): InsuranceBetPricing {
  const applies = optIn && config.enabled;
  if (!applies) {
    return { costPercent: 0, insuredPayoutCents: rawPayoutCents };
  }

  const insuredPayoutCents = Math.round(rawPayoutCents * (1 - config.costPercent / 100));
  return { costPercent: config.costPercent, insuredPayoutCents };
}
