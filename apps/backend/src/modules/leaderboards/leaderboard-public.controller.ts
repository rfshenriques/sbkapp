import { Controller, Get, Headers, NotFoundException, Param } from '@nestjs/common';
import { resolveAudience } from '../audience/audience';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { PricedMatchesService } from '../margins/priced-matches.service';
import { ViewerResolverService } from '../margins/viewer-resolver.service';
import { matchIsInCampaignScope, matchTimingQualifies } from '../bet-and-get/bet-and-get';
import { LeaderboardCampaignService } from './leaderboard-campaign.service';
import { maskUsername } from './username-mask';

/** Unauthenticated, player-facing - backs the Leaderboards list/detail pages and the match-detail context banner. Only ever surfaces enabled campaigns. */
@Controller('public/leaderboard-campaigns')
export class LeaderboardPublicController {
  constructor(
    private readonly leaderboardCampaignService: LeaderboardCampaignService,
    private readonly pricedMatchesService: PricedMatchesService,
    private readonly viewerResolverService: ViewerResolverService,
    private readonly optionalPlayerAuthService: OptionalPlayerAuthService,
  ) {}

  /** Segment-gated, same as Boosts/Specials/Promo cards - a SEGMENTS-only campaign never appears for a viewer outside it, logged in or not. */
  @Get(':brandId')
  async list(@Param('brandId') brandId: string, @Headers('authorization') authorization?: string) {
    const [campaigns, viewer] = await Promise.all([
      this.leaderboardCampaignService.listEnabled(brandId),
      this.viewerResolverService.resolve(authorization),
    ]);
    return campaigns.filter((campaign) =>
      resolveAudience(campaign.audienceMode, campaign.segments.map((segment) => segment.segmentId), viewer),
    );
  }

  @Get(':brandId/:id')
  async get(@Param('brandId') brandId: string, @Param('id') id: string) {
    const campaigns = await this.leaderboardCampaignService.listEnabled(brandId);
    const campaign = campaigns.find((entry) => entry.id === id);
    if (!campaign) {
      throw new NotFoundException('Leaderboard campaign not found');
    }
    return campaign;
  }

  /**
   * Ranked entries with every non-viewer username masked to its first 3
   * characters + '****' (see maskUsername) - the real username is never
   * sent over the wire for anyone but the requesting player's own row.
   * isViewer is always computed server-side from the resolved auth token,
   * never trusted from a client-supplied flag.
   */
  @Get(':brandId/:id/entries')
  async getEntries(
    @Param('brandId') brandId: string,
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const campaigns = await this.leaderboardCampaignService.listEnabled(brandId);
    if (!campaigns.some((entry) => entry.id === id)) {
      throw new NotFoundException('Leaderboard campaign not found');
    }

    const payload = await this.optionalPlayerAuthService.resolve(authorization);
    const ranked = await this.leaderboardCampaignService.getRankedEntries(id);

    return ranked.map((entry, index) => {
      const isViewer = payload !== null && entry.userId === payload.sub;
      return {
        entryId: entry.id,
        rank: index + 1,
        pointsTotal: entry.pointsTotal,
        maskedUsername: maskUsername(entry.user.username),
        username: isViewer ? entry.user.username : null,
        isViewer,
      };
    });
  }

  /** Every enabled campaign covering this one match - backs the match-detail context banner. */
  @Get(':brandId/match/:matchId')
  async forMatch(
    @Param('brandId') brandId: string,
    @Param('matchId') matchId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer = await this.viewerResolverService.resolve(authorization);
    const match = await this.pricedMatchesService.getForBrand(brandId, matchId, viewer);
    const campaigns = await this.leaderboardCampaignService.listEnabled(brandId);
    const scopeMatch = { sport: match.sport, competition: match.competition, matchId: match.id, isLive: match.isLive };

    return campaigns
      .filter((campaign) => matchIsInCampaignScope(campaign.scopes, scopeMatch))
      .map((campaign) => ({
        ...campaign,
        timingBlocked: !matchTimingQualifies(campaign.bettingTiming, match.isLive),
      }));
  }
}
