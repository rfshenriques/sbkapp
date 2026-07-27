import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { BetSelectionDto } from './place-bet.dto';

export class PreviewCampaignDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BetSelectionDto)
  selections!: BetSelectionDto[];

  /** Stake in cents - campaign conditions can require a minimum stake (see betQualifiesForCampaign). */
  @IsInt()
  @Min(1)
  stakeCents!: number;

  /** Mirrors PlaceBetDto.insuranceOptIn - an insured bet never links to a campaign (see PamService.placeBet), so the preview must agree. */
  @IsOptional()
  @IsBoolean()
  insuranceOptIn?: boolean;
}
