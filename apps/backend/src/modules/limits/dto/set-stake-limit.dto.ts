import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const SCOPES = ['GLOBAL', 'SPORT', 'COUNTRY', 'LEAGUE', 'MARKET'] as const;

export class SetStakeLimitDto {
  @IsIn(SCOPES)
  scope!: (typeof SCOPES)[number];

  /** "" for GLOBAL, otherwise the raw feed sport/country/competition/market name it targets. */
  @IsString()
  scopeValue!: string;

  /** 0 = applies regardless of tier; 1-4 = only that CompetitionTier. */
  @IsInt()
  @Min(0)
  @Max(4)
  tier!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStakeCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxLiabilityCents?: number | null;
}
