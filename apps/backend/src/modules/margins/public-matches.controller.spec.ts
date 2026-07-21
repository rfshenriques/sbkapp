import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarginPricingService } from './margin-pricing.service';
import { OddsEngineClient } from './odds-engine-client';
import { PublicMatchesController } from './public-matches.controller';

const rawMatch: Match = {
  id: 'match-1',
  sport: 'Football',
  country: 'England',
  competition: 'EPL',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: '2026-07-18T15:00:00Z',
  isLive: false,
  markets: [],
};

const pricedMatch: Match = { ...rawMatch, markets: [{ id: 'm', name: 'Match Result', selections: [] }] };

describe('PublicMatchesController', () => {
  let controller: PublicMatchesController;
  let oddsEngineClient: { fetchMatches: ReturnType<typeof vi.fn>; fetchMatchById: ReturnType<typeof vi.fn> };
  let marginPricingService: { applyMarginToMatches: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    oddsEngineClient = {
      fetchMatches: vi.fn().mockResolvedValue([rawMatch]),
      fetchMatchById: vi.fn().mockResolvedValue(rawMatch),
    };
    marginPricingService = {
      applyMarginToMatches: vi.fn().mockResolvedValue([pricedMatch]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicMatchesController],
      providers: [
        { provide: OddsEngineClient, useValue: oddsEngineClient },
        { provide: MarginPricingService, useValue: marginPricingService },
      ],
    }).compile();

    controller = moduleRef.get(PublicMatchesController);
  });

  it('fetches raw matches from odds-engine and returns the margin-priced result for the requested brand', async () => {
    const result = await controller.listForBrand('brand-1');

    expect(oddsEngineClient.fetchMatches).toHaveBeenCalled();
    expect(marginPricingService.applyMarginToMatches).toHaveBeenCalledWith('brand-1', [rawMatch]);
    expect(result).toEqual([pricedMatch]);
  });

  it('fetches a single raw match by id and returns its margin-priced form for the requested brand', async () => {
    const result = await controller.getForBrand('brand-1', 'match-1');

    expect(oddsEngineClient.fetchMatchById).toHaveBeenCalledWith('match-1');
    expect(marginPricingService.applyMarginToMatches).toHaveBeenCalledWith('brand-1', [rawMatch]);
    expect(result).toEqual(pricedMatch);
  });
});
