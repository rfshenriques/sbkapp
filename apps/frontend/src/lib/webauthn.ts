import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useAuthStore } from '../features/auth/authStore';
import { runPostLoginDepositCheck } from '../features/deposit-campaigns/runPostLoginDepositCheck';
import * as backendApi from './backendApi';

/** Whether this device can plausibly do a biometric (Face ID/Touch ID/Windows Hello) login at all - checked before ever prompting, not just left to fail silently. */
export async function isBiometricLoginAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) {
    return false;
  }
  return platformAuthenticatorIsAvailable();
}

/**
 * Attempts a discoverable-credential ("usernameless") passkey login.
 * Resolves to true only on a fully verified login (auth state is already
 * set by the time this returns). Any failure - no platform authenticator,
 * no matching passkey, the player cancels the OS prompt, a network error -
 * resolves to false rather than throwing, since the only caller-visible
 * fallback is "show the password login form instead."
 */
export async function attemptBiometricLogin(): Promise<boolean> {
  try {
    if (!(await isBiometricLoginAvailable())) {
      return false;
    }
    const optionsJSON = await backendApi.getWebAuthnLoginOptions();
    const assertion = await startAuthentication({ optionsJSON });
    const { accessToken } = await backendApi.verifyWebAuthnLogin(assertion);
    useAuthStore.getState().setAuth(accessToken);
    runPostLoginDepositCheck();
    return true;
  } catch {
    return false;
  }
}

/** Registers a new passkey for the already-authenticated player - the enrollment prompt after login/register. */
export async function registerPasskey(nickname?: string): Promise<void> {
  const optionsJSON = await backendApi.getWebAuthnRegistrationOptions();
  const attestation = await startRegistration({ optionsJSON });
  await backendApi.verifyWebAuthnRegistration(attestation, nickname);
}
