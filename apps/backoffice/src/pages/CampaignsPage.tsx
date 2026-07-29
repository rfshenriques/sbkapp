import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { BetAndGetCampaignsTab } from '../features/campaigns/BetAndGetCampaignsTab';
import { DepositCampaignsTab } from '../features/campaigns/DepositCampaignsTab';
import { LeaderboardCampaignsTab } from '../features/campaigns/LeaderboardCampaignsTab';
import { RegisterCampaignsTab } from '../features/campaigns/RegisterCampaignsTab';

type CampaignType = 'bet-and-get' | 'deposit' | 'register' | 'leaderboard';

const TABS: { type: CampaignType; label: string }[] = [
  { type: 'bet-and-get', label: 'Bet & Get' },
  { type: 'deposit', label: 'Deposit' },
  { type: 'register', label: 'Register' },
  { type: 'leaderboard', label: 'Leaderboard' },
];

function isCampaignType(value: string | null): value is CampaignType {
  return value === 'bet-and-get' || value === 'deposit' || value === 'register' || value === 'leaderboard';
}

/** One page for all 4 campaign types - a type picker (persisted in the `?type=` search param, so a direct link lands on the right tab) drives which type's list + creation form renders. Replaces the previously separate Bet & Get / Deposit pages. */
export default function CampaignsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const activeType: CampaignType = isCampaignType(rawType) ? rawType : 'bet-and-get';

  function selectType(type: CampaignType) {
    setSearchParams(type === 'bet-and-get' ? {} : { type });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Player-facing reward campaigns - pick a type below to manage its own list and create new ones.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3" role="tablist" aria-label="Campaign type">
        {TABS.map((tab) => (
          <Button
            key={tab.type}
            variant={activeType === tab.type ? 'primary' : 'secondary'}
            role="tab"
            aria-selected={activeType === tab.type}
            aria-pressed={activeType === tab.type}
            onClick={() => selectType(tab.type)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        {activeType === 'bet-and-get' && <BetAndGetCampaignsTab />}
        {activeType === 'deposit' && <DepositCampaignsTab />}
        {activeType === 'register' && <RegisterCampaignsTab />}
        {activeType === 'leaderboard' && <LeaderboardCampaignsTab />}
      </div>
    </div>
  );
}
