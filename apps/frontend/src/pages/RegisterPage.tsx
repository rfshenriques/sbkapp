import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../features/auth/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
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
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <Card className="mt-4">
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
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating account…' : 'Register'}
          </Button>
        </form>
      </Card>
      <p className="mt-3 text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="text-text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
