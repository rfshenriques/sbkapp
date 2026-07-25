import { IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { AudienceMode, BetAndGetBetType, BetAndGetTrigger, DepositRewardType } from '@prisma/client';

const REWARD_TYPES: DepositRewardType[] = ['FIXED', 'PERCENTAGE'];
const TRIGGERS: BetAndGetTrigger[] = ['PLACEMENT', 'SETTLEMENT'];
const BET_TYPES: BetAndGetBetType[] = ['SINGLES_ONLY', 'ACCUMULATOR_ONLY', 'EITHER'];
const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

export class CreateDepositCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @IsPositive()
  minDepositAmountCents!: number;

  @IsIn(REWARD_TYPES)
  rewardType!: DepositRewardType;

  /** Optional scheduling window - both independently optional, see DepositCampaign.startAt/endAt. */
  @IsOptional()
  @IsISO8601()
  startAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  /** Required when rewardType is FIXED - checked in the service, not here, since it depends on another field. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  fixedRewardAmountCents?: number;

  /** Required when rewardType is PERCENTAGE. */
  @IsOptional()
  @IsPositive()
  rewardPercent?: number;

  /** Required when rewardType is PERCENTAGE. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardCapCents?: number;

  @IsOptional()
  @IsBoolean()
  requiresBet?: boolean;

  @IsOptional()
  @IsIn(TRIGGERS)
  trigger?: BetAndGetTrigger;

  /** Only meaningful when requiresBet and trigger are SETTLEMENT - at least one should be true or the campaign never grants anything. */
  @IsOptional()
  @IsBoolean()
  triggerOnWon?: boolean;

  @IsOptional()
  @IsBoolean()
  triggerOnLost?: boolean;

  @IsOptional()
  @IsBoolean()
  triggerOnVoid?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minStakeCents?: number | null;

  @IsOptional()
  minOddsPerLeg?: number | null;

  @IsOptional()
  @IsIn(BET_TYPES)
  betType?: BetAndGetBetType;

  @IsOptional()
  @IsInt()
  @Min(2)
  minSelections?: number | null;

  @IsOptional()
  @IsBoolean()
  allowMultipleRedemptions?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptionsPerPlayer?: number | null;

  @IsOptional()
  @IsIn(AUDIENCE_MODES)
  audienceMode?: AudienceMode;

  /** Required and used only when audienceMode is SEGMENTS - the full replacement set of segment ids. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segmentIds?: string[];
}
