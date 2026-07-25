import { IsOptional, IsString } from 'class-validator';

/** Every field optional - staff sends only what's changing, unlike add() which requires a file. Send `betAndGetCampaignId: null` to unlink the card from any campaign. */
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
}
