import { Injectable } from '@nestjs/common';
import type { Match } from '@sportsbook/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { applyMargin, marginConfigKey } from './margin-pricing';

@Injectable()
export class MarginPricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns matches with every selection's odds margin-adjusted per the
   * brand's CompetitionTier/MarginConfig. A match whose competition has no
   * assigned tier, or a market with no margin configured for its tier,
   * passes through with its raw feed odds unchanged - margin is only ever
   * applied where a trader has explicitly configured it.
   */
  async applyMarginToMatches(brandId: string, matches: Match[]): Promise<Match[]> {
    const [tiers, marginConfigs] = await Promise.all([
      this.prisma.competitionTier.findMany({ where: { brandId } }),
      this.prisma.marginConfig.findMany({ where: { brandId } }),
    ]);

    const tierByCompetition = new Map(tiers.map((row) => [row.competition, row.tier]));
    const marginByKey = new Map(
      marginConfigs.map((row) => [marginConfigKey(row.sport, row.tier, row.marketName), row.marginPercent]),
    );

    return matches.map((match) => {
      const tier = tierByCompetition.get(match.competition);
      if (tier === undefined) {
        return match;
      }
      return {
        ...match,
        markets: match.markets.map((market) => {
          const marginPercent = marginByKey.get(marginConfigKey(match.sport, tier, market.name));
          if (marginPercent === undefined) {
            return market;
          }
          return {
            ...market,
            selections: market.selections.map((selection) => ({
              ...selection,
              odds: applyMargin(selection.odds, marginPercent),
            })),
          };
        }),
      };
    });
  }
}
