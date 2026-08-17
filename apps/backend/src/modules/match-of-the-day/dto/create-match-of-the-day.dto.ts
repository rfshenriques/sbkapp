import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMatchOfTheDayDto {
  @IsString()
  @MinLength(1)
  matchId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Optional scheduling window - both independently optional, see MatchOfTheDay.startAt/endAt. */
  @IsOptional()
  @IsISO8601()
  startAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;
}
