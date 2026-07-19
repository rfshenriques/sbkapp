import type { LiveMatchEvent, LiveMatchState } from '@sportsbook/shared';
import { Card } from '../../components/ui/Card';

interface LiveMatchTrackerProps {
  state: LiveMatchState;
  homeTeam: string;
  awayTeam: string;
}

const EVENT_ICON: Record<LiveMatchEvent['type'], string> = {
  goal: '⚽',
  card: '🟨',
  substitution: '🔁',
  var: '📺',
};

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseFloat(value) || 0;
}

function barWidths(home: number | string, away: number | string): { home: number; away: number } {
  const homeNumber = toNumber(home);
  const awayNumber = toNumber(away);
  const total = homeNumber + awayNumber;
  if (total === 0) return { home: 50, away: 50 };
  return { home: (homeNumber / total) * 100, away: (awayNumber / total) * 100 };
}

export function LiveMatchTracker({ state, homeTeam, awayTeam }: LiveMatchTrackerProps) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-3 items-center gap-2 text-center">
          <p className="truncate font-semibold">{homeTeam}</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-display text-3xl tabular-nums">{state.homeScore}</span>
            <span className="text-text-muted">:</span>
            <span className="font-display text-3xl tabular-nums">{state.awayScore}</span>
          </div>
          <p className="truncate font-semibold">{awayTeam}</p>
        </div>
        <p className="mt-2 text-center font-display text-sm text-highlight">{state.minute}'</p>
      </Card>

      <Card>
        <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-text-secondary">
          <span>{homeTeam} pressure</span>
          <span>{awayTeam} pressure</span>
        </div>
        <div className="momentum-bar" role="img" aria-label="Match momentum">
          <span
            className="side home"
            style={{ flexBasis: `${state.momentum.home}%` }}
            aria-hidden="true"
          />
          <span
            className="side away"
            style={{ flexBasis: `${state.momentum.away}%` }}
            aria-hidden="true"
          />
        </div>
      </Card>

      {state.stats.length > 0 && (
        <Card>
          <h2 className="mb-3 font-display text-lg">Match stats</h2>
          <div className="space-y-3">
            {state.stats.map((stat) => {
              const widths = barWidths(stat.home, stat.away);
              return (
                <div key={stat.type} className="stat-row">
                  <div className="mb-1 grid grid-cols-3 items-center gap-2 text-sm">
                    <span className="tabular-nums">{stat.home}</span>
                    <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {stat.type}
                    </span>
                    <span className="text-right tabular-nums">{stat.away}</span>
                  </div>
                  <div className="bar">
                    <span className="side home" style={{ flexBasis: `${widths.home}%` }} />
                    <span className="side away" style={{ flexBasis: `${widths.away}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {state.events.length > 0 && (
        <Card>
          <h2 className="mb-3 font-display text-lg">Key events</h2>
          <ul className="space-y-2">
            {state.events.map((event, index) => (
              <li
                key={`${event.minute}-${event.type}-${index}`}
                className="flex items-start gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="w-9 shrink-0 font-display tabular-nums text-highlight">
                  {event.minute}
                  {event.extraMinute ? `+${event.extraMinute}` : ''}'
                </span>
                <span aria-hidden="true">{EVENT_ICON[event.type]}</span>
                <span>
                  <span className="font-semibold">{event.player}</span>
                  <span className="text-text-secondary">
                    {' '}
                    · {event.team === 'home' ? homeTeam : awayTeam} · {event.detail}
                    {event.assistPlayer ? ` (assist: ${event.assistPlayer})` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
