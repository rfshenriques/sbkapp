import { BottomSheet } from '../../components/ui/BottomSheet';
import { useDepositModalStore } from '../deposit/depositModalStore';
import { useInsufficientFundsModalStore } from './insufficientFundsModalStore';

/** Shown when placing a cash bet fails because the stake exceeds the player's cash balance - see BetSlipPanel's placement error handling. */
export function InsufficientFundsModal() {
  const isOpen = useInsufficientFundsModalStore((state) => state.isOpen);
  const close = useInsufficientFundsModalStore((state) => state.close);
  const openDepositModal = useDepositModalStore((state) => state.open);

  if (!isOpen) {
    return null;
  }

  return (
    <BottomSheet
      title="Insufficient funds"
      onClose={close}
      closeLabel="Close"
      footer={
        <>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => {
              close();
              openDepositModal();
            }}
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full text-center text-sm text-text-secondary hover:underline"
          >
            Cancel
          </button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">
        Your cash balance doesn't cover this stake. Add funds to your account to place this bet.
      </p>
    </BottomSheet>
  );
}
