import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SetOddsOverrideDto {
  @IsString()
  @MinLength(1)
  matchId!: string;

  @IsString()
  @MinLength(1)
  marketId!: string;

  @IsString()
  @MinLength(1)
  selectionId!: string;

  /** Decimal odds - must stay above 1.00 to remain a valid price. */
  @IsNumber()
  @Min(1.01)
  oddsValue!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
