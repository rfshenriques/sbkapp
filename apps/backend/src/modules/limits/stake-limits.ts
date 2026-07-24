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

/**
 * A single bet is just a one-leg accumulator here - resolving "the smallest
 * cap across legs" for a single selection degenerates to that selection's
 * own cap. For 2+ legs, each leg resolves its own cap independently (its
 * own sport/country/competition/market/tier), and the bet's effective cap
 * is the smallest one found - a book's real exposure on an accumulator is
 * bounded by whichever leg is most restrictive, e.g. one leg capped at
 * €1000 and another at €400 means the whole bet is capped at €400.
 */
export function resolveBetLimit(
  rows: StakeLimitRow[],
  legs: LegContext[],
): { maxStakeCents: number | null; maxLiabilityCents: number | null } {
  const perLeg = legs.map((leg) => resolveLegLimit(rows, leg));
  return {
    maxStakeCents: minIgnoringNull(perLeg.map((limit) => limit.maxStakeCents)),
    maxLiabilityCents: minIgnoringNull(perLeg.map((limit) => limit.maxLiabilityCents)),
  };
}
