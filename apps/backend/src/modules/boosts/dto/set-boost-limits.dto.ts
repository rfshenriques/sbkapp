import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { AudienceMode } from '@prisma/client';

const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'LOGGED_OUT', 'LOGGED_IN', 'SEGMENTS'];

export class SetBoostLimitsDto {
  /** Null clears the cap. Omit to leave it unchanged. Shown to players alongside the boosted price. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStakeCents?: number | null;

  /** Null clears the cap. Once currentLiabilityCents reaches this, the boost auto-disables. */
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
}
