import { BottomSheet } from '../../components/ui/BottomSheet';
import { MyBetsIcon } from '../../components/ui/NavIcons';
import { BetReceipt } from './betCardShared';
import { useBetDetailModalStore } from './betDetailModalStore';
import { useBets } from './useBets';

/**
 * Full-screen "receipt" view for a single bet - opened by tapping a card
 * in BetHistoryList, or reused as step 2 of WinCelebrationModal right
 * after a win. Looks the bet up from useBets()'s cache by id rather than
 * taking it as a prop, so any caller only needs a bet id to open it.
 */
export function BetDetailModal() {
  const betId = useBetDetailModalStore((state) => state.betId);
  const close = useBetDetailModalStore((state) => state.close);
  const { data: bets } = useBets();
  const bet = betId ? bets?.find((candidate) => candidate.id === betId) : undefined;

  if (!betId || !bet) {
    return null;
  }

  return (
    <BottomSheet
      title="Bet details"
      icon={<MyBetsIcon width={20} height={20} />}
      onClose={close}
      closeLabel="Close bet details"
    >
      <BetReceipt bet={bet} />
    </BottomSheet>
  );
}
