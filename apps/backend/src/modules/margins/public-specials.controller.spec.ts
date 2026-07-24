import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANONYMOUS_VIEWER } from '../audience/audience';
import { PricedMatchesService } from './priced-matches.service';
import { PublicSpecialsController } from './public-specials.controller';
import { ViewerResolverService } from './viewer-resolver.service';

const matchWithSpecial: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'EPL',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [
    { id: 'match-result', name: 'Match Result', selections: [] },
    { id: 'manual-1', name: 'Anytime Assist', selections: [], isSpecial: true },
  ],
};

const matchWithoutSpecials: Match = {
  ...matchWithSpecial,
  id: 'match-2',
  markets: [{ id: 'match-result', name: 'Match Result', selections: [] }],
};

describe('PublicSpecialsController', () => {
  let controller: PublicSpecialsController;
  let pricedMatchesService: { listForBrand: ReturnType<typeof vi.fn> };
  let viewerResolverService: { resolve: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    pricedMatchesService = {
      listForBrand: vi.fn().mockResolvedValue([matchWithSpecial, matchWithoutSpecials]),
    };
    viewerResolverService = {
      resolve: vi.fn().mockResolvedValue(ANONYMOUS_VIEWER),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicSpecialsController],
      providers: [
        { provide: PricedMatchesService, useValue: pricedMatchesService },
        { provide: ViewerResolverService, useValue: viewerResolverService },
      ],
    }).compile();

    controller = moduleRef.get(PublicSpecialsController);
  });

  it('returns only matches that have at least one special market, with only the special markets kept', async () => {
    const result = await controller.listForBrand('brand-1', 'Bearer some-token');

    expect(viewerResolverService.resolve).toHaveBeenCalledWith('Bearer some-token');
    expect(pricedMatchesService.listForBrand).toHaveBeenCalledWith('brand-1', ANONYMOUS_VIEWER);
    expect(result).toEqual([
      { ...matchWithSpecial, markets: [{ id: 'manual-1', name: 'Anytime Assist', selections: [], isSpecial: true }] },
    ]);
  });
});
