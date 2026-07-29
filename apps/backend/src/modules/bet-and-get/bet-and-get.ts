export interface CampaignScope {
  scopeType: 'SPORT' | 'COMPETITION' | 'MATCH';
  scopeValue: string;
}

export interface ScopeMatchInput {
  sport: string;
  competition: string;
  matchId: string;
  isLive: boolean;
}

/**
 * A campaign's full match scope is the union of every one of its scope
 * rows (e.g. "all of Sport X" OR "all of Competition Y" OR "this one
 * Match Z"). A campaign with no scopes at all matches nothing - an empty
 * list is never treated as "everything".
 */
export function matchIsInCampaignScope(scopes: CampaignScope[], match: ScopeMatchInput): boolean {
  return scopes.some((scope) => {
    switch (scope.scopeType) {
      case 'SPORT':
        return scope.scopeValue === match.sport;
      case 'COMPETITION':
        return scope.scopeValue === match.competition;
      case 'MATCH':
        return scope.scopeValue === match.matchId;
    }
  });
}

/**
 * Whether a match's current live status satisfies the campaign's required
 * betting timing. EITHER never restricts anything.
 */
export function matchTimingQualifies(timing: 'PREMATCH_ONLY' | 'INPLAY_ONLY' | 'EITHER', isLive: boolean): boolean {
  if (timing === 'PREMATCH_ONLY') return !isLive;
  if (timing === 'INPLAY_ONLY') return isLive;
  return true;
}

export interface CampaignSchedule {
  enabled: boolean;
  startAt: Date | null;
  endAt: Date | null;
}

/**
 * Whether a campaign is actually live right now - both the staff-controlled
 * enabled flag AND (if set) within its optional start/end window. Either
 * boundary is optional independently: a startAt with no endAt runs forever
 * once it begins, an endAt with no startAt is already running. Shared by
 * BetAndGetCampaignService and DepositCampaignService's "enabled" gates.
 */
export function isCampaignScheduledActive(campaign: CampaignSchedule, now: Date = new Date()): boolean {
  if (!campaign.enabled) {
    return false;
  }
  if (campaign.startAt !== null && now < campaign.startAt) {
    return false;
  }
  if (campaign.endAt !== null && now > campaign.endAt) {
    return false;
  }
  return true;
}

export interface CampaignConditions {
  minStakeCents: number | null;
  minOddsPerLeg: number | null;
  /**
   * Combined/accumulator price (product of all legs' odds), distinct from
   * minOddsPerLeg's per-leg floor. Optional (not just nullable) because
   * DepositCampaign, the other consumer of this shared interface, has no
   * such column at all - absent is treated identically to null.
   */
  minCombinedOdds?: number | null;
  betType: 'SINGLES_ONLY' | 'ACCUMULATOR_ONLY' | 'EITHER';
  minSelections: number | null;
}

export interface QualifyingBetInput {
  stakeCents: number;
  legOdds: number[];
}

/**
 * Every configured condition is independently optional (null = doesn't
 * restrict anything) and all configured ones must pass - not an OR of
 * conditions. minSelections only applies once the bet is already an
 * accumulator (2+ legs); it's not a way to force a single-leg bet not to
 * qualify on its own (betType handles that).
 */
export function betQualifiesForCampaign(conditions: CampaignConditions, bet: QualifyingBetInput): boolean {
  if (conditions.minStakeCents !== null && bet.stakeCents < conditions.minStakeCents) {
    return false;
  }
  if (conditions.minOddsPerLeg !== null && bet.legOdds.some((odds) => odds < conditions.minOddsPerLeg!)) {
    return false;
  }
  if (conditions.minCombinedOdds != null) {
    const combinedOdds = bet.legOdds.reduce((product, odds) => product * odds, 1);
    if (combinedOdds < conditions.minCombinedOdds) {
      return false;
    }
  }

  const isAccumulator = bet.legOdds.length > 1;
  if (conditions.betType === 'SINGLES_ONLY' && isAccumulator) {
    return false;
  }
  if (conditions.betType === 'ACCUMULATOR_ONLY' && !isAccumulator) {
    return false;
  }
  if (conditions.minSelections !== null && isAccumulator && bet.legOdds.length < conditions.minSelections) {
    return false;
  }

  return true;
}

export interface BetAndGetRewardRules {
  rewardType: 'FIXED' | 'PERCENTAGE';
  rewardAmountCents: number | null;
  rewardPercent: number | null;
  rewardCapCents: number | null;
}

/**
 * The freebet amount a qualifying bet earns. FIXED always pays the same
 * rewardAmountCents; PERCENTAGE pays a share of that specific bet's own
 * stake, capped so a very large stake can't produce an unbounded reward -
 * same shape/rounding as DepositCampaign's computeDepositReward.
 */
export function calculateBetAndGetRewardCents(rules: BetAndGetRewardRules, stakeCents: number): number {
  if (rules.rewardType === 'FIXED') {
    return rules.rewardAmountCents!;
  }

  const uncapped = Math.round((stakeCents * rules.rewardPercent!) / 100);
  return Math.min(uncapped, rules.rewardCapCents!);
}
