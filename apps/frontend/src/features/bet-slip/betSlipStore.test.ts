import { beforeEach, describe, expect, it } from 'vitest';
import { useBetSlipStore } from './betSlipStore';

const homeSelection = {
  matchId: 'match-1',
  marketId: 'match-result',
  selectionId: 'home',
  matchLabel: 'Arsenal vs Chelsea',
  marketName: 'Match Result',
  selectionName: 'Home',
  odds: 2.1,
};

const awaySelection = {
  ...homeSelection,
  selectionId: 'away',
  selectionName: 'Away',
  odds: 3.2,
};

const otherMatchSelection = {
  matchId: 'match-2',
  marketId: 'match-result',
  selectionId: 'home',
  matchLabel: 'Liverpool vs Manchester City',
  marketName: 'Match Result',
  selectionName: 'Home',
  odds: 2.6,
};

beforeEach(() => {
  useBetSlipStore.setState({ selections: [] });
});

describe('useBetSlipStore', () => {
  it('starts empty', () => {
    expect(useBetSlipStore.getState().selections).toEqual([]);
  });

  it('adds a selection', () => {
    useBetSlipStore.getState().addSelection(homeSelection);

    expect(useBetSlipStore.getState().selections).toEqual([homeSelection]);
  });

  it('replaces the existing pick in the same market when a different selection is added', () => {
    useBetSlipStore.getState().addSelection(homeSelection);
    useBetSlipStore.getState().addSelection(awaySelection);

    expect(useBetSlipStore.getState().selections).toEqual([awaySelection]);
  });

  it('keeps selections from different matches independent', () => {
    useBetSlipStore.getState().addSelection(homeSelection);
    useBetSlipStore.getState().addSelection(otherMatchSelection);

    expect(useBetSlipStore.getState().selections).toEqual([homeSelection, otherMatchSelection]);
  });

  it('toggling the same selection twice removes it', () => {
    useBetSlipStore.getState().toggleSelection(homeSelection);
    useBetSlipStore.getState().toggleSelection(homeSelection);

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });

  it('toggling a different selection in the same market replaces the pick', () => {
    useBetSlipStore.getState().toggleSelection(homeSelection);
    useBetSlipStore.getState().toggleSelection(awaySelection);

    expect(useBetSlipStore.getState().selections).toEqual([awaySelection]);
  });

  it('removes a selection by match and market id', () => {
    useBetSlipStore.getState().addSelection(homeSelection);
    useBetSlipStore.getState().removeSelection(homeSelection.matchId, homeSelection.marketId);

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });

  it('clears all selections', () => {
    useBetSlipStore.getState().addSelection(homeSelection);
    useBetSlipStore.getState().addSelection(otherMatchSelection);
    useBetSlipStore.getState().clear();

    expect(useBetSlipStore.getState().selections).toEqual([]);
  });
});
