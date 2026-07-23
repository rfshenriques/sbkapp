import { Test, type TestingModule } from '@nestjs/testing';
import type { Match } from '@sportsbook/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoostService } from '../boosts/boost.service';
import { ManualMarketService } from '../manual-markets/manual-market.service';
import { OddsOverrideService } from '../odds-override/odds-override.service';
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
const withManualMarketsMatch: Match = {
  ...pricedMatch,
  markets: [...pricedMatch.markets, { id: 'manual-1', name: 'Novelty', selections: [] }],
};
const overriddenMatch: Match = {
  ...withManualMarketsMatch,
  markets: [{ ...withManualMarketsMatch.markets[0]!, name: 'overridden' }, ...withManualMarketsMatch.markets.slice(1)],
};
const boostedMatch: Match = {
  ...overriddenMatch,
  markets: [{ ...overriddenMatch.markets[0]!, name: 'boosted' }, ...overriddenMatch.markets.slice(1)],
};

describe('PublicMatchesController', () => {
  let controller: PublicMatchesController;
  let oddsEngineClient: { fetchMatches: ReturnType<typeof vi.fn>; fetchMatchById: ReturnType<typeof vi.fn> };
  let marginPricingService: { applyMarginToMatches: ReturnType<typeof vi.fn> };
  let manualMarketService: { mergeIntoMatches: ReturnType<typeof vi.fn> };
  let oddsOverrideService: { applyOverrides: ReturnType<typeof vi.fn> };
  let boostService: { applyBoosts: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    oddsEngineClient = {
      fetchMatches: vi.fn().mockResolvedValue([rawMatch]),
      fetchMatchById: vi.fn().mockResolvedValue(rawMatch),
    };
    marginPricingService = {
      applyMarginToMatches: vi.fn().mockResolvedValue([pricedMatch]),
    };
    manualMarketService = {
      mergeIntoMatches: vi.fn().mockResolvedValue([withManualMarketsMatch]),
    };
    oddsOverrideService = {
      applyOverrides: vi.fn().mockResolvedValue([overriddenMatch]),
    };
    boostService = {
      applyBoosts: vi.fn().mockResolvedValue([boostedMatch]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicMatchesController],
      providers: [
        { provide: OddsEngineClient, useValue: oddsEngineClient },
        { provide: MarginPricingService, useValue: marginPricingService },
        { provide: ManualMarketService, useValue: manualMarketService },
        { provide: OddsOverrideService, useValue: oddsOverrideService },
        { provide: BoostService, useValue: boostService },
      ],
    }).compile();

    controller = moduleRef.get(PublicMatchesController);
  });

  it('fetches raw matches from odds-engine, margin-prices them, merges manual markets, applies odds overrides, then applies boosts for the requested brand', async () => {
    const result = await controller.listForBrand('brand-1');

    expect(oddsEngineClient.fetchMatches).toHaveBeenCalled();
    expect(marginPricingService.applyMarginToMatches).toHaveBeenCalledWith('brand-1', [rawMatch]);
    expect(manualMarketService.mergeIntoMatches).toHaveBeenCalledWith('brand-1', [pricedMatch]);
    expect(oddsOverrideService.applyOverrides).toHaveBeenCalledWith('brand-1', [withManualMarketsMatch]);
    expect(boostService.applyBoosts).toHaveBeenCalledWith('brand-1', [overriddenMatch]);
    expect(result).toEqual([boostedMatch]);
  });

  it('fetches a single raw match by id and returns its fully-priced form (margin, manual markets, overrides, boosts) for the requested brand', async () => {
    const result = await controller.getForBrand('brand-1', 'match-1');

    expect(oddsEngineClient.fetchMatchById).toHaveBeenCalledWith('match-1');
    expect(marginPricingService.applyMarginToMatches).toHaveBeenCalledWith('brand-1', [rawMatch]);
    expect(manualMarketService.mergeIntoMatches).toHaveBeenCalledWith('brand-1', [pricedMatch]);
    expect(oddsOverrideService.applyOverrides).toHaveBeenCalledWith('brand-1', [withManualMarketsMatch]);
    expect(boostService.applyBoosts).toHaveBeenCalledWith('brand-1', [overriddenMatch]);
    expect(result).toEqual(boostedMatch);
  });
});
