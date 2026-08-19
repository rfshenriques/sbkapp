import { MIN_BETTABLE_ODDS, type Market, type Selection } from '@sportsbook/shared';
import { BoostIcon } from '../../components/ui/BoostIcon';
import { LockIcon } from '../../components/ui/LockIcon';
import { track } from '../../lib/analytics';
import { formatMoney } from '../../lib/currency';
import { useDisplayNames } from '../display-names/useDisplayNames';
import { useBetSlipStore } from './betSlipStore';
import { sortMatchResultSelections } from './sortMatchResultSelections';
import { useMarketSuspensions } from './useMarketSuspensions';
import { useOddsFlash } from './useOddsFlash';

interface MarketSelectionsProps {
  matchId: string;
  matchLabel: string;
  /** Raw feed competition name, e.g. "EPL" - checked against competition-level suspensions, which lock every selection here regardless of any market/selection-level suspension. */
  competition: string;
  market: Market;
  /**
   * When set (both required together), a match-result market's Home/Away
   * buttons show the actual team name in place of the generic "Home"/"Away"
   * wording - 1 is always the home team, 2 is always the away team, so the
   * team name identifies the pick more usefully than the generic label
   * does. Draw's own button gets the same small-caption treatment for
   * visual consistency across the row, still reading "Draw". Omitted (or a
   * non-match-result market, or a market this component's own home/away
   * detection doesn't recognize) falls back to the plain generic label,
   * unchanged - see captionFor.
   */
  homeTeamLabel?: string;
  awayTeamLabel?: string;
}

interface SelectionButtonProps {
  selection: Selection;
  label: string;
  /** The small team-name/"Draw" caption shown in the label's place - see MarketSelectionsProps.homeTeamLabel. Undefined uses the plain `label` instead, unstyled as a caption. */
  caption?: string;
  isSelected: boolean;
  isSuspended: boolean;
  onSelect: () => void;
}

/**
 * Home/Away -> the real team name, Draw -> "Draw" - only when both team
 * labels are supplied by the caller (see MarketSelectionsProps) and this
 * selection is actually part of a recognizable match-result shape (reuses
 * the same Home/Away detection as sortMatchResultSelections, rather than
 * checking market.id, since that's the one thing every caller already
 * agrees on for "is this the 1X2 market").
 */
function captionFor(
  selectionName: string,
  drawLabel: string,
  homeTeamLabel?: string,
  awayTeamLabel?: string,
): string | undefined {
  if (!homeTeamLabel || !awayTeamLabel) return undefined;
  const lower = selectionName.toLowerCase();
  if (lower === 'home') return homeTeamLabel;
  if (lower === 'away') return awayTeamLabel;
  if (lower === 'draw') return drawLabel;
  return undefined;
}

function SelectionButton({ selection, label, caption, isSelected, isSuspended, onSelect }: SelectionButtonProps) {
  const flash = useOddsFlash(selection.odds);
  // originalOdds is only ever set by the backend when a boost actually changed the price (see BoostService.applyBoosts).
  const isBoosted = selection.originalOdds !== undefined;

  return (
    <button
      type="button"
      disabled={isSuspended}
      aria-label={
        isSuspended
          ? `${caption ?? label} suspended`
          : isBoosted
            ? `${caption ?? label} boosted to ${selection.odds.toFixed(2)}, was ${selection.originalOdds!.toFixed(2)}${
                selection.maxStakeCents !== undefined
                  ? `, max stake ${formatMoney(selection.maxStakeCents)}`
                  : ''
              }`
            : undefined
      }
      className={`odd-btn${isSelected ? ' selected' : ''}${isSuspended ? ' suspended' : ''}${flash ? ` flash-${flash}` : ''}`}
      onClick={(event) => {
        // MatchCard's whole card is clickable and navigates to the match -
        // stop this from also triggering that when picking an odd.
        event.stopPropagation();
        onSelect();
      }}
    >
      {isBoosted && !isSuspended && (
        // Corner badge, not a centered label pill - centered over the whole
        // button read as floating/detached from the price, and overlapped
        // the label text above it on narrow cards. A small icon-only badge
        // in the corner (same spot the boosted-odds reference mockup used)
        // stays out of the way of both the label and the price it marks.
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-highlight text-black"
        >
          <BoostIcon className="h-2.5 w-2.5" />
        </span>
      )}
      <span className={caption ? 'odd-team-label' : 'odd-label'}>{caption ?? label}</span>
      {isSuspended ? (
        <LockIcon className="h-4 w-4" aria-hidden="true" />
      ) : (
        // Boosted selections show only the new price, same single-line
        // shape as every other odds button, not a struck-through previous
        // price stacked above it - that stacked treatment is what the
        // dedicated boosted-odds block (BoostedOddsRow, the Boosts page and
        // match-detail page's Boosts section) still uses; here it's one
        // price among three/several in a regular market row, and reads
        // better staying visually consistent with its neighbors. The
        // highlight color is what still marks it as boosted, matching the
        // corner badge's own highlight-colored fill.
        <span className={`odd-value${isBoosted ? ' text-highlight' : ''}`}>{selection.odds.toFixed(2)}</span>
      )}
    </button>
  );
}

export function MarketSelections({
  matchId,
  matchLabel,
  competition,
  market,
  homeTeamLabel,
  awayTeamLabel,
}: MarketSelectionsProps) {
  const toggleSelection = useBetSlipStore((state) => state.toggleSelection);
  const selectedSelectionId = useBetSlipStore(
    (state) =>
      state.selections.find(
        (selection) => selection.matchId === matchId && selection.marketId === market.id,
      )?.selectionId,
  );
  const displayName = useDisplayNames();
  const { isSuspended, isCompetitionSuspended } = useMarketSuspensions();

  const orderedSelections = sortMatchResultSelections(market.selections);
  const competitionSuspended = isCompetitionSuspended(competition);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${orderedSelections.length}, minmax(0, 1fr))` }}
    >
      {orderedSelections.map((selection) => {
        const selectionLabel = displayName('SELECTION', selection.name);
        const caption = captionFor(
          selection.name,
          displayName('SELECTION', 'Draw'),
          homeTeamLabel,
          awayTeamLabel,
        );
        return (
          <SelectionButton
            key={selection.id}
            selection={selection}
            label={selectionLabel}
            caption={caption}
            isSelected={selectedSelectionId === selection.id}
            isSuspended={
              competitionSuspended ||
              isSuspended(matchId, market.id, selection.id) ||
              selection.odds < MIN_BETTABLE_ODDS
            }
            onSelect={() => {
              track('CLICK', {
                metadata: {
                  target: 'odds_selection',
                  matchId,
                  marketId: market.id,
                  selectionId: selection.id,
                  wasSelected: selectedSelectionId === selection.id,
                },
              });
              toggleSelection({
                matchId,
                marketId: market.id,
                selectionId: selection.id,
                matchLabel,
                marketName: displayName('MARKET', market.name),
                selectionName: selectionLabel,
                odds: selection.odds,
                originalOdds: selection.originalOdds,
                maxStakeCents: selection.maxStakeCents ?? market.maxStakeCents,
                marketSinglesOnly: market.singlesOnly,
              });
            }}
          />
        );
      })}
    </div>
  );
}
