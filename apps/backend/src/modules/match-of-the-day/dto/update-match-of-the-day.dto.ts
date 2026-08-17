import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

/** Every field optional - staff sends only what's changing. */
export class UpdateMatchOfTheDayDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  matchId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsISO8601()
  startAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;
}
