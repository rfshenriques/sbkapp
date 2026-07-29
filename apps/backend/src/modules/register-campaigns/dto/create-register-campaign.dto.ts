import { IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { AudienceMode, BetAndGetBetType, BetAndGetRewardType, BetAndGetTrigger } from '@prisma/client';

const REWARD_TYPES: BetAndGetRewardType[] = ['FIXED', 'PERCENTAGE'];
const TRIGGERS: BetAndGetTrigger[] = ['PLACEMENT', 'SETTLEMENT'];
const BET_TYPES: BetAndGetBetType[] = ['SINGLES_ONLY', 'ACCUMULATOR_ONLY', 'EITHER'];
const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

export class CreateRegisterCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Optional scheduling window - both independently optional, see RegisterCampaign.startAt/endAt. */
  @IsOptional()
  @IsISO8601()
  startAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @IsOptional()
  @IsIn(REWARD_TYPES)
  rewardType?: BetAndGetRewardType;

  /** Required when rewardType is FIXED - checked in the service, not here, since it depends on another field. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardAmountCents?: number;

  /** Required when rewardType is PERCENTAGE (which itself requires requiresBet). */
  @IsOptional()
  @IsPositive()
  rewardPercent?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardCapCents?: number;

  @IsOptional()
  @IsBoolean()
  requiresBet?: boolean;

  /** Required when requiresBet is true - the "max days since registration" a qualifying bet must land within. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  qualifyingBetWindowDays?: number;

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
  @IsIn(BET_TYPES)
  betType?: BetAndGetBetType;

  @IsOptional()
  @IsInt()
  @Min(2)
  minSelections?: number | null;

  @IsOptional()
  @IsIn(AUDIENCE_MODES)
  audienceMode?: AudienceMode;

  /** Required and used only when audienceMode is SEGMENTS - the full replacement set of segment ids. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segmentIds?: string[];
}
