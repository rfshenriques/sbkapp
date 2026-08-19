import { IsOptional, IsString, Matches } from 'class-validator';

/** Every field optional - staff sends only what's changing, unlike add() which requires a file. Send e.g. `betAndGetCampaignId: null` to unlink the card from that campaign. */
export class UpdatePromoCardDto {
  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  ctaLabel?: string | null;

  /** A single leading slash, never "//" (a protocol-relative URL browsers treat as external) - same-origin internal path only. */
  @IsOptional()
  @Matches(/^\/(?!\/).*$/, { message: 'linkUrl must be an internal path starting with a single "/"' })
  linkUrl?: string | null;

  @IsOptional()
  @IsString()
  betAndGetCampaignId?: string | null;

  @IsOptional()
  @IsString()
  depositCampaignId?: string | null;

  @IsOptional()
  @IsString()
  registerCampaignId?: string | null;

  @IsOptional()
  @IsString()
  leaderboardCampaignId?: string | null;
}
