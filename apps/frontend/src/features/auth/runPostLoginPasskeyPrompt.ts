import * as backendApi from '../../lib/backendApi';
import { isBiometricLoginAvailable } from '../../lib/webauthn';
import { usePasskeyEnrollmentModalStore } from './passkeyEnrollmentModalStore';

/**
 * Shown after a password login/register (not a biometric one - they
 * already have a passkey) - best-effort, silent on any failure, since a
 * broken enrollment check must never block or interrupt the auth flow
 * that triggered it.
 */
export function runPostLoginPasskeyPrompt(): void {
  void (async () => {
    try {
      if (!(await isBiometricLoginAvailable())) return;
      const credentials = await backendApi.listWebAuthnCredentials();
      if (credentials.length === 0) {
        usePasskeyEnrollmentModalStore.getState().open();
      }
    } catch {
      // Best-effort - no prompt is a fine outcome, a broken auth flow is not.
    }
  })();
}
