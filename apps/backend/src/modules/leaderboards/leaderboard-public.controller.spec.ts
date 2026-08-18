import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { ANONYMOUS_VIEWER, type AudienceViewer } from '../audience/audience';
import { OptionalPlayerAuthService } from '../auth/optional-player-auth.service';
import { PricedMatchesService } from '../margins/priced-matches.service';
import { ViewerResolverService } from '../margins/viewer-resolver.service';
import { LeaderboardCampaignService } from './leaderboard-campaign.service';
import { LeaderboardPublicController } from './leaderboard-public.controller';

function campaign(id: string, audienceMode: 'ALL' | 'LOGGED_OUT' | 'LOGGED_IN' | 'SEGMENTS', segmentIds: string[] = []) {
  return { id, audienceMode, segments: segmentIds.map((segmentId) => ({ segmentId })) };
}

describe('LeaderboardPublicController', () => {
  async function buildController(campaigns: ReturnType<typeof campaign>[], viewer: AudienceViewer = ANONYMOUS_VIEWER) {
    const leaderboardCampaignService = { listEnabled: vi.fn().mockResolvedValue(campaigns) };
    const pricedMatchesService = {};
    const viewerResolverService = { resolve: vi.fn().mockResolvedValue(viewer) };
    const optionalPlayerAuthService = { resolve: vi.fn().mockResolvedValue(null) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardPublicController],
      providers: [
        { provide: LeaderboardCampaignService, useValue: leaderboardCampaignService },
        { provide: PricedMatchesService, useValue: pricedMatchesService },
        { provide: ViewerResolverService, useValue: viewerResolverService },
        { provide: OptionalPlayerAuthService, useValue: optionalPlayerAuthService },
      ],
    }).compile();

    return {
      controller: moduleRef.get(LeaderboardPublicController),
      viewerResolverService,
    };
  }

  it('resolves the viewer from the Authorization header', async () => {
    const { controller, viewerResolverService } = await buildController([]);

    await controller.list('brand-1', 'Bearer some-token');

    expect(viewerResolverService.resolve).toHaveBeenCalledWith('Bearer some-token');
  });

  it('includes ALL and LOGGED_OUT campaigns for an anonymous viewer, excluding SEGMENTS-only ones', async () => {
    const { controller } = await buildController(
      [campaign('c-all', 'ALL'), campaign('c-logged-out', 'LOGGED_OUT'), campaign('c-segments', 'SEGMENTS', ['seg-1'])],
      ANONYMOUS_VIEWER,
    );

    const result = await controller.list('brand-1', undefined);

    expect(result.map((entry) => entry.id)).toEqual(['c-all', 'c-logged-out']);
  });

  it('includes a SEGMENTS campaign only for a viewer who is actually in that segment', async () => {
    const { controller } = await buildController(
      [campaign('c-segments', 'SEGMENTS', ['seg-1']), campaign('c-other-segment', 'SEGMENTS', ['seg-2'])],
      { isLoggedIn: true, segmentIds: ['seg-1'] },
    );

    const result = await controller.list('brand-1', 'Bearer token');

    expect(result.map((entry) => entry.id)).toEqual(['c-segments']);
  });

  it('excludes LOGGED_OUT campaigns once the viewer is logged in', async () => {
    const { controller } = await buildController(
      [campaign('c-all', 'ALL'), campaign('c-logged-out', 'LOGGED_OUT'), campaign('c-logged-in', 'LOGGED_IN')],
      { isLoggedIn: true, segmentIds: [] },
    );

    const result = await controller.list('brand-1', 'Bearer token');

    expect(result.map((entry) => entry.id)).toEqual(['c-all', 'c-logged-in']);
  });
});
