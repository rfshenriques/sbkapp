import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { useBrandStore } from '../features/brand/brandStore';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const brandId = useBrandStore((state) => state.brandId);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ email, username, phone, password });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close registration"
        className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80 backdrop-blur-sm"
        onClick={() => navigate('/')}
      />
      <div className="sheet-slide-up relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="brand-flag" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <h1 className="font-display text-xl">Create your account</h1>
          </div>
          <button
            type="button"
            aria-label="Close registration"
            className="text-text-muted hover:text-text-primary"
            onClick={() => navigate('/')}
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="username" className="block text-sm text-text-secondary">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm text-text-secondary">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+15551234567"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoComplete="tel"
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !brandId}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating account…' : !brandId ? 'Loading…' : 'Register'}
          </button>
        </form>
        <p className="mt-3 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="text-highlight hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
