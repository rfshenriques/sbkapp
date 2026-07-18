import type { LiveMatchEvent, LiveMatchEventType, LiveMatchStat } from '@sportsbook/shared';
import type { ApiSportsEvent, ApiSportsTeamStatistics } from './types';

const EVENT_TYPE_MAP: Record<string, LiveMatchEventType> = {
  Goal: 'goal',
  Card: 'card',
  subst: 'substitution',
  Var: 'var',
};

function toEventType(raw: string): LiveMatchEventType {
  return EVENT_TYPE_MAP[raw] ?? 'var';
}

export function normalizeEvents(rawEvents: ApiSportsEvent[], homeTeamId: number): LiveMatchEvent[] {
  return rawEvents
    .map((event) => ({
      minute: event.time.elapsed,
      extraMinute: event.time.extra ?? undefined,
      type: toEventType(event.type),
      team: (event.team.id === homeTeamId ? 'home' : 'away') as 'home' | 'away',
      player: event.player.name ?? 'Unknown player',
      detail: event.detail,
      assistPlayer: event.assist.name ?? undefined,
    }))
    .sort((a, b) => b.minute - a.minute);
}

/**
 * api-sports returns one entry per team, in no guaranteed order - match each
 * to home/away by team id rather than assuming array position.
 */
export function normalizeStats(
  rawStats: ApiSportsTeamStatistics[],
  homeTeamId: number,
): LiveMatchStat[] {
  const home = rawStats.find((entry) => entry.team.id === homeTeamId);
  const away = rawStats.find((entry) => entry.team.id !== homeTeamId);
  if (!home || !away) return [];

  return home.statistics.map((stat, index) => ({
    type: stat.type,
    home: stat.value ?? 0,
    away: away.statistics[index]?.value ?? 0,
  }));
}
