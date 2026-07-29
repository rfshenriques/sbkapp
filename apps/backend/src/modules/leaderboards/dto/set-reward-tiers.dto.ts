import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class LeaderboardRewardTierEntryDto {
  @IsInt()
  @Min(1)
  rankFrom!: number;

  @IsInt()
  @Min(1)
  rankTo!: number;

  @IsInt()
  @Min(1)
  rewardAmountCents!: number;
}

/** Always the full replacement set - see LeaderboardCampaignService.setRewardTiers. */
export class SetLeaderboardRewardTiersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaderboardRewardTierEntryDto)
  tiers!: LeaderboardRewardTierEntryDto[];
}
