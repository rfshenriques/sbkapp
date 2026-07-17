import type { Match } from '@sportsbook/shared';

function matchResultMarket(home: number, draw: number, away: number): Match['markets'] {
  return [
    {
      id: 'match-result',
      name: 'Match Result',
      selections: [
        { id: 'home', name: 'Home', odds: home },
        { id: 'draw', name: 'Draw', odds: draw },
        { id: 'away', name: 'Away', odds: away },
      ],
    },
  ];
}

export const mockMatches: Match[] = [
  {
    id: 'match-1',
    competition: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: '2026-07-18T15:00:00Z',
    isLive: false,
    markets: matchResultMarket(2.1, 3.4, 3.2),
  },
  {
    id: 'match-2',
    competition: 'Premier League',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester City',
    kickoff: '2026-07-18T17:30:00Z',
    isLive: false,
    markets: matchResultMarket(2.6, 3.5, 2.5),
  },
  {
    id: 'match-3',
    competition: 'La Liga',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    kickoff: '2026-07-17T22:04:00Z',
    isLive: true,
    markets: matchResultMarket(1.95, 3.6, 3.8),
  },
  {
    id: 'match-4',
    competition: 'La Liga',
    homeTeam: 'Atletico Madrid',
    awayTeam: 'Sevilla',
    kickoff: '2026-07-19T19:00:00Z',
    isLive: false,
    markets: matchResultMarket(1.75, 3.7, 4.5),
  },
  {
    id: 'match-5',
    competition: 'Serie A',
    homeTeam: 'Inter Milan',
    awayTeam: 'AC Milan',
    kickoff: '2026-07-19T21:45:00Z',
    isLive: false,
    markets: matchResultMarket(2.3, 3.3, 3.0),
  },
];
