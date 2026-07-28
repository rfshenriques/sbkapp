import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { GridIcon } from '../components/ui/NavIcons';
import { useDisplayNames } from '../features/display-names/useDisplayNames';
import { GroupedMatchList } from '../features/odds-board/GroupedMatchList';
import { MatchListSkeleton } from '../features/odds-board/MatchListSkeleton';
import { useMatches } from '../features/odds-board/useMatches';
import { groupMatchesBySportAndCompetition } from '../lib/groupMatchesBySportAndCompetition';

function parseCsvParam(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(value.split(',').filter((entry) => entry.length > 0));
}

/**
 * Matches from whichever sports and/or competitions the player picked via
 * the sidebar's "Select multiple" mode - a selected sport pulls in every
 * one of its competitions, a selected competition pulls in just itself, and
 * a competition already covered by a selected sport isn't listed twice
 * (the grouping below naturally collapses that, since a match only ever
 * belongs to one sport+competition pair).
 */
export default function BrowsePage() {
  const [searchParams] = useSearchParams();
  const { data: matches, isPending, isError } = useMatches();
  const displayName = useDisplayNames();

  const selectedSports = useMemo(() => parseCsvParam(searchParams.get('sports')), [searchParams]);
  const selectedCompetitions = useMemo(
    () => parseCsvParam(searchParams.get('competitions')),
    [searchParams],
  );

  const filteredMatches = useMemo(
    () =>
      (matches ?? []).filter(
        (match) => selectedSports.has(match.sport) || selectedCompetitions.has(match.competition),
      ),
    [matches, selectedSports, selectedCompetitions],
  );
  const groups = useMemo(() => groupMatchesBySportAndCompetition(filteredMatches), [filteredMatches]);

  const selectionLabel = [
    ...[...selectedSports].map((sport) => displayName('SPORT', sport)),
    ...[...selectedCompetitions].map((competition) => displayName('COMPETITION', competition)),
  ].join(', ');

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BackButton className="-ml-1.5" />
        <GridIcon width={20} height={20} />
        <h1 className="font-display text-lg">Browse matches</h1>
      </div>

      {selectionLabel && <p className="mb-4 text-sm text-text-secondary">{selectionLabel}</p>}

      {isPending && <MatchListSkeleton />}
      {isError && <Card className="text-danger">Failed to load matches.</Card>}
      {groups.length === 0 && !isPending && !isError && (
        <Card className="text-text-secondary">No matches available for this selection right now.</Card>
      )}

      <GroupedMatchList groups={groups} />
    </div>
  );
}
