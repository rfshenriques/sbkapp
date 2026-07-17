import type { Market, Match, Selection } from '../../domain/odds';
import type { OddsApiIoOddsResponse, OddsApiIoOutcome } from './types';

/** Default source of truth when a bookmaker isn't specified explicitly. */
export const DEFAULT_BOOKMAKER = 'Betclic PT';

const SELECTION_LABELS: Record<string, Record<string, string>> = {
  ML: { home: 'Home', draw: 'Draw', away: 'Away' },
  'Double Chance': { '1X': 'Home or Draw', '12': 'Home or Away', X2: 'Draw or Away' },
  'Both Teams To Score': { yes: 'Yes', no: 'No' },
};

function outcomeLine(outcome: OddsApiIoOutcome): number | undefined {
  return typeof outcome.hdp === 'number' ? outcome.hdp : undefined;
}

function toMarketId(rawName: string, line: number | undefined): string {
  switch (rawName) {
    case 'ML':
      return 'match-result';
    case 'Double Chance':
      return 'double-chance';
    case 'Both Teams To Score':
      return 'btts';
    case 'Totals':
      return line === undefined ? 'totals' : `totals-${line}`;
    default:
      return rawName.toLowerCase().replace(/\s+/g, '-');
  }
}

const MARKET_NAMES: Record<string, string> = {
  ML: 'Match Result',
};

function toMarketName(rawName: string, line: number | undefined): string {
  if (rawName === 'Totals') {
    return line === undefined ? 'Total Goals' : `Total Goals ${line}`;
  }
  return MARKET_NAMES[rawName] ?? rawName;
}

function toSelections(rawName: string, outcome: OddsApiIoOutcome): Selection[] {
  if (rawName === 'Totals') {
    const line = outcomeLine(outcome);
    return [
      {
        id: 'over',
        name: line === undefined ? 'Over' : `Over ${line}`,
        odds: Number(outcome.over),
      },
      {
        id: 'under',
        name: line === undefined ? 'Under' : `Under ${line}`,
        odds: Number(outcome.under),
      },
    ];
  }

  const labels = SELECTION_LABELS[rawName];
  return Object.entries(outcome)
    .filter(([key]) => key !== 'hdp')
    .map(([key, value]) => ({
      id: key.toLowerCase(),
      name: labels?.[key] ?? key,
      odds: Number(value),
    }));
}

/**
 * Maps a raw odds-api.io /odds response to our internal Match/Market/Selection
 * shape, taking prices from a single bookmaker (see PROJECT_BRIEF.md odds
 * ingestion notes: we don't yet show per-bookmaker prices in the UI).
 */
export function normalizeOddsApiIoResponse(
  raw: OddsApiIoOddsResponse,
  bookmaker: string = DEFAULT_BOOKMAKER,
): Match {
  const bookmakerMarkets = raw.bookmakers[bookmaker] ?? [];

  const markets: Market[] = bookmakerMarkets.flatMap((bookmakerMarket) =>
    bookmakerMarket.odds.map((outcome) => {
      const line = outcomeLine(outcome);
      return {
        id: toMarketId(bookmakerMarket.name, line),
        name: toMarketName(bookmakerMarket.name, line),
        selections: toSelections(bookmakerMarket.name, outcome),
      };
    }),
  );

  return {
    id: String(raw.id),
    competition: raw.league.name,
    homeTeam: raw.home,
    awayTeam: raw.away,
    kickoff: raw.date,
    isLive: raw.status === 'live',
    markets,
  };
}
