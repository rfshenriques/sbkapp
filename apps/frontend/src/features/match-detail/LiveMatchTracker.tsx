import { useState } from 'react';
import type { LiveMatchEvent, LiveMatchState } from '@sportsbook/shared';
import { Card } from '../../components/ui/Card';
import { ChevronIcon } from '../../components/ui/ChevronIcon';
import { GoalIcon, RedCardIcon, SubstitutionIcon, YellowCardIcon } from '../../components/ui/MatchEventIcons';
import { cn } from '../../lib/cn';

interface LiveMatchTrackerProps {
  state: LiveMatchState;
  homeTeam: string;
  awayTeam: string;
}

/** Stable per-event identity (events have no id of their own) - used both as a React key and to detect whether the "latest" event actually changed, versus just the same one re-arriving in an identical poll response. */
function eventKey(event: LiveMatchEvent): string {
  return `${event.minute}-${event.extraMinute ?? 0}-${event.type}-${event.player}-${event.detail}`;
}

function EventIcon({ event }: { event: LiveMatchEvent }) {
  switch (event.type) {
    case 'goal':
      return <GoalIcon width={18} height={18} className="shrink-0 text-highlight" />;
    case 'card':
      // The feed's `detail` free-text ("Yellow Card", "Red Card", "Second Yellow card") is the only signal for which card it was - there's no separate enum.
      return /red/i.test(event.detail) ? (
        <RedCardIcon width={15} height={15} className="shrink-0" />
      ) : (
        <YellowCardIcon width={15} height={15} className="shrink-0" />
      );
    case 'substitution':
      return <SubstitutionIcon width={18} height={18} className="shrink-0" />;
    case 'var':
      return (
        <span aria-hidden="true" className="shrink-0">
          📺
        </span>
      );
  }
}

function EventRow({
  event,
  animate,
  homeTeam,
  awayTeam,
}: {
  event: LiveMatchEvent;
  animate: boolean;
  homeTeam: string;
  awayTeam: string;
}) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0',
        animate && 'fade-in-up',
      )}
    >
      <span className="w-9 shrink-0 font-display tabular-nums text-highlight">
        {event.minute}
        {event.extraMinute ? `+${event.extraMinute}` : ''}'
      </span>
      <EventIcon event={event} />
      <span>
        <span className="font-semibold">{event.player}</span>
        <span className="text-text-secondary">
          {' '}
          · {event.team === 'home' ? homeTeam : awayTeam} · {event.detail}
          {event.assistPlayer ? ` (assist: ${event.assistPlayer})` : ''}
        </span>
      </span>
    </li>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const [latestEvent, ...olderEvents] = state.events;

  return (
    <div className="space-y-4">
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

      {latestEvent && (
        <Card>
          <h2 className="mb-3 font-display text-lg">Key events</h2>
          {/* Keyed by the event's own identity, not array index - a genuinely
              new latest event mounts a fresh node (replaying fade-in-up),
              while the same event re-arriving in a later poll reuses the
              existing one and never re-animates. */}
          <ul className="space-y-2" key={eventKey(latestEvent)}>
            <EventRow event={latestEvent} animate homeTeam={homeTeam} awayTeam={awayTeam} />
          </ul>

          {olderEvents.length > 0 && (
            <>
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-out',
                  expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="overflow-hidden">
                  <ul className="space-y-2 pt-2">
                    {olderEvents.map((event) => (
                      <EventRow
                        key={eventKey(event)}
                        event={event}
                        animate={false}
                        homeTeam={homeTeam}
                        awayTeam={awayTeam}
                      />
                    ))}
                  </ul>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                className="mt-2 flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-text-secondary"
              >
                {expanded ? 'Show less' : `Show ${olderEvents.length} more`}
                <ChevronIcon width={14} height={14} className={expanded ? 'rotate-180' : ''} />
              </button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
