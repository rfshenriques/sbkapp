import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { AudienceMode } from '@prisma/client';

const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

export class SetManualMarketLimitsDto {
  /** Null clears the cap. Omit to leave it unchanged. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStakeCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLiabilityCents?: number | null;

  @IsOptional()
  @IsIn(AUDIENCE_MODES)
  audienceMode?: AudienceMode;

  /** Required and used only when audienceMode is SEGMENTS - the full replacement set of segment ids. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segmentIds?: string[];

  @IsOptional()
  @IsBoolean()
  staysLiveDuringInplay?: boolean;

  /** A bet with 2+ selections that includes this market is rejected outright - see PamService.assertWithinManualMarketLimitsAndCollectLiability. */
  @IsOptional()
  @IsBoolean()
  singlesOnly?: boolean;
}
