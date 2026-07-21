import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { getPublicBrand } from '../lib/backendApi';

export default function ResponsibleGamblingPage() {
  const { data: brand } = useQuery({
    queryKey: ['public-brand', typeof window === 'undefined' ? '' : window.location.hostname],
    queryFn: getPublicBrand,
    staleTime: Infinity,
  });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="brand-flag" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <h1 className="font-display text-lg">Responsible Gambling</h1>
      </div>

      <div className="space-y-4">
        <Card className="space-y-2 text-sm text-text-secondary">
          <p>You must be at least 18 years old to register an account and place bets.</p>
          <p>
            Gambling should be an enjoyable form of entertainment, not a way to make money or escape
            problems. Only bet what you can afford to lose, and take regular breaks.
          </p>
          <p>
            If you feel your gambling is becoming a problem, contact your account manager or use your
            account settings to set deposit limits, take a time-out, or self-exclude.
          </p>
        </Card>

        <Card className="text-sm text-text-secondary">
          {brand?.supportHelplineText ? (
            <p>{brand.supportHelplineText}</p>
          ) : (
            <p>Need help? Contact support for guidance on responsible gambling tools.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
