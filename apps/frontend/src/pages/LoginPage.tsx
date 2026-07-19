import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { useAuth } from '../features/auth/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close login"
        className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80 backdrop-blur-sm"
        onClick={() => navigate('/')}
      />
      <div className="relative w-full max-w-sm">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="brand-flag" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </span>
              <h1 className="font-display text-xl">Log in</h1>
            </div>
            <button
              type="button"
              aria-label="Close login"
              className="text-text-muted hover:text-text-primary"
              onClick={() => navigate('/')}
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="identifier" className="block text-sm text-text-secondary">
                Email or username
              </label>
              <input
                id="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </Card>
        <p className="mt-3 text-center text-sm text-text-secondary">
          No account?{' '}
          <Link to="/register" className="text-highlight hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
