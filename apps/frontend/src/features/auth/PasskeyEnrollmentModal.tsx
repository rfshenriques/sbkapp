import { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { registerPasskey } from '../../lib/webauthn';
import { usePasskeyEnrollmentModalStore } from './passkeyEnrollmentModalStore';

/** "Enable Face ID/Touch ID for faster sign-in?" - see runPostLoginPasskeyPrompt.ts for when this opens. */
export function PasskeyEnrollmentModal() {
  const isOpen = usePasskeyEnrollmentModalStore((state) => state.isOpen);
  const close = usePasskeyEnrollmentModalStore((state) => state.close);
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  if (!isOpen) {
    return null;
  }

  function handleClose() {
    close();
    setIsEnabling(false);
    setError(null);
    setSucceeded(false);
  }

  async function handleEnable() {
    setError(null);
    setIsEnabling(true);
    try {
      await registerPasskey();
      setSucceeded(true);
    } catch {
      // The player may have just cancelled the OS prompt - not worth alarming copy.
      setError('Could not set up biometric sign-in on this device.');
    } finally {
      setIsEnabling(false);
    }
  }

  return (
    <BottomSheet
      title="Faster sign-in"
      onClose={handleClose}
      closeLabel="Close"
      footer={
        succeeded ? (
          <button type="button" onClick={handleClose} className="btn-primary w-full">
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleEnable}
              disabled={isEnabling}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEnabling ? 'Setting up…' : 'Enable'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 w-full text-center text-sm text-text-secondary hover:underline"
            >
              Not now
            </button>
          </>
        )
      }
    >
      {succeeded ? (
        <p className="text-sm text-text-primary">
          You're all set - next time, sign in with Face ID, Touch ID, or your device's screen lock.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-secondary">
            Sign in faster next time using Face ID, Touch ID, or your device's screen lock - no password needed.
          </p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </>
      )}
    </BottomSheet>
  );
}
