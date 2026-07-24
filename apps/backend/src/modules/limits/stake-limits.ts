import type { LimitScope } from '@prisma/client';

export type { LimitScope };

export interface StakeLimitRow {
  scope: LimitScope;
  /** "" for GLOBAL, otherwise the raw feed sport/country/competition/market name. */
  scopeValue: string;
  /** 0 = applies regardless of tier. */
  tier: number;
  maxStakeCents: number | null;
  maxLiabilityCents: number | null;
}

/** Everything about one leg needed to resolve its applicable limit row. */
export interface LegContext {
  sport: string;
  country: string;
  competition: string;
  marketName: string;
  /** undefined when the competition has no CompetitionTier row - only tier-agnostic rows can apply. */
  tier: number | undefined;
}

type LimitField = 'maxStakeCents' | 'maxLiabilityCents';

/** Most specific to least specific - the first matching row with a non-null value for the field wins. */
const SCOPE_PRECEDENCE: LimitScope[] = ['MARKET', 'LEAGUE', 'COUNTRY', 'SPORT', 'GLOBAL'];

function scopeValueFor(scope: LimitScope, leg: LegContext): string {
  switch (scope) {
    case 'MARKET':
      return leg.marketName;
    case 'LEAGUE':
      return leg.competition;
    case 'COUNTRY':
      return leg.country;
    case 'SPORT':
      return leg.sport;
    case 'GLOBAL':
      return '';
    case 'PLAYER':
      // Never reached: PLAYER is resolved separately in resolveBetLimit, not part of SCOPE_PRECEDENCE.
      throw new Error('PLAYER scope is not resolved via scopeValueFor');
  }
}

function resolveField(rows: StakeLimitRow[], leg: LegContext, field: LimitField): number | null {
  for (const scope of SCOPE_PRECEDENCE) {
    const value = scopeValueFor(scope, leg);
    const candidates = rows.filter((row) => row.scope === scope && row.scopeValue === value);
    if (leg.tier !== undefined) {
      const tierSpecific = candidates.find((row) => row.tier === leg.tier && row[field] !== null);
      if (tierSpecific) {
        return tierSpecific[field];
      }
    }
    const tierAgnostic = candidates.find((row) => row.tier === 0 && row[field] !== null);
    if (tierAgnostic) {
      return tierAgnostic[field];
    }
  }
  return null;
}

/** Resolves one leg's own effective cap, cascading MARKET -> LEAGUE -> COUNTRY -> SPORT -> GLOBAL, tier-specific before tier-agnostic. */
export function resolveLegLimit(
  rows: StakeLimitRow[],
  leg: LegContext,
): { maxStakeCents: number | null; maxLiabilityCents: number | null } {
  return {
    maxStakeCents: resolveField(rows, leg, 'maxStakeCents'),
    maxLiabilityCents: resolveField(rows, leg, 'maxLiabilityCents'),
  };
}

function minIgnoringNull(values: (number | null)[]): number | null {
  const real = values.filter((value): value is number => value !== null);
  return real.length === 0 ? null : Math.min(...real);
}

/** What a player already has riding on their currently-unsettled (PENDING) bets, before this new one - see PamService. */
export interface PlayerExposure {
  userId: string;
  existingStakedCents: number;
  existingLiabilityCents: number;
}

/**
 * A single bet is just a one-leg accumulator here - resolving "the smallest
 * cap across legs" for a single selection degenerates to that selection's
 * own cap. For 2+ legs, each leg resolves its own cap independently (its
 * own sport/country/competition/market/tier), and the bet's effective cap
 * is the smallest one found - a book's real exposure on an accumulator is
 * bounded by whichever leg is most restrictive, e.g. one leg capped at
 * €1000 and another at €400 means the whole bet is capped at €400.
 *
 * When `player` is supplied and a PLAYER-scoped row exists for their
 * userId, that row overrides the market/league/sport/global cascade
 * outright for whichever field it sets (a null field on the player row
 * falls back to the cascade) - the most specific possible target beats
 * even a MARKET-level cap. The override is exposure-aware: the player's
 * own cap is a ceiling on their *total* outstanding stake/liability, not
 * just this one bet in isolation, so headroom shrinks by whatever they
 * already have riding on other PENDING bets.
 */
export function resolveBetLimit(
  rows: StakeLimitRow[],
  legs: LegContext[],
  player?: PlayerExposure,
): { maxStakeCents: number | null; maxLiabilityCents: number | null } {
  const perLeg = legs.map((leg) => resolveLegLimit(rows, leg));
  const cascaded = {
    maxStakeCents: minIgnoringNull(perLeg.map((limit) => limit.maxStakeCents)),
    maxLiabilityCents: minIgnoringNull(perLeg.map((limit) => limit.maxLiabilityCents)),
  };

  const playerRow = player
    ? rows.find((row) => row.scope === 'PLAYER' && row.scopeValue === player.userId)
    : undefined;
  if (!player || !playerRow) {
    return cascaded;
  }

  return {
    maxStakeCents:
      playerRow.maxStakeCents === null
        ? cascaded.maxStakeCents
        : Math.max(0, playerRow.maxStakeCents - player.existingStakedCents),
    maxLiabilityCents:
      playerRow.maxLiabilityCents === null
        ? cascaded.maxLiabilityCents
        : Math.max(0, playerRow.maxLiabilityCents - player.existingLiabilityCents),
  };
}
