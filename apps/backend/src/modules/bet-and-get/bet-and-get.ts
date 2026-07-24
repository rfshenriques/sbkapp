export interface CampaignScope {
  scopeType: 'SPORT' | 'COMPETITION' | 'MATCH';
  scopeValue: string;
}

export interface ScopeMatchInput {
  sport: string;
  competition: string;
  matchId: string;
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

export interface CampaignConditions {
  minStakeCents: number | null;
  minOddsPerLeg: number | null;
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
