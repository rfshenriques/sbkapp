import { IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { AudienceMode, BetAndGetBetType, BetAndGetRewardType, BetAndGetTiming, BetAndGetTrigger } from '@prisma/client';

const REWARD_TYPES: BetAndGetRewardType[] = ['FIXED', 'PERCENTAGE'];
const TRIGGERS: BetAndGetTrigger[] = ['PLACEMENT', 'SETTLEMENT'];
const BET_TYPES: BetAndGetBetType[] = ['SINGLES_ONLY', 'ACCUMULATOR_ONLY', 'EITHER'];
const BETTING_TIMINGS: BetAndGetTiming[] = ['PREMATCH_ONLY', 'INPLAY_ONLY', 'EITHER'];
const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

export class CreateBetAndGetCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(REWARD_TYPES)
  rewardType?: BetAndGetRewardType;

  /** Required when rewardType is FIXED - checked in the service, not here, since it depends on another field. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardAmountCents?: number;

  /** Required when rewardType is PERCENTAGE (e.g. 10 = 10% of the qualifying bet's stake). */
  @IsOptional()
  @IsPositive()
  rewardPercent?: number;

  /** Required when rewardType is PERCENTAGE. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardCapCents?: number;

  /** Optional scheduling window - both independently optional, see BetAndGetCampaign.startAt/endAt. */
  @IsOptional()
  @IsISO8601()
  startAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @IsOptional()
  @IsIn(TRIGGERS)
  trigger?: BetAndGetTrigger;

  /** Only meaningful when trigger is SETTLEMENT - at least one should be true or the campaign never grants anything. */
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
  minCombinedOdds?: number | null;

  @IsOptional()
  @IsIn(BET_TYPES)
  betType?: BetAndGetBetType;

  @IsOptional()
  @IsInt()
  @Min(2)
  minSelections?: number | null;

  @IsOptional()
  @IsIn(BETTING_TIMINGS)
  bettingTiming?: BetAndGetTiming;

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
