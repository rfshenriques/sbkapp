import { useState, type FormEvent } from 'react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useAuth } from '../features/auth/useAuth';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { runPostLoginDepositCheck } from '../features/deposit-campaigns/runPostLoginDepositCheck';
import { runPostLoginPasskeyPrompt } from '../features/auth/runPostLoginPasskeyPrompt';

const LOGIN_FORM_ID = 'login-form';

export default function LoginPage() {
  const { login } = useAuth();
  const close = useAuthModalStore((state) => state.close);
  const open = useAuthModalStore((state) => state.open);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password);
      close();
      runPostLoginDepositCheck();
      runPostLoginPasskeyPrompt();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet
      title="Log in"
      icon={
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      }
      onClose={close}
      closeLabel="Close login"
      footer={
        <>
          <button
            type="submit"
            form={LOGIN_FORM_ID}
            disabled={isSubmitting}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
          <p className="mt-3 text-center text-sm text-text-secondary">
            No account?{' '}
            <button
              type="button"
              onClick={() => open('register')}
              className="text-highlight hover:underline"
            >
              Register
            </button>
          </p>
        </>
      }
    >
      <form id={LOGIN_FORM_ID} onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="identifier" className="block text-sm text-text-secondary">
            Email or username
          </label>
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-text-secondary">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </BottomSheet>
  );
}
