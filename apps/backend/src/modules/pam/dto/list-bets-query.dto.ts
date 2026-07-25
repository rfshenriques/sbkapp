import { BetStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/** Query strings arrive as literal "true"/"false" - anything else is left as-is so a typo'd value fails IsBoolean instead of silently matching everything. */
function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ListBetsQueryDto {
  @IsOptional()
  @IsEnum(BetStatus)
  status?: BetStatus;

  /** Inclusive start of the bet's createdAt range. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive end of the bet's createdAt range. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Case-insensitive substring match against the player's username or email. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  player?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  fundedByFreebets?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  insured?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  boosted?: boolean;

  /** True = qualified for a Bet & Get or deposit campaign, false = qualified for neither. */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasCampaign?: boolean;

  /** Exact match against a selection's snapshotted sport - see BetSelection.sport. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sport?: string;

  /** Exact match against a selection's snapshotted competition - see BetSelection.competition. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  competition?: string;
}
