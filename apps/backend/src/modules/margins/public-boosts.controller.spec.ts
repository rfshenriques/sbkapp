import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANONYMOUS_VIEWER } from '../audience/audience';
import { PricedMatchesService } from './priced-matches.service';
import { PublicBoostsController } from './public-boosts.controller';
import { ViewerResolverService } from './viewer-resolver.service';

const matchWithBoost: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'EPL',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: 2.1, originalOdds: 2.0, maxStakeCents: 10_000 },
        { id: 'draw', name: 'Draw', odds: 3.2 },
      ],
    },
  ],
};

const matchWithoutBoosts: Match = {
  ...matchWithBoost,
  id: 'match-2',
  markets: [{ id: 'match-result', name: 'Match Result', selections: [{ id: 'home', name: 'Home', odds: 1.9 }] }],
};

describe('PublicBoostsController', () => {
  let controller: PublicBoostsController;
  let pricedMatchesService: { listForBrand: ReturnType<typeof vi.fn> };
  let viewerResolverService: { resolve: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    pricedMatchesService = {
      listForBrand: vi.fn().mockResolvedValue([matchWithBoost, matchWithoutBoosts]),
    };
    viewerResolverService = {
      resolve: vi.fn().mockResolvedValue(ANONYMOUS_VIEWER),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicBoostsController],
      providers: [
        { provide: PricedMatchesService, useValue: pricedMatchesService },
        { provide: ViewerResolverService, useValue: viewerResolverService },
      ],
    }).compile();

    controller = moduleRef.get(PublicBoostsController);
  });

  it('flattens boosted selections into line items carrying match/market context, previous/new price, and max stake', async () => {
    const result = await controller.listForBrand('brand-1', 'Bearer some-token');

    expect(viewerResolverService.resolve).toHaveBeenCalledWith('Bearer some-token');
    expect(pricedMatchesService.listForBrand).toHaveBeenCalledWith('brand-1', ANONYMOUS_VIEWER);
    expect(result).toEqual([
      {
        matchId: 'match-1',
        sport: 'Football',
        country: 'England',
        competition: 'EPL',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoff: '2026-07-18T15:00:00Z',
        isLive: false,
        marketId: 'match-result',
        marketName: 'Match Result',
        selectionId: 'home',
        selectionName: 'Home',
        previousOdds: 2.0,
        odds: 2.1,
        maxStakeCents: 10_000,
      },
    ]);
  });

  it('returns an empty list when nothing is boosted', async () => {
    pricedMatchesService.listForBrand.mockResolvedValue([matchWithoutBoosts]);

    const result = await controller.listForBrand('brand-1');

    expect(result).toEqual([]);
  });
});
