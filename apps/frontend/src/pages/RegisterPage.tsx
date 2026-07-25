import { useState, type FormEvent } from 'react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { BrandPromoImage } from '../components/ui/BrandPromoImage';
import { useAuth } from '../features/auth/useAuth';
import { useAuthModalStore } from '../features/auth/authModalStore';
import { runPostLoginPasskeyPrompt } from '../features/auth/runPostLoginPasskeyPrompt';
import { useBrandStore } from '../features/brand/brandStore';

const REGISTER_FORM_ID = 'register-form';

/** Shown until the brand uploads a real REGISTER_DESKTOP/REGISTER_MOBILE image in the backoffice's CMS images page - same mocked copy the homepage's promo card falls back to. */
function RegisterPromoFallback({ size }: { size: 'mobile' | 'desktop' }) {
  return (
    <div
      className="flex h-full flex-col justify-end p-4 text-white sm:justify-center sm:p-6"
      style={{
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--color-highlight) 80%, black) 0%, color-mix(in srgb, var(--color-highlight) 25%, black) 55%, #0a0a10 100%)',
      }}
    >
      <span className="mb-1 inline-flex w-fit items-center gap-2 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
        Welcome Bonus
      </span>
      <p className={`font-display leading-tight ${size === 'mobile' ? 'text-lg' : 'text-2xl'}`}>
        Get up to €50 in bonus bets
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const close = useAuthModalStore((state) => state.close);
  const open = useAuthModalStore((state) => state.open);
  const brandId = useBrandStore((state) => state.brandId);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Captured once, on this page's first mount rather than at submit, so it
  // reflects how the player actually arrived here even if they browse
  // around a while before submitting the form.
  const [attribution] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      referrerUrl: document.referrer || undefined,
      utmSource: params.get('utm_source') ?? undefined,
      utmMedium: params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
    };
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ email, username, phone, password, ...attribution });
      close();
      runPostLoginPasskeyPrompt();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet
      title="Create your account"
      icon={
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      }
      onClose={close}
      closeLabel="Close registration"
      desktopSize="wide"
      bodyClassName="flex min-h-0 flex-1 flex-col sm:flex-row"
      footer={
        <>
          <button
            type="submit"
            form={REGISTER_FORM_ID}
            disabled={isSubmitting || !brandId}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating account…' : !brandId ? 'Loading…' : 'Register'}
          </button>
          <p className="mt-3 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => open('login')}
              className="text-highlight hover:underline"
            >
              Log in
            </button>
          </p>
        </>
      }
    >
      {/* Promo panel - a short full-width strip above the form on mobile,
          a full-height column to the left of it on desktop (see
          desktopSize="wide" above, which gives this the room to sit beside
          the form instead of stacking). Two separate CMS image slots (not
          one image reused) since the desktop panel is a tall portrait and
          the mobile strip is a short wide banner - a single image cropped
          to fit both would compromise one or the other. */}
      <div className="relative h-28 shrink-0 overflow-hidden sm:h-auto sm:w-2/5">
        <div className="h-full sm:hidden">
          <BrandPromoImage
            brandId={brandId}
            slot="REGISTER_MOBILE"
            className="h-full w-full object-cover"
            fallback={<RegisterPromoFallback size="mobile" />}
          />
        </div>
        <div className="hidden h-full sm:block">
          <BrandPromoImage
            brandId={brandId}
            slot="REGISTER_DESKTOP"
            className="h-full w-full object-cover"
            fallback={<RegisterPromoFallback size="desktop" />}
          />
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <form id={REGISTER_FORM_ID} onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
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
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
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
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
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
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </div>
    </BottomSheet>
  );
}
