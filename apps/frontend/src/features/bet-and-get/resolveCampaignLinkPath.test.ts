import { describe, expect, it } from 'vitest';
import type { Match } from '@sportsbook/shared';
import { resolveCampaignLinkPath } from './resolveCampaignLinkPath';

function buildMatch(id: string): Match {
  return {
    id,
    sport: 'Football',
    country: 'England',
    competition: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-25T15:00:00Z',
    isLive: false,
    markets: [],
  };
}

describe('resolveCampaignLinkPath', () => {
  it('links straight to the match when the scope resolves to exactly one', () => {
    expect(resolveCampaignLinkPath('campaign-1', [buildMatch('match-1')])).toBe('/matches/match-1');
  });

  it('links to the campaign matches listing when the scope resolves to more than one', () => {
    expect(resolveCampaignLinkPath('campaign-1', [buildMatch('match-1'), buildMatch('match-2')])).toBe(
      '/campaigns/campaign-1',
    );
  });

  it('links to the campaign matches listing when the scope resolves to zero (an honest empty state, not a dead link)', () => {
    expect(resolveCampaignLinkPath('campaign-1', [])).toBe('/campaigns/campaign-1');
  });
});
