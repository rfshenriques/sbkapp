import { useEffect, useState } from 'react';
import type { Match } from '@sportsbook/shared';
import { MatchDrilldown } from '../../components/MatchDrilldown';
import { Button } from '../../components/ui/Button';
import type { BetAndGetScopeType } from '../../lib/backendApi';

export interface CampaignScopeEntry {
  scopeType: BetAndGetScopeType;
  scopeValue: string;
}

interface CampaignScopeEditorProps {
  idPrefix: string;
  initialScopes: CampaignScopeEntry[];
  onSave: (scopes: CampaignScopeEntry[]) => void;
  isSaving: boolean;
  matches: Match[] | undefined;
  matchesLoading: boolean;
  matchesError: boolean;
}

/** Sport/competition/match scope picker - shared by Bet & Get and Leaderboard campaigns (both need match-level scoping via the live-matches drilldown). */
export function CampaignScopeEditor({
  idPrefix,
  initialScopes,
  onSave,
  isSaving,
  matches,
  matchesLoading,
  matchesError,
}: CampaignScopeEditorProps) {
  const [draft, setDraft] = useState(initialScopes);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => setDraft(initialScopes), [initialScopes]);

  function has(scopeType: BetAndGetScopeType, scopeValue: string): boolean {
    return draft.some((entry) => entry.scopeType === scopeType && entry.scopeValue === scopeValue);
  }
  function add(scopeType: BetAndGetScopeType, scopeValue: string) {
    if (has(scopeType, scopeValue)) return;
    setDraft((previous) => [...previous, { scopeType, scopeValue }]);
  }
  function remove(scopeType: BetAndGetScopeType, scopeValue: string) {
    setDraft((previous) => previous.filter((entry) => !(entry.scopeType === scopeType && entry.scopeValue === scopeValue)));
  }

  const isDirty =
    draft.length !== initialScopes.length ||
    draft.some((entry) => !initialScopes.some((s) => s.scopeType === entry.scopeType && s.scopeValue === entry.scopeValue));

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-xs text-text-secondary">
          Sports, competitions, and matches this campaign applies to (a bet only qualifies when every one of its
          selections falls within this scope)
        </span>
        {draft.length === 0 && <p className="mt-1 text-sm text-text-secondary">No scope set yet - this campaign matches nothing.</p>}
        {draft.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {draft.map((entry) => (
              <span
                key={`${entry.scopeType}:${entry.scopeValue}`}
                className="flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs"
              >
                <span className="text-text-muted">{entry.scopeType}</span> {entry.scopeValue}
                <button
                  type="button"
                  aria-label={`Remove ${entry.scopeValue} from scope`}
                  onClick={() => remove(entry.scopeType, entry.scopeValue)}
                  className="ml-1 text-text-muted hover:text-danger"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Button variant="ghost" onClick={() => setIsPicking((value) => !value)}>
        {isPicking ? 'Hide match picker' : 'Add from live matches'}
      </Button>

      {isPicking && (
        <MatchDrilldown
          matches={matches}
          isLoading={matchesLoading}
          isError={matchesError}
          renderLeague={(node) => {
            const sport = node.matches[0]?.sport;
            return (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {sport && (
                    <Button variant="secondary" disabled={has('SPORT', sport)} onClick={() => add('SPORT', sport)}>
                      {has('SPORT', sport) ? `Sport "${sport}" added` : `Add whole sport: ${sport}`}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={has('COMPETITION', node.competition)}
                    onClick={() => add('COMPETITION', node.competition)}
                  >
                    {has('COMPETITION', node.competition)
                      ? `Competition "${node.competition}" added`
                      : `Add whole competition: ${node.competition}`}
                  </Button>
                </div>
                <div className="space-y-1">
                  {node.matches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {match.homeTeam} vs {match.awayTeam}
                      </span>
                      <Button variant="ghost" disabled={has('MATCH', match.id)} onClick={() => add('MATCH', match.id)}>
                        {has('MATCH', match.id) ? 'Added' : 'Add match'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        />
      )}

      <Button variant="secondary" disabled={!isDirty || isSaving} onClick={() => onSave(draft)} aria-label={`save scope ${idPrefix}`}>
        Save scope
      </Button>
    </div>
  );
}
