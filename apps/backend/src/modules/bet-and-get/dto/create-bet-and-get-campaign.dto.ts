import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { BetAndGetBetType, BetAndGetTrigger } from '@prisma/client';

const TRIGGERS: BetAndGetTrigger[] = ['PLACEMENT', 'SETTLEMENT'];
const BET_TYPES: BetAndGetBetType[] = ['SINGLES_ONLY', 'ACCUMULATOR_ONLY', 'EITHER'];

export class CreateBetAndGetCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @IsPositive()
  rewardAmountCents!: number;

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
}
