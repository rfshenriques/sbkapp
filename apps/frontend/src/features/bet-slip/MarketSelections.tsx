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
  /**
   * 'grid' (default): the original three-boxes-in-a-row look (.odd-btn) -
   * used everywhere except the Polymarket-inspired match card. 'row':
   * each selection is a full-width row, home/away tinted with that team's
   * own color (see homeColorHex/awayColorHex) - matches the outcome-row
   * card style. Only meaningfully different for a recognizable
   * home/draw/away market; a market layout='row' can't caption (see
   * captionFor) still renders as plain rows, just without the color tint.
   */
  layout?: 'grid' | 'row';
  /** layout='row' only - the actual team colors (see useTeamColors), used to tint the home/away rows and their price pills. Omitted (or the market isn't a recognizable match-result) falls back to an untinted row, same as Draw's. */
  homeColorHex?: string;
  awayColorHex?: string;
  /** layout='row' only - shows the live score inline next to each team's name instead of nothing, when the match is live and scores have loaded. */
  homeScore?: number | string;
  awayScore?: number | string;
}

interface SelectionButtonProps {
  selection: Selection;
  label: string;
  /** The small team-name/"Draw" caption shown in the label's place - see MarketSelectionsProps.homeTeamLabel. Undefined uses the plain `label` instead, unstyled as a caption. */
  caption?: string;
  isSelected: boolean;
  isSuspended: boolean;
  onSelect: () => void;
  layout?: 'grid' | 'row';
  /** layout='row' only - see MarketSelectionsProps.homeColorHex/awayColorHex; undefined for Draw or an unrecognized selection. */
  colorHex?: string;
  /** layout='row' only - see MarketSelectionsProps.homeScore/awayScore. */
  score?: number | string;
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

function SelectionButton({
  selection,
  label,
  caption,
  isSelected,
  isSuspended,
  onSelect,
  layout = 'grid',
  colorHex,
  score,
}: SelectionButtonProps) {
  const flash = useOddsFlash(selection.odds);
  // originalOdds is only ever set by the backend when a boost actually changed the price (see BoostService.applyBoosts).
  const isBoosted = selection.originalOdds !== undefined;
  const ariaLabel = isSuspended
    ? `${caption ?? label} suspended`
    : isBoosted
      ? `${caption ?? label} boosted to ${selection.odds.toFixed(2)}, was ${selection.originalOdds!.toFixed(2)}${
          selection.maxStakeCents !== undefined ? `, max stake ${formatMoney(selection.maxStakeCents)}` : ''
        }`
      : undefined;

  if (layout === 'row') {
    // color-mix, not a hardcoded rgba - tints from whatever this selection's
    // actual team color is (see MarketSelectionsProps.homeColorHex/
    // awayColorHex), same source TeamBadge/TeamColorAccent already use.
    // Draw (colorHex undefined) falls back to the same neutral surface-2
    // pill every other untinted price in the app already uses. Selected
    // (like boosted) skips this inline style entirely - .oc-row.selected's
    // CSS gradient needs to win over the team tint, and an inline style
    // here would otherwise always beat it.
    const pillStyle =
      colorHex && !isSelected
        ? {
            backgroundColor: `color-mix(in srgb, ${colorHex} 20%, transparent)`,
            color: `color-mix(in srgb, ${colorHex} 65%, white)`,
          }
        : undefined;

    return (
      <button
        type="button"
        disabled={isSuspended}
        aria-label={ariaLabel}
        className={`oc-row${isSelected ? ' selected' : ''}${isSuspended ? ' suspended' : ''}${flash ? ` flash-${flash}` : ''}`}
        onClick={(event) => {
          // This row sits inside MatchCard's own navigational <Link> (see
          // there) - stopPropagation alone only stops the click from
          // reaching that Link's own onClick, which is also the only place
          // that calls preventDefault() on the click. Skip that handler and
          // nothing ever cancels the anchor's native "follow this href"
          // default action, so the click both toggles the selection AND
          // navigates. preventDefault() here closes that gap directly.
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {colorHex && (
            <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: colorHex }} />
          )}
          <span className={`min-w-0 truncate text-[13px] font-semibold${colorHex ? '' : ' pl-[11px]'}`}>
            {caption ?? label}
          </span>
          {score !== undefined && <span className="font-display shrink-0 text-[13px] tabular-nums">{score}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {isBoosted && !isSuspended && (
            <BoostIcon className="h-3.5 w-3.5 text-highlight" aria-hidden="true" />
          )}
          {isSuspended ? (
            <LockIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <span
              className={`oc-pill${isBoosted ? ' text-highlight' : ''}`}
              style={isBoosted ? undefined : pillStyle}
            >
              {selection.odds.toFixed(2)}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isSuspended}
      aria-label={ariaLabel}
      className={`odd-btn${isSelected ? ' selected' : ''}${isSuspended ? ' suspended' : ''}${flash ? ` flash-${flash}` : ''}`}
      onClick={(event) => {
        // MatchCard's whole card is clickable and navigates to the match -
        // stop this from also triggering that when picking an odd. Also
        // preventDefault - harmless here, but the same button component is
        // reused (layout='row') inside a navigational Link elsewhere (see
        // that branch's own comment), so this stays consistent between the
        // two rather than only one of them being safe against that.
        event.preventDefault();
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

/** layout='row' only - the color to tint this selection's row/pill with, or undefined for Draw/unrecognized. */
function colorHexFor(
  selectionName: string,
  homeColorHex?: string,
  awayColorHex?: string,
): string | undefined {
  const lower = selectionName.toLowerCase();
  if (lower === 'home') return homeColorHex;
  if (lower === 'away') return awayColorHex;
  return undefined;
}

/** layout='row' only - the live score to show inline next to this selection's team name, or undefined for Draw/unrecognized. */
function scoreFor(
  selectionName: string,
  homeScore?: number | string,
  awayScore?: number | string,
): number | string | undefined {
  const lower = selectionName.toLowerCase();
  if (lower === 'home') return homeScore;
  if (lower === 'away') return awayScore;
  return undefined;
}

export function MarketSelections({
  matchId,
  matchLabel,
  competition,
  market,
  homeTeamLabel,
  awayTeamLabel,
  layout = 'grid',
  homeColorHex,
  awayColorHex,
  homeScore,
  awayScore,
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
      className={layout === 'row' ? 'flex flex-col gap-2' : 'grid gap-2'}
      style={layout === 'row' ? undefined : { gridTemplateColumns: `repeat(${orderedSelections.length}, minmax(0, 1fr))` }}
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
            layout={layout}
            colorHex={colorHexFor(selection.name, homeColorHex, awayColorHex)}
            score={scoreFor(selection.name, homeScore, awayScore)}
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
