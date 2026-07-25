import { IsOptional, IsString } from 'class-validator';

/** Every field optional - staff sends only what's changing, unlike add() which requires a file. Send `betAndGetCampaignId: null` (or `depositCampaignId: null`) to unlink the card from that campaign. */
export class UpdatePromoCardDto {
  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  betAndGetCampaignId?: string | null;

  @IsOptional()
  @IsString()
  depositCampaignId?: string | null;
}
