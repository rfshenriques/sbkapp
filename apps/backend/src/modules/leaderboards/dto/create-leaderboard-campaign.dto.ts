import { IsArray, IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { AudienceMode, BetAndGetBetType, BetAndGetTiming } from '@prisma/client';

const BET_TYPES: BetAndGetBetType[] = ['SINGLES_ONLY', 'ACCUMULATOR_ONLY', 'EITHER'];
const BETTING_TIMINGS: BetAndGetTiming[] = ['PREMATCH_ONLY', 'INPLAY_ONLY', 'EITHER'];
const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

export class CreateLeaderboardCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string | null;

  /** Required - a leaderboard needs a definite end to rank against and grant prizes at. */
  @IsISO8601()
  endAt!: string;

  @IsOptional()
  @IsPositive()
  pointsPerEuroStaked?: number;

  @IsOptional()
  @IsBoolean()
  useCombinedOddsAsMultiplier?: boolean;

  @IsOptional()
  @IsBoolean()
  onlySettledWonCounts?: boolean;

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
  @IsIn(AUDIENCE_MODES)
  audienceMode?: AudienceMode;

  /** Required and used only when audienceMode is SEGMENTS - the full replacement set of segment ids. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segmentIds?: string[];
}
