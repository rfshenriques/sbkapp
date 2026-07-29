import { IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { AudienceMode, BetAndGetBetType, BetAndGetRewardType, BetAndGetTiming, BetAndGetTrigger } from '@prisma/client';

const REWARD_TYPES: BetAndGetRewardType[] = ['FIXED', 'PERCENTAGE'];
const TRIGGERS: BetAndGetTrigger[] = ['PLACEMENT', 'SETTLEMENT'];
const BET_TYPES: BetAndGetBetType[] = ['SINGLES_ONLY', 'ACCUMULATOR_ONLY', 'EITHER'];
const BETTING_TIMINGS: BetAndGetTiming[] = ['PREMATCH_ONLY', 'INPLAY_ONLY', 'EITHER'];
const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

/** Every field optional (PATCH semantics), unlike create() where name is required. */
export class UpdateBetAndGetCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(REWARD_TYPES)
  rewardType?: BetAndGetRewardType;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardAmountCents?: number;

  @IsOptional()
  @IsPositive()
  rewardPercent?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardCapCents?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsISO8601()
  startAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @IsOptional()
  @IsIn(TRIGGERS)
  trigger?: BetAndGetTrigger;

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
